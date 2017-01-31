define(function(require) {
  main.consumes = ['Dialog', 'ui', 'ethergit.libs'];
  main.provides = ['ethergit.ethereum.sandbox.dialog.transaction'];
  
  return main;
  
  function main(options, imports, register) {
    var Dialog = imports.Dialog;
    var ui = imports.ui;
    var libs = imports['ethergit.libs'];
    var _ = libs.lodash();
    var folder = require('./folder')(_);
    var $ = libs.jquery();

    var displayFields = [
      'from',
      'nonce',
      'to',
      'gasLimit',
      'gasUsed',
      'value',
      'data',
      'createdAddress',
      'returnValue',
      'exception',
      'rlp'
    ];
    
    var dialog = new Dialog('Ethergit', main.consumes, {
      name: 'sandbox-transaction',
      allowClose: true,
      title: 'Transaction',
      width: 500,
      elements: [
        {
          type: 'button', id: 'closeTransactionDialog', color: 'blue',
          caption: 'Close', 'default': true, onclick: hideDialog
        }
      ]
    });
    
    dialog.on('draw', function(e) {
      e.html.innerHTML = require('text!./transaction.html');
      $(e.html).click(folder.handler);
    });

    function showTransaction(sandbox, id) {
      dialog.show();
      var $container = $('[data-name=transaction]');
      sandbox.transactions(false, function(err, transactions) {
        var tx = transactions[id];
        displayFields.forEach(function(field) {
          $container.find('[data-name=' + field + ']').text(tx[field]);
        });
        folder.init($container);
      });
    }
    
    function hideDialog() {
      dialog.hide();
    }
    
    dialog.on('load', function() {
      ui.insertCss(require('text!./transaction.css'), false, dialog);
    });
    
    dialog.freezePublicAPI({
      showTransaction: showTransaction
    });
    
    register(null, {
      'ethergit.ethereum.sandbox.dialog.transaction': dialog
    });
  }
});
