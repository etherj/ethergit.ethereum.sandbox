define(function(require) {
  main.consumes = [
    'Dialog', 'ui', 'layout', 'commands',
    'ethergit.sandbox', 'ethergit.libs',
    'ethergit.sandbox.config', 'ethergit.sent.txs.editor'
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
    var sentTxs = imports['ethergit.sent.txs.editor'];

    var async = require('async');
    var utils = require('../utils');
    var widgets = require('../ui/widgets');

    var url = 'http://peer-1.ether.camp:8082';

    var nets = {
      '0x34288454de81f95812b9e20ad6a016817069b13c7edc99639114b73efbc21368': 'test',
      '0xd4e56740f876aef8c010b86a40d5f56745a118d0906a34e69aec8c0db1cb8fa3': 'frontier'
    };
    
    var $ = libs.jquery();
    var _ = libs.lodash();
    var Web3 = libs.web3();
    var web3 = new Web3(new Web3.providers.HttpProvider(url));

    var contractHtml = '<tr>' +
        '<td data-name="toSend" style="padding-top:15px"></td>' +
        '<td data-name="name" style="padding-top:15px"></td>' +
        '<td data-name="value"></td>' +
        '<td data-name="gasLimit"></td>' +
        '<td data-name="gasPrice"></td>' +
        '</tr>';
    
    var $form, $pkey, $error, $success, $contracts, $url, $hidePkey;

    var dialog = new Dialog('Ethergit', main.consumes, {
      name: 'ethergit-dialog-send-to-net',
      allowClose: true,
      title: 'Send Contract to the Net',
      width: 800,
      elements: [
        {
          type: 'button', id: 'send', color: 'green',
          caption: 'Send', 'default': true, disabled: true
        },
        {
          type: 'button', id: 'cancel', color: 'blue',
          caption: 'Cancel', 'default': false, onclick: hide, disabled: false
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
      $form = $root.find('form');
      $pkey = $root.find('[data-name=pkey]');
      $hidePkey = $root.find('[data-name=hidePKey]');
      $error = $root.find('[data-name=error]');
      $success = $root.find('[data-name=success]');
      $contracts = $root.find('[data-name=contracts]');
      $url = $root.find('[data-name=url]');
      $url.val(url);

      $hidePkey.on('change', function() {
        $pkey.attr('type', $hidePkey.is(':checked') ? 'password' : 'text');
      });

      $root.keydown(function(e) { e.stopPropagation(); });
      $root.keyup(function(e) {
        e.stopPropagation();
        if (e.keyCode == 27) hide();
      });
    });

    dialog.on('show', function() {
      setFormDefaults();
      showContracts();
      $form.off('keypress');
      $pkey.focus();
      
      function setFormDefaults() {
        $pkey.attr('type', 'password');
        $pkey.val('');
        $hidePkey.prop('checked', true);
        $error.text('');
        $success.text('');
        $contracts.empty();
      }
      function showContracts() {
        async.parallel([
          sandbox.web3.sandbox.contracts.bind(sandbox.web3.sandbox),
          web3.eth.getGasPrice.bind(web3.eth),
        ], function(err, results) {
          if (err) return $error.text('Could not get contracts: ' + err.message);
          var contracts = results[0];
          var gasPrice = results[1].toString();
          var details = _.map(contracts, function(contract) {
            return {
              contract: contract,
              toSend: widgets('bool', true),
              value: widgets('uint256', 0),
              gasLimit: widgets(
                'uint256',
                Math.floor(parseInt(contract.gasUsed.substr(2), 16) * 1.1)
              ),
              gasPrice: widgets('uint256', gasPrice)
            };
          });
          _.each(details, function(contract) {
            var $html = $(contractHtml);
            $html.find('[data-name=name]').append(contract.contract.name);
            $html.find('[data-name=toSend]').append(contract.toSend.html());
            $html.find('[data-name=value]').append(contract.value.html());
            $html.find('[data-name=gasLimit]').append(contract.gasLimit.html());
            $html.find('[data-name=gasPrice]').append(contract.gasPrice.html());
            $contracts.append($html);
          });
          dialog.update([{ id: 'send', onclick: send.bind(null, details) }]);
          $form.keypress(function(e) {
            e.stopPropagation();
            if (e.keyCode == 13) {
              e.preventDefault();
              send(details);
            }
          });

          $url.off('change').on('change', updateUrl);

          function updateUrl() {
            $url.val($url.val().trim());
            if (!validate($url.val())) {
              $error.text('JSON RPC URL is not valid.');
            } else {
              $error.text('');
              url = $url.val();
              web3 = new Web3(new Web3.providers.HttpProvider(url));
              updateGasPrice();
            }

            function validate(val) {
              return /^(http|https):\/\/[^ ]+$/i.test(val);
            }
            function updateGasPrice() {
              web3.eth.gasPrice(function(err, gasPrice) {
                if (err)
                  return $error.text('Could not get gas price from ' + url + ': ' + err.message);
                _.each(details, function(contract) {
                  contract.gasPrice.setValue(gasPrice.toString());
                });
              });
            }
          }
        });
      }
    });

    function send(contracts) {
      $error.text('');
      $success.text('');

      var parsed = _(contracts)
          .filter(function(contract) {
            return contract.toSend.value();
          })
          .map(function(contract) {
            return {
              name: contract.contract.name,
              value: contract.value.value(),
              gasLimit: contract.gasLimit.value(),
              gasPrice: contract.gasPrice.value(),
              data: contract.contract.data
            };
          }).value();
      if (parsed.length === 0) {
        $error.text('No contracts were selected.');
        hasError = true;
      } else {
        var hasError = _.any(parsed, function(vals) {
          return vals.value === null || vals.gasLimit === null || vals.gasPrice == null;
        });
        
        if ($pkey.val() == '') {
          $error.text('Please, specify a private key or a seed phrase.');
          hasError = true;
        }
      }

      if (!hasError) {
        var pkey = processPkey($pkey.val());
        var address = utils.toAddress(pkey);

        disableSend(true);
        
        async.series([
          checkBalance,
          sendContracts
        ], function(err) {
          disableSend(false);
          if (err) $error.text(err);
          else hide();
        });
      }
      
      function processPkey(pkey) {
        if (pkey.match(/^[\dabcdef]{64}$/)) return '0x' + pkey;
        else if (!pkey.match(/^0x[\dabcdef]{64}$/)) return utils.sha3(pkey);
        return pkey;
      }
      function checkBalance(cb) {
        web3.eth.getBalance(address, function(err, balance) {
          if (err) return cb(err.message);
          var total = _.reduce(parsed, function(sum, vals) {
            return sum.plus(
              new BigNumber(vals.value).plus(
                new BigNumber(vals.gasLimit).times(new BigNumber(vals.gasPrice)))
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
        async.parallel([
          web3.eth.getTransactionCount.bind(web3.eth, address),
          web3.eth.getBlock.bind(web3.eth, 0, false)
        ], function(err, results) {
          if (err) return cb(err);
          var nonce = results[0];
          var genesis = results[1].hash;
          async.eachSeries(parsed, function(vals, cb) {
            var nextNonce = nonce++;
            web3.eth.sendRawTransaction(utils.createTx({
              nonce: nextNonce,
              value: vals.value,
              data: vals.data,
              gasLimit: vals.gasLimit,
              gasPrice: vals.gasPrice,
              pkey: pkey
            }), function(err, result) {
              if (err) return cb('Could not send ' + vals.name + ': ' + err.message);
              sentTxs.addTx({
                hash: result,
                contract: utils.calcNewAddress(address, nextNonce),
                web3: web3,
                net: nets[genesis]
              });
              cb();
            });
          }, cb);
        });
      }
      function disableSend(disable) {
        dialog.update([{ id: 'send', disabled: disable }]);
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
