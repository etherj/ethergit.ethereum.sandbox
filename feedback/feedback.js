define(function(require, exports, module) {
  main.consumes = ['Plugin', 'ui', 'settings', 'ethergit.libs'];
  main.provides = ['ethereum.studio.feedback'];
  return main;

  function main(options, imports, register) {
    var Plugin = imports.Plugin;
    var ui = imports.ui;
    var settings = imports.settings;
    var libs = imports['ethergit.libs'];

    var $ = libs.jquery();

    var plugin = new Plugin('Ether.camp', main.consumes);

    plugin.on('load', function() {
      ui.insertCss(require('text!./style.css'), false, plugin);
      ui.insertHtml(document.body, require('text!./feedback.html'), plugin);
      installTheme($('[data-name=feedback]'));

      function installTheme($el) {
        $el.addClass(settings.get('user/general/@skin'));
        settings.on('user/general/@skin', function(newTheme, oldTheme) {
          $el.removeClass(oldTheme).addClass(newTheme);
        }, plugin);
      }
    });
    
    plugin.freezePublicAPI({});
    register(null, { 'ethereum.studio.feedback': plugin });
  }
});
