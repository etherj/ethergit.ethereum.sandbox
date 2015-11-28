// There's an error with panes resizing if ide has turned off editors.
// For example, guest doesn't have terminal editor, but it could be already
// opened in not guest mode.

define(function(require, exports, module) {
  main.consumes = ['Plugin', 'tabManager', 'ethergit.libs', 'ui'];
  main.provides = ['ethergit.guest.pane.resize.fix'];
  return main;

  function main(options, imports, register) {
    var Plugin = imports.Plugin;
    var tabs = imports.tabManager;
    var ui = imports.ui;
    var libs = imports['ethergit.libs'];

    var _ = libs.lodash();
    
    var plugin = new Plugin('Ethergit', main.consumes);

    tabs.on('ready', function() {
      _(tabs.getTabs())
        .filter(function(tab) {
          return tab.editorType == 'terminal' ||
            tab.editorType == 'ethereum-console' ||
            tab.editorType == 'sent-tx';
        })
        .invoke('close')
        .value();
    });

    // hide buttons that confuse users.
    ui.insertCss(require('text!./hide_buttons.css'), false, plugin);

    plugin.freezePublicAPI({});
    register(null, { 'ethergit.guest.pane.resize.fix': plugin });
  }
});
