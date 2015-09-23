define(function(require) {
  main.consumes = [
    'Dialog', 'ui', 'dialog.error', 'http', 'tabManager', 'commands', 'layout',
    'ethergit.libs',
    'ethergit.ethereum.sandbox.dialog.transaction',
    'ethergit.ethereum.sandbox.dialog.new.tx',
    'ethergit.sandbox',
    'ethergit.ethereum.sandbox.dialog.pkey',
    'ethergit.dialog.send.to.net'
  ];
  main.provides = ['ethergit.ethereum.sandbox.dialog.transactions'];
  
  return main;
  
  function main(options, imports, register) {
    var Dialog = imports.Dialog;
    var ui = imports.ui;
    var errorDialog = imports['dialog.error'];
    var http = imports.http;
    var tabs = imports.tabManager;
    var commands = imports.commands;
    var layout = imports.layout;
    var libs = imports['ethergit.libs'];
    var transactionDialog = imports['ethergit.ethereum.sandbox.dialog.transaction'];
    var newTxDialog = imports['ethergit.ethereum.sandbox.dialog.new.tx'];
    var sendToNetDialog = imports['ethergit.dialog.send.to.net'];
    var sandbox = imports['ethergit.sandbox'];
    
    var async = require('async');
    var utils = require('./utils');

    var $ = libs.jquery();
    var _ = libs.lodash();
    
    var dialog = new Dialog('Ethergit', main.consumes, {
      name: 'sandbox-transactions',
      allowClose: true,
      title: 'Ethereum Sandbox Transactions',
      width: 800,
      elements: [
        {
          type: 'button', id: 'transactionsDialogNewTx', color: 'green',
          caption: 'New Transaction', 'default': false, onclick: openNewTxDialog
        },
        {
          type: 'button', id: 'transactionsDialogSendToNetwork', color: 'red',
          caption: 'Send Contracts to Net', 'default': false, onclick: openSendToNetDialog
        },
        {
          type: 'button', id: 'transactionsDialogClose', color: 'blue',
          caption: 'Close', 'default': true, onclick: hideDialog
        }
      ]
    });

    dialog.on('load', function() {
      commands.addCommand({
        name: 'showTransactions',
        exec: dialog.show.bind(dialog)
      }, dialog);

      var btnTransactions = ui.insertByIndex(
        layout.getElement('barTools'),
        new ui.button({
          id: 'btnTransactions',
          skin: 'c9-toolbarbutton-glossy',
          command: 'showTransactions',
          caption: 'Transactions',
          disabled: true
        }),
        400, dialog
      );

      sandbox.on('select', function() {
        if (sandbox.getId()) {
          btnTransactions.setAttribute('disabled', false);
          updateTxCounter();
        } else {
          btnTransactions.setAttribute('caption', 'Transactions');
          btnTransactions.setAttribute('disabled', true);
        }
      });

      sandbox.on('changed', updateTxCounter);

      function updateTxCounter() {
        sandbox.transactions(function(err, transactions) {
          if (err) console.error(err);
          else btnTransactions.setAttribute(
            'caption', 'Transactions (' + transactions.length + ')'
          );
        });
      }
    });
    
    dialog.on('draw', function(e) {
      e.html.innerHTML = require('text!./transactions.html');
    });

    dialog.on('show', function() {
      render();
      sandbox.on('changed', render, dialog);
      
      $('[data-name=transactions]').off('click').click(function(e) {
        var $el = $(e.target);
        if ($el.data('name') === 'from') {
          transactionDialog.showTransaction(sandbox, $el.find('[data-name=id]').text());
        }
      });
    });
    
    function render() {
      var $container = $('[data-name=transactions]').empty();
      sandbox.transactions(function(err, transactions) {
        transactions.forEach(function(tx, id) {
          $container.append(
            $('<tr>')
              .append('<td data-name="from" class="from">' + tx.from + '<span data-name="id" style="display:none">' + id + '</span></td>')
              .append('<td>' + tx.nonce + '</td>')
              .append('<td>' + (tx.to ? tx.to : '[contract create]') + '</td>')
          );
        });
      });
    }

    function openSendToNetDialog() {
      sendToNetDialog.show();
      hideDialog();
    }
    
    function openNewTxDialog() {
      newTxDialog.show();
    }

    function hideDialog() {
      dialog.hide();
    }

    dialog.on('hide', function() {
      sandbox.off('changed', render);
    });
    
    dialog.on('load', function() {
      ui.insertCss(require('text!./transactions.css'), false, dialog);
    });
    
    dialog.freezePublicAPI({ });
    
    register(null, {
      'ethergit.ethereum.sandbox.dialog.transactions': dialog
    });
  }
});
