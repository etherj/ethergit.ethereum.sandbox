define(function(require, exports, module) {
  main.consumes = ['Plugin', 'debugger', 'fs', 'ethergit.libs'];
  main.provides = ['ether.camp.debugger.solidity'];
  return main;

  function main(options, imports, register) {
    var Plugin = imports.Plugin;
    var debug = imports['debugger'];
    var fs = imports.fs;
    var libs = imports['ethergit.libs'];

    var async = require('async');

    var _ = libs.lodash();

    var Frame = debug.Frame;
    var Source = debug.Source;
    var Scope = debug.Scope;
    var Variable = debug.Variable;
    
    var type = 'solidity';
    var workspaceDir = '/root/workspace';
    var web3, socket, state = null, attached = false,
        breakpointFilterWatcher, breakpointFilterNum;
    
    var plugin = new Plugin('ether.camp', main.consumes);
    var emit = plugin.getEmitter();
    emit.setMaxListeners(1000);

    plugin.on('load', function() {
      debug.registerDebugger(type, plugin);
    });

    plugin.on('unload', function() {
      debug.unregisterDebugger(type, plugin);
    });

    function getProxySource(process) {
      web3 = process.web3;
      return debug.proxySource
        .replace(/\/\/.*/g, "")
        .replace(/[\n\r]/g, "")
        .replace(/\{PORT\}/, process.runner.debuggerport);
    }

    function attach(s, reconnect, cb) {
      socket = s;
      socket.on("error", function(err) {
        emit("error", err);
      }, plugin);

      var breakpoints = emit('getBreakpoints');
      var sandboxBreakpoints = _.map(breakpoints, function(breakpoint) {
        return {
          line: breakpoint.line,
          column: breakpoint.column,
          source: workspaceDir + breakpoint.path
        }
      });

      web3.debug.setBreakpoints(sandboxBreakpoints, function(err) {
        if (err) return cb(err);
        attached = true;
        
        web3.debug.newBreakpointFilter(function(err, filterNum) {
          if (err) return cb(err);
          
          breakpointFilterNum = filterNum;
          breakpointFilterWatcher = setInterval(function() {
            web3.debug.getFilterChanges(filterNum, function(err, changes) {
              if (err) return console.error(err);
              if (changes.length > 0 && _.startsWith(changes[0].path, '/root/workspace')) {
                console.log(changes[0]);
                state = 'stopped';
                var frame = createFrame(changes[0]);
                emit('break', { frame: frame, frames: [frame] });
                emit('stateChange', { state: state });
              }
            });
          }, 1000);
          
          emit('attach', { breakpoints: breakpoints });
          cb();
        });
      });
    }

    function createFrame(bp) {
      var base = '/root/workspace';
      var name = bp.path.substring(bp.path.lastIndexOf('/'));
      var path = bp.path.substring(base.length);
      var frame = new Frame({
        index: 0,
        name: name,
        column: bp.column,
        line: bp.line,
        id: '1',
        script: name,
        path: path,
        scopes: [ new Scope({
          index: 0,
          type: 'storage',
          frameIndex: 0,
          variables: _.map(bp.vars, function(variable) {
            return new Variable({
              name: variable.name,
              scope: 'storage',
              value: variable.value,
              type: variable.type,
              ref: variable.name,
              children: false
            });
          })
        }) ]
      });
      console.log(frame);
      return frame;
    }

    function detach() {
      emit("frameActivate", { frame: null });
      emit("stateChange", { state: null });

      clearInterval(breakpointFilterWatcher);
      web3.debug.uninstallFilter(breakpointFilterNum, function(err) {
        if (err) console.error(err);
      });
      
      socket = null;
      attached = false;
      state = null;

      emit('detach');
    }

    function getScope(frame, scope, cb) {
      cb(null, [], scope, frame);
    }

    function resume(cb) {
      web3.debug.resume(function(err) {
        if (err) {
          if (cb) return cb(err);
          else return console.error(err);
        }
        state = 'running';
        emit('stateChange', state);
        emit('frameActivate', { frame: null });
      });
    }

    function stepInto(cb) {
      web3.debug.stepInto(cb ? cb : function(err) { if (err) console.error(err); });
    }
    
    plugin.freezePublicAPI({
      type: type,
      features: {
        scripts: false,
        conditionalBreakpoints: false,
        liveUpdate: false,
        updateWatchedVariables: false,
        updateScopeVariables: false,
        setBreakBehavior: false,
        executeCode: false
      },
      get attached() { return attached; },
      get state() { return state; },
      getProxySource: getProxySource,
      attach: attach,
      detach: detach,
      getScope: getScope,
      resume: resume,
      stepInto: stepInto
    });

    register(null, { 'ether.camp.debugger.solidity': plugin });
  }
});
