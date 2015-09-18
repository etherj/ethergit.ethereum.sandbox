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
    var config = imports['ethergit.sandbox.config'];

    var async = require('async');
    var utils = require('../utils');
    
    var $ = libs.jquery();
    var _ = libs.lodash();
    var Web3 = libs.web3();
    var web3 = new Web3(new Web3.prototype.providers.HttpProvider('http://' + window.location.hostname + ':8545'));

    var contractTmpl = _.template(
      '<tr>' +
        '<td><input data-name="toSend" type="checkbox" checked></td>' +
        '<td data-name="name"><%= name %></td>' +
        '<td><input data-name="gasLimit" type="text" value="<%= gasLimit %>"></td>' +
        '<td><input data-name="gasPrice" type="text" value="<%= gasPrice %>"></td>' +
        '<input data-name="binary" type="hidden" value="<%= binary %>">' +
        '</tr>'
    );
    
    var $pkey, $error, $success, $contracts;

    var dialog = new Dialog('Ethergit', main.consumes, {
      name: 'ethergit-dialog-send-to-net',
      allowClose: true,
      title: 'Send Contract to the Net',
      width: 800,
      elements: [
        {
          type: 'button', id: 'send', color: 'green',
          caption: 'Send', 'default': true, onclick: send
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
      $error = $root.find('[data-name=error]');
      $success = $root.find('[data-name=success]');
      $contracts = $root.find('[data-name=contracts]');
    });

    dialog.on('show', function() {
      setFormDefaults();
      showContracts();

      function setFormDefaults() {
        $pkey.val('');
        $error.text('');
        $success.text('');
      }
      function showContracts() {
        async.parallel([
          sandbox.web3.sandbox.contracts.bind(sandbox.web3.sandbox),
          web3.eth1.gasPrice.bind(web3.eth1),
        ], function(err, results) {
          if (err) return $error.text(err.message);
          var contracts = results[0];
          var gasPrice = results[1].toString();
          if (err) return $error.text('Could not get contracts: ' + err.message);
          $contracts.html(
            _.reduce(contracts, function(html, contract, address) {
              return html + contractTmpl({
                address: address,
                name: contract.name,
                gasLimit: parseInt(contract.gasUsed.substr(2), 16),
                gasPrice: gasPrice,
                binary: contract.binary
              });
            }, '')
          );
        });
      }
    });

    function send() {
      $error.text('');
      $success.text('');
      
      var contracts = _.where($contracts.find('tr').map(function(n, row) {
        var $row = $(row);
        return {
          toSend: $row.find('[data-name=toSend]').is(':checked'),
          name: $row.find('[data-name=name]').text(),
          gasLimit: parseInt($row.find('[data-name=gasLimit]').val()),
          gasPrice: parseInt($row.find('[data-name=gasPrice]').val()),
          binary: $row.find('[data-name=binary]').val(),
        };
      }), { toSend: true });

      var pkey = processPkey($pkey.val());
      var address = utils.toAddress(pkey);

      async.series([
        checkBalance,
        sendContracts
      ], function(err) {
        if (err) $error.text(err);
        else $success.text('Transactions have been sent successfully.');
      });
      
      function processPkey(pkey) {
        if (pkey.match(/^[\dabcdef]{64}$/)) return '0x' + pkey.substr;
        else if (!pkey.match(/^0x[\dabcdef]{64}$/)) return '0x' + utils.sha3(pkey);
        return pkey;
      }
      function checkBalance(cb) {
        web3.eth1.getBalance(address, function(err, balance) {
          if (err) return cb(err.message);
          var total = _.reduce(contracts, function(sum, contract) {
            return sum.plus(
              new BigNumber(contract.gasLimit).times(new BigNumber(contract.gasPrice))
            );
          }, new BigNumber(0));

          cb(
            balance.lessThan(total) ?
              'Account ' + address + ' has only ' + balance.toString() +
              ' wei, but need ' + total.toString() + ' to create contract(s).' :
              null
          );
        });
      }
      function sendContracts(cb) {
        web3.eth1.getTransactionCount(address, function(err, nonce) {
          if (err) return cb(err);
          async.eachSeries(contracts, function(contract, cb) {
            web3.eth1.sendRawTransaction(utils.createTx({
              nonce: nonce++,
              data: '0x' + contract.binary,
              gasLimit: contract.gasLimit,
              gasPrice: contract.gasPrice,
              pkey: pkey
            }), function(err, result) {
              if (err) return cb(err.message);
              cb();
            });
          }, cb);
        });
      }
    }
    
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
