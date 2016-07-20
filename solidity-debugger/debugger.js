define(function(require, exports, module) {
  main.consumes = ['Plugin', 'debugger'];
  main.provides = ['ether.camp.debugger.solidity'];
  return main;

  function main(options, imports, register) {
    var Plugin = imports.Plugin;
    var debug = imports['debugger'];

    var type = 'solidity';
    var web3, socket;
    
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

    function attach(s, reconnect, callback) {
      socket = s;
      socket.on("error", function(err) {
        emit("error", err);
      }, plugin);

      var breakpoints = emit('getBreakpoints');
      console.log(breakpoints);

      console.log(web3.version.node);
      
      callback();
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
      getProxySource: getProxySource,
      attach: attach
    });

    register(null, { 'ether.camp.debugger.solidity': plugin });
  }
});
