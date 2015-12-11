// We have to load bootstap css because it doesn't have priority
// if we load it with ui.insertCss().

define(function(require, exports, module) {
  main.consumes = ['Plugin'];
  main.provides = ['ethergit.inject.bootstrap.css'];
  return main;

  function main(options, imports, register) {
    var Plugin = imports.Plugin;

    injectCss('/static/plugins/ethergit.libs/bootstrap/css/bootstrap.css');
    injectCss('/static/plugins/ethergit.libs/bootstrap/css/bootstrap-theme.css');
    
    var plugin = new Plugin('Ethergit', main.consumes);

    plugin.freezePublicAPI({});
    register(null, { 'ethergit.inject.bootstrap.css': plugin });

    function injectCss(url) {
      var link = document.createElement('link');
      link.setAttribute('rel', 'stylesheet');
      link.setAttribute('type', 'text/css');
      link.setAttribute('href', url);
      document.getElementsByTagName('head')[0].appendChild(link);
    }
  }
});
