define(function(require) {
  main.consumes = [
    'Dialog', 'ui', 'layout', 'commands', 'fs',
    'ethergit.sandbox', 'ethergit.libs',
    'ethergit.sandbox.config', 'ethergit.sent.txs.editor', 'ethereum-console'
  ];
  main.provides = ['ethergit.dialog.send.to.net'];
  return main;

  function main(options, imports, register) {
    var Dialog = imports.Dialog;
    var ui = imports.ui;
    var layout = imports.layout;
    var commands = imports.commands;
    var fs = imports.fs;
    var sandbox = imports['ethergit.sandbox'];
    var libs = imports['ethergit.libs'];
    var config = imports['ethergit.sandbox.config'];
    var sentTxs = imports['ethergit.sent.txs.editor'];
    var ethConsole = imports['ethereum-console'];

    var async = require('async');
    var utils = require('../utils');

    var url = 'http://peer-1.ether.camp:8082';

    var net = 'test';
    var nets = {
      test: {
        genesis: '0x34288454de81f95812b9e20ad6a016817069b13c7edc99639114b73efbc21368',
        api: 'https://test-state.ether.camp'
      },
      live: {
        genesis: '0xd4e56740f876aef8c010b86a40d5f56745a118d0906a34e69aec8c0db1cb8fa3',
        api: 'https://state.ether.camp'
      }
    };
    
    var $ = libs.jquery();
    var _ = libs.lodash();
    var Web3 = libs.web3();
    var web3 = new Web3(new Web3.providers.HttpProvider(url));

    var widgets = require('../ui/widgets')(_);

    var contractHtml = '<tr>' +
          '<td data-name="toSend" style="padding-top:15px"></td>' +
          '<td data-name="publish" style="padding-top:15px;min-width:85px"></td>' + 
          '<td data-name="name" style="padding-top:15px"></td>' +
          '<td data-name="value"></td>' +
          '<td data-name="gasLimit"></td>' +
          '<td data-name="gasPrice"></td>' +
          '</tr>';
    
    var $form, $pkey, $error, $success, $loadingContainer, $loading, $contracts, $url, $hidePkey;

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
//      ui.insertCss(require('text!./style.css'), false, dialog);
      
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
      $loadingContainer = $root.find('[data-name=loading-container]');
      $loading = $root.find('[data-name=loading]');
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
      $form.off('keypress');
      $pkey.focus();

      async.series([
        showContracts,
        updateNetworkDetails
      ], function(err) {
        loading(false);
        if (err) $error.text(err);
      });

      function setFormDefaults() {
        $pkey.attr('type', 'password');
        $pkey.val('');
        $hidePkey.prop('checked', true);
        $error.text('');
        $success.text('');
        $contracts.empty();
      }
      function showContracts(cb) {
        loading('Getting contracts');
        sandbox.web3.sandbox.contracts(function(err, contracts) {
          if (err) return cb('Could not get contracts: ' + err.message);
          var details = _.map(contracts, function(contract) {
            return {
              contract: contract,
              toSend: widgets('bool', true),
              publish: widgets('bool', true),
              value: widgets('uint256', 0),
              gasLimit: widgets(
                'uint256',
                Math.floor(parseInt(contract.gasUsed.substr(2), 16) * 1.1)
              ),
              gasPrice: widgets('uint256', 0)
            };
          });
          _.each(details, function(contract) {
            var $html = $(contractHtml);

            var $toSend = contract.toSend.html();
            var $publish = contract.publish.html();
            $toSend.change(function(e) {
              $publish.prop('disabled', !$toSend.is(':checked'));
            });

            $html.find('[data-name=name]').append(contract.contract.name);
            $html.find('[data-name=toSend]').append($toSend);
            $html.find('[data-name=publish]').append($publish);
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

          $url.off('change').on('change', updateNetworkDetails.bind(null, function(err) {
            loading(false);
            if (err) $error.text(err);
          }));

          cb();
        });
      }
      function updateNetworkDetails(cb) {
        loading('Updating network details');
        $url.val($url.val().trim());
        if (!validate($url.val())) return cb('JSON RPC URL is not valid.');

        $error.text('');
        url = $url.val();
        web3 = new Web3(new Web3.providers.HttpProvider(url));
        async.parallel([
          updateNetworkId,
          updateGasPrice
        ], cb);

        function validate(val) {
          return /^(http|https):\/\/[^ ]+$/i.test(val);
        }
        function updateNetworkId(cb) {
          web3.eth.getBlock(0, false, function(err, genesis) {
            if (err) return cb(err.message);
            net = _.findKey(nets, { genesis: genesis.hash });
            disableSourcePublish(!net);
            cb();
          });

          function disableSourcePublish(disable) {
            $contracts.find('tr').each(function(index, el) {
              var $el = $(el);
              if ($el.find('[data-name=toSend] input').is(':checked'))
                $el.find('[data-name=publish] input').prop('disabled', disable);
            });
          }
        }
        function updateGasPrice(cb) {
          web3.eth.getGasPrice(function(err, gasPrice) {
            if (err) return cb('Could not get gas price from ' + url + ': ' + err.message);
            $contracts.find('[data-name=gasPrice] input').val(gasPrice.toString());
            cb();
          });
        }
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
              data: contract.contract.data,
              root: contract.contract.root,
              sources: contract.contract.sources,
              publish: contract.publish.value()
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

        loading('Sending the contracts');
        
        async.series([
          checkBalance,
          sendContracts
        ], function(err) {
          loading(false);
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
              ' wei, but need ' + total.toString() + ' to create the contract(s).' :
              null
          );
        });
      }
      function sendContracts(cb) {
        web3.eth.getTransactionCount(address, 'pending', function(err, nonce) {
          if (err) return cb(err);
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
              var newAddress = utils.calcNewAddress(address, nextNonce);
              console.log(address, nextNonce, newAddress);
              sentTxs.addTx({
                hash: result,
                contract: newAddress,
                web3: web3,
                net: net,
                onMined: net && vals.publish ?
                  _.partial(waitForSync, _, net, uploadSources.bind(null, newAddress, vals, net)) :
                  null
              });
              cb();
            });
          }, cb);
        });
      }
      function waitForSync(txHash, net, cb) {
        async.retry({ times: 18, interval: 10000 }, checkTx, function(err) {
          if (err) {
            return ethConsole.logger(function(error, logger) {
              if (error) return console.error(error);
              logger.error('Could not get details of tx <pre>' + txHash + '</pre> from <pre>' + nets[net].api + '</pre>: ' + err);
            });
          }
          cb();
        });

        function checkTx(cb) {
          $.getJSON(nets[net].api + '/api/v1/transactions/' + txHash.substr(2))
            .done(function(data) { cb(null, data); })
            .fail(function(xhr, statusText) {
              if (xhr.readyState == 4) cb(statusText);
              else cb('Connection refused');
            });
        }
      }
      function uploadSources(address, details, net) {
        var data = new FormData();
        data.append('name', details.name);
        async.reduce(details.sources, {}, function(result, source, cb) {
          fs.readFile(details.root + source, function(err, content) {
            result[source] = content;
            cb(err, result);
          });
        }, function(err, sources) {
          if (err) {
            return ethConsole.logger(function(error, logger) {
              if (error) return console.error(error);
              logger.error('<pre>' + err + '</pre>');
            });
          }
          
          _.each(sources, function(content, filename) {
            var contract = new Blob([content], { type: 'plain/text' });
            data.append('contracts', contract, filename);
          });
          $.ajax({
            url: nets[net].api + '/api/v1/accounts/' + address.substr(2) + '/contract',
            data: data,
            cache: false,
            contentType: false,
            processData: false,
            type: 'POST',
            success: function(data) {
              if (!data.success) {
                ethConsole.logger(function(error, logger) {
                  if (error) return console.error(error);
                  logger.error('<pre>' + data.errorMessage + '</pre>');
                });
              }
            }
          });
        });
      }
    }
    
    function loading(message) {
      var loading = !!message;
      dialog.getElement('send').setAttribute('disabled', loading);
      if (loading) {
        $loading.text(message);
        $loadingContainer.show();
      } else $loadingContainer.hide();
    }
    
    function hide() {
      dialog.hide();
    }

    dialog.freezePublicAPI({});

    register(null, {
      'ethergit.dialog.send.to.net': dialog
    });
  }
});
