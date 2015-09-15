define(function(require) {
  main.consumes = [
    'Dialog', 'ui', 'layout', 'commands',
    'ethergit.sandbox', 'ethergit.libs', 'ethergit.sandbox.config'
  ];
  main.provides = ['ethergit.dialog.send.to.net'];
  return main;

  function main(options, imports, register) {
    var Dialog = imports.Dialog;
    var ui = imports.ui;
    var layout = imports.layout;
    var commands = imports.commands;
    var sandbox = imports['ethergit.sandbox'];
    var libs = imports['ethergit.libs'];

    var $ = libs.jquery();

    var dialog = new Dialog('Ethergit', main.consumes, {
      name: 'ethergit-dialog-send-to-net',
      allowClose: true,
      title: 'Send Contract to the Net',
      width: 500,
      elements: [
        {
          type: 'button', id: 'send', color: 'green',
          caption: 'Send', 'default': true
        },
        {
          type: 'button', id: 'cancel', color: 'blue',
          caption: 'Cancel', 'default': false, onclick: hide
        }
      ]
    });

    dialog.on('load', function() {
      commands.addCommand({
        name: 'showSendToNet',
        exec: dialog.show.bind(dialog)
      }, dialog);

      var btn = ui.insertByIndex(
        layout.getElement('barTools'),
        new ui.button({
          id: 'btnSendToNet',
          skin: 'c9-toolbarbutton-glossy',
          command: 'showSendToNet',
          caption: 'Send Contracts to Net',
          disabled: true
        }),
        450, dialog
      );

      sandbox.on('select', function() {
        btn.setAttribute('disabled', !sandbox.getId());
      });
    });

    dialog.on('draw', function(e) {
      e.html.innerHTML = require('text!./dialog.html');
      var $root = $(e.html);
      $pkey = $root.find('[data-name=pkey]');
      $gasLimit = $root.find('[data-name=gasLimit]');
      $gasPrice = $root.find('[data-name=gasPrice]');
    });

    dialog.on('show', function() {
      setFormDefaults();

      function setFormDefaults() {
        $pkey.val('');
        config.parse(function(parsed) {
          $gasLimit.val(parsed.transaction.gasLimit);
          $gasPrice.val(parsed.transaction.gasPrice);
        });
      }
    });

    function hide() {
      dialog.hide();
    }

    dialog.freezePublicAPI({
    });

    register(null, {
      'ethergit.dialog.send.to.net': dialog
    });
  }
});
