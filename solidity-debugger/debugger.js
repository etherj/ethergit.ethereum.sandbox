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
    
    var type = 'solidity';
    var workspaceDir = '/root/workspace';
    var web3, socket, attached = false;
    
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

      async.map(emit('getBreakpoints'), function(breakpoint, cb) {
        fs.readFile(breakpoint.path, function(err, data) {
          if (err) return cb(err);
          var line = breakpoint.line;
          var from = 0;
          while (line-- > 0) {
            from = data.indexOf('\n', from) + 1;
            if (from == 0)
              return cb(breakpoint.path + ' does not have line ' + breakpoint.line + ' with a breakpoint.');
          }
          
          from += breakpoint.column;
          var len = data.indexOf('\n', from) - from;
          if (len < 0) len = data.length - from;
          
          cb(null, {
            from: from,
            len: len,
            source: workspaceDir + breakpoint.path
          });
        });
      }, function(err, breakpoints) {
        if (err) return cb(err);
        
        web3.debug.setBreakpoints(breakpoints, function(err) {
          if (err) return cb(err);
          attached = true;
          cb();
        });
      });
    }

    function detach() {
      emit("frameActivate", { frame: null });
      emit("stateChange", { state: null });

      socket = null;
      attached = false;

      emit('detach');
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
      getProxySource: getProxySource,
      attach: attach,
      detach: detach
    });

    register(null, { 'ether.camp.debugger.solidity': plugin });
  }
});
