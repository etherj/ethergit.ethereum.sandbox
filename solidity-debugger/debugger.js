define(function(require, exports, module) {
  main.consumes = ['Plugin', 'debugger', 'ethergit.libs'];
  main.provides = ['ether.camp.debugger.solidity'];
  return main;

  function main(options, imports, register) {
    var Plugin = imports.Plugin;
    var debug = imports['debugger'];
    var libs = imports['ethergit.libs'];

    var async = require('async');

    var _ = libs.lodash();

    var Frame = debug.Frame;
    var Source = debug.Source;
    var Scope = debug.Scope;
    var Variable = debug.Variable;

    var type = 'solidity';
    var workspaceDir = '/root/workspace';
    var web3, socket, state = null, attached = false, variables = [],
        breakpointFilterWatcher, breakpointFilterNum,
        breakOnExceptions, breakOnUncaughtExceptions;
    
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
      var sandboxBreakpoints = _.map(breakpoints, function(bp) {
        return {
          line: bp.line,
          source: workspaceDir + bp.path
        };
      });
      async.series([
        web3.debug.setBreakpoints.bind(web3.debug, sandboxBreakpoints),
        setupWatcher
      ], function(err) {
        if (err) return cb(err);
        attached = true;
        state = 'running';
        emit('attach', { breakpoints: breakpoints });
        emit('stateChange', { state: state });
        cb();
      });

      function setupWatcher(cb) {
        web3.debug.newBreakpointFilter(function(err, filterNum) {
          if (err) return cb(err);

          breakpointFilterNum = filterNum;
          breakpointFilterWatcher = setInterval(function() {
            web3.debug.getFilterChanges(filterNum, function(err, changes) {
              if (err) return console.error(err);
              if (changes.length > 0 && _.startsWith(changes[0].source, '/root/workspace')) {
                console.log(changes[0]);
                state = 'stopped';
                variables = changes[0].storageVars;
                var frames = createFrames(changes[0]);
                emit('break', { frame: _.last(frames), frames: frames });
                emit('stateChange', { state: state });
              }
            });
          }, 1000);
          
          cb();
        });
      }
    }

    function createFrames(bp) {
      var storageScope = createScope('storage', bp.storageVars);
      var frames = _(bp.callStack)
          .map(createFrame.bind(null, storageScope))
          .reverse()
          .value();
      return frames;
    }

    function createFrame(storageScope, func, idx) {
      var base = '/root/workspace';
      var path = func.mapping.source.substring(base.length);
      return new Frame({
        index: idx,
        name: func.name,
        column: 0,
        line: func.mapping.line,
        id: func.name,
        script: path,
        path: path,
        scopes: [ storageScope, createScope('function', func.vars) ]
      });
    }

    function createScope(type, vars) {
      return new Scope({
        index: 0,
        type: type,
        frameIndex: 0,
        
        variables: _.map(vars, function(variable, index) {
          var properties;
          var value = variable.value;
          if (_.isArray(value)) {
            properties = _.map(value, createVariable);
            value = '[array]';
          } else if (_.isObject(value)) {
            properties = _.map(value, createVariable);
            value = '[object]';
          }
          var v = new Variable({
            name: variable.name,
            scope: type,
            value: value,
            type: variable.type,
            children: !!properties
          });
          if (properties) v.properties = properties;
          return v;
        })
      })
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
        emit('stateChange', { state: state });
        emit('frameActivate', { frame: null });
      });
    }

    function stepInto(cb) {
      state = 'running';
      emit('stateChange', { state: state });
      emit('frameActivate', { frame: null });
      web3.debug.stepInto(cb || showError);
    }

    function stepOver(cb) {
      state = 'running';
      emit('stateChange', { state: state });
      emit('frameActivate', { frame: null });
      web3.debug.stepOver(cb || showError);
    }

    function stepOut(cb) {
      state = 'running';
      emit('stateChange', { state: state });
      emit('frameActivate', { frame: null });
      web3.debug.stepOut(cb || showError);
    }

    function getProperties(variable, cb) {
      var properties = _.map(variables[variable.ref].value, createVariable);
      variable.properties = properties;
      cb(null, properties, variable);
    }

    function createVariable(value, name) {
      var properties;
      if (typeof value == 'object') {
        properties = _.map(value, createVariable);
        value = '[object]';
      } else if (typeof value == 'array') {
        properties = _.map(value, createVariable);
        value = '[array]';
      }
      var v = new Variable({
        name: name,
        scope: 'storage',
        value: value,
        type: '',
        children: !!properties
      });
      if (properties) v.properties = properties;
      return v;
    }
    
    function setBreakBehavior(type, enabled, callback) {
      breakOnExceptions = enabled ? type == "all" : false;
      breakOnUncaughtExceptions = enabled ? type == "uncaught" : false;
    }

    function evaluate(expression, frame, global, disableBreak, cb) {
      var variable = new Variable({
        name: 'Eval',
        value: 'Not implemented'
      });
      cb(null, variable);
    }

    function setBreakpoint(bp, cb) {
      var sandboxBp = {
        line: bp.line,
        source: workspaceDir + bp.path
      };
      web3.debug.setBreakpoints([sandboxBp], cb || showError);
    }

    function changeBreakpoint(bp, cb) {
      if (bp.enabled) setBreakpoint(bp, cb);
      else clearBreakpoint(bp, cb);
    }

    function clearBreakpoint(bp, cb) {
      var sandboxBp = {
        line: bp.line,
        source: workspaceDir + bp.path
      };
      web3.debug.removeBreakpoints([sandboxBp], cb || showError);
    }

    function showError(err) {
      if (err) console.error(err);
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
      getProperties: getProperties,
      resume: resume,
      stepInto: stepInto,
      stepOver: stepOver,
      stepOut: stepOut,
      setBreakBehavior: setBreakBehavior,
      evaluate: evaluate,
      setBreakpoint: setBreakpoint,
      changeBreakpoint: changeBreakpoint,
      clearBreakpoint: clearBreakpoint
    });

    register(null, { 'ether.camp.debugger.solidity': plugin });
  }
});
