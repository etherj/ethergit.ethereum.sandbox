define(function(require) {
  main.consumes = [
    'Dialog', 'ui',
    'ethergit.sandbox',
    'ethergit.ethereum.sandbox.dialog.pkey',
    'ethergit.sandbox.config',
    'ethergit.libs'
  ];
  main.provides = ['ethergit.ethereum.sandbox.dialog.new.tx'];
  
  return main;
  
  function main(options, imports, register) {
    var Dialog = imports.Dialog;
    var ui = imports.ui;
    var sandbox = imports['ethergit.sandbox'];
    var pkeyDialog = imports['ethergit.ethereum.sandbox.dialog.pkey'];
    var config = imports['ethergit.sandbox.config'];
    var libs = imports['ethergit.libs'];
    
    var async = require('async');

    var $ = libs.jquery();
    var _ = libs.lodash();
    
    // Cached elements
    var $from, $to, $value, $error;
    
    var dialog = new Dialog('Ethergit', main.consumes, {
      name: 'sandbox-new-tx',
      allowClose: true,
      title: 'New Transaction',
      width: 500,
      elements: [
        {
          type: 'button', id: 'newTxDialogOk', color: 'green',
          caption: 'OK', 'default': true, onclick: send
        },
        {
          type: 'button', id: 'newTxDialogCancel', color: 'blue',
          caption: 'Cancel', 'default': false, onclick: hide
        }
      ]
    });

    dialog.on('draw', function(e) {
      e.html.innerHTML = require('text!./dialog.html');
      var $root = $(e.html);
      $error = $root.find('[data-name=error]');
      $from = $root.find('[data-name=from]');
      $to = $root.find('[data-name=to]');
      $value = $root.find('[data-name=value]');
      $root.keydown(function(e) { e.stopPropagation(); });
      $root.keyup(function(e) {
        e.stopPropagation();
        if (e.keyCode == 27) hide();
      });
      $root.find('form').keypress(function(e) {
        e.stopPropagation();
        if (e.keyCode == 13) {
          e.preventDefault();
          send();
        }
      });
    });

    dialog.on('show', function() {
      async.parallel([
        sandbox.accounts.bind(sandbox, false),
        sandbox.web3.eth.getAccounts.bind(sandbox.web3.eth)
      ], function(err, results) {
        var allAccounts = results[0],
            accountsWithPkey = results[1];
        
        $from.html(_(allAccounts).map(function(address) {
          var withPkey = _.contains(accountsWithPkey, address);
          var isDefault = address === sandbox.web3.eth.defaultAccount;
          return '<option value="' + address + '"' +
            (isDefault ? ' selected' : '') + '>' +
            address + (withPkey ? ' (has pkey)' : '') + '</option>';
        }).join(''));

        $to.html(_(allAccounts).map(function(address) {
          return '<option value="' + address + '">' + address + '</option>';
        }).join(''));

        $value.focus();
      });
    });
    
    function send() {
      var value = $value.val();
      if (!/^\d+$/.test(value)) {
        return $error.text('Value must be a digit.');
      }
      $error.empty();
      var from = $from.val();
      sandbox.web3.eth.getAccounts(function(err, accounts) {
        if (!_.contains(accounts, from)) {
          // pkeyDialog.ask(options.from, sendTx);
          $error.text(from + ' does not have pkey');
        } else {
          sandbox.web3.eth.sendTransaction({
            from: from,
            to: $to.val(),
            value: value
          }, function(err) {
            if (err) $error.text(err.message);
            else hide();
          });
        }
      });
    }
    
    function hide() {
      dialog.hide();
    }

    dialog.freezePublicAPI({
    });
    
    register(null, {
      'ethergit.ethereum.sandbox.dialog.new.tx': dialog
    });
  }
});
