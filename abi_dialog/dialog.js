define(function(require) {
  main.consumes = ['Dialog', 'ethergit.libs'];
  main.provides = ['ethergit.dialog.abi'];
  return main;

  function main(options, imports, register) {
    var Dialog = imports.Dialog;
    var libs = imports['ethergit.libs'];

    var $ = libs.jquery();

    var $name, $content;

    var dialog = new Dialog('Ethergit', main.consumes, {
      name: 'ethereum-abi',
      allowClose: true,
      title: 'Contract ABI',
      width: 500,
      elements: [
        {
          type: 'button', id: 'close', color: 'blue',
          caption: 'Close', 'default': true, onclick: hide
        }
      ]
    });

    dialog.on('draw', function(e) {
      e.html.innerHTML = require('text!./dialog.html');
      var $root = $(e.html);
      $name = $root.find('[data-name=name]');
      $content = $root.find('[data-name=content]');
    });

    function showAbi(contract) {
      dialog.show();
      $name.text(contract.name);
      $content.text(JSON.stringify(contract.abi, null, 2));
    }

    function hide() {
      dialog.hide();
    }

    dialog.freezePublicAPI({ showAbi: showAbi });

    register(null, { 'ethergit.dialog.abi': dialog });
  }
});
