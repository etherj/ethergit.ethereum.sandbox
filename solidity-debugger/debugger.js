define(function(require, exports, module) {
  main.consumes = ['Plugin', 'debugger'];
  main.provides = ['ether.camp.debugger.solidity'];
  return main;

  function main(options, imports, register) {
    var Plugin = imports.Plugin;
    var debug = imports['debugger'];

    var type = 'solidity';
    
    var plugin = new Plugin('ether.camp', main.consumes);

    plugin.on('load', function() {
      debug.registerDebugger(type, plugin);
    });

    plugin.on('unload', function() {
      debug.unregisterDebugger(type, plugin);
    });

    function getProxySource(process){
      console.log(debug.proxySource);
      return debug.proxySource
        .replace(/\/\/.*/g, "")
        .replace(/[\n\r]/g, "")
        .replace(/\{PORT\}/, process.runner.debugport);
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
      getProxySource: getProxySource
    });

    register(null, { 'ether.camp.debugger.solidity': plugin });
  }
});
