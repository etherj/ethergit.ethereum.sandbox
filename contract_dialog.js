define(function(require) {
  main.consumes = [
    'Dialog', 'ui', 'dialog.error',
    'ethergit.libs',
    'ethergit.ethereum.sandbox.dialog.pkey',
    'ethergit.sandbox',
    'ethergit.dialog.abi',
    'ethergit.sandbox.config'
  ];
  main.provides = ['ethergit.ethereum.sandbox.dialog.contract'];
  
  return main;
  
  function main(options, imports, register) {
    var Dialog = imports.Dialog;
    var ui = imports.ui;
    var showError = imports['dialog.error'].show;
    var libs = imports['ethergit.libs'];
    var pkeyDialog = imports['ethergit.ethereum.sandbox.dialog.pkey'];
    var sandbox = imports['ethergit.sandbox'];
    var abiDialog = imports['ethergit.dialog.abi'];
    var config = imports['ethergit.sandbox.config'];
    var async = require('async');
    var formatter = require('./formatter');
    var folder = require('./folder');
    var utils = require('./utils');

    var $ = libs.jquery();
    var _ = libs.lodash();

    var widgets = require('./ui/widgets')(_);

    // Cached elements
    var $root, $advanced, $sender, $value, $gasPrice, $gasLimit,
        $contract, $name, $showAbi, $methods;
    
    var dialog = new Dialog('Ethergit', main.consumes, {
      name: 'sandbox-contract',
      allowClose: true,
      title: 'Contract',
      width: 500,
      elements: [
        {
          type: 'button', id: 'closeContractDialog', color: 'blue',
          caption: 'Close', 'default': true, onclick: hide
        }
      ]
    });
    
    dialog.on('draw', function(e) {
      e.html.innerHTML = require('text!./contract.html');
      $root = $(e.html);
      $advanced = $root.find('[data-name=advanced]');
      $sender = $advanced.find('select[name=sender]');
      $value = $advanced.find('input[name=value]');
      $gasPrice = $advanced.find('input[name=gasPrice]');
      $gasLimit = $advanced.find('input[name=gasLimit]');
      $contract = $root.find('[data-name=contract]');
      $showAbi = $contract.find('[data-href=abi]');
      $name = $contract.find('[data-name=name]');
      $methods = $contract.find('[data-name=methods]');

      $contract.click(folder.foldOrUnfold);

      $root.keydown(function(e) { e.stopPropagation(); });
      $root.keyup(function(e) {
        e.stopPropagation();
        if (e.keyCode == 27) hide();
      });
      
      var showOrHideAdvanced = (function() {
        var $icon = $root.find('[data-name=advanced-btn-icon]');
        return function() {
          if ($advanced.is(":visible")) {
            $icon.removeClass('glyphicon-menu-down').addClass('glyphicon-menu-up');
            $advanced.slideUp({ duration: 500 });
          } else {
            $icon.removeClass('glyphicon-menu-up').addClass('glyphicon-menu-down');
            $advanced.slideDown({ duration: 500 });
          }
        };
      })();
      $root.find('[data-name=advanced-btn]').click(showOrHideAdvanced);
    });

    function showAdvanced() {
      if (!$advanced.is(":visible")) {
        $root.find('[data-name=advanced-btn-icon]')
          .removeClass('glyphicon-menu-up')
          .addClass('glyphicon-menu-down');
        $advanced.slideDown({ duration: 500 });
      }
    }

    function showContract(address) {
      dialog.show();
      
      async.parallel([ showAccounts, showContract ], function(err) {
        if (err) showError(err);
      });

      var defaultSender, gasPrice, gasLimit;
      function resetAdvanced() {
        $sender.children().each(function(idx, element) {
          var $element = $(element);
          if ($element.text() == 'defaultSender') {
            $element.attr('selected', 'selected');
          } else {
            $element.removeAttr('selected');
          }
        });
        $value.val(0);
        $gasPrice.val(gasPrice);
        $gasLimit.val(gasLimit);
      }

      function showAccounts(cb) {
        async.parallel({
          config: config.parse.bind(config),
          defaultAccount: sandbox.web3.sandbox.defaultAccount.bind(sandbox.web3.sandbox),
          addresses: sandbox.web3.eth.getAccounts.bind(sandbox.web3.eth)
        }, function(err, results) {
          if (err) return cb(err);

          var config = results.config,
              defaultAccount = results.defaultAccount,
              addresses = results.addresses;

          gasPrice = config.transaction.gasPrice;
          gasLimit = config.transaction.gasLimit;
          
          $sender.html(
            _.reduce(addresses, function(html, address) {
              return html + '<option>' + address + '</option>';
            }, '')
          );

          resetAdvanced();
          
          cb();
        });
      }

      function showContract(cb) {
        async.waterfall([ load, show ], cb);

        function load(cb) {
          sandbox.contracts(function(err, contracts) {
            if (!contracts.hasOwnProperty(address))
              return cb('Could not find a contract with address ' + address);
            cb(null, contracts[address]);
          });
        }
        function show(contractRaw, cb) {
          $showAbi.click(function(e) {
            e.preventDefault();
            abiDialog.showAbi(contractRaw);
          });

          var contract = sandbox.web3.eth.contract(contractRaw.abi).at(address);
          $name.text(contractRaw.name);
          $methods.empty();

          var argHtml = function(name, type, widget) {
            var $html = $(
              '<div class="form-group">\
              <label class="col-sm-4 control-label">' + name + ' : ' + type + '</label>\
              <div class="col-sm-8" data-name="field"></div>\
              </div>'
            );
            $html.find('[data-name=field]').append(widget.html());
            return $html;
          };
          var first = true;
          contractRaw.abi
            .filter(function(method) { return method.type === 'function'; })
            .forEach(function(method) {
              var $method = $(require('text!./contract_method.html'));
              $method.find('[data-name=name]').text(method.name);

              var argWidgets = {};
              var $args = $method.find('[data-name=args]');
              method.inputs.forEach(function(input) {
                argWidgets[input.name] = widgets(input.type);
                $args.append(argHtml(input.name, input.type, argWidgets[input.name]));
              });
              
              $method.find('[data-name=call]').click(function(e) {
                e.preventDefault();
                send();
              });
              $methods.append($method);

              if (first && method.inputs.length > 0) {
                argWidgets[method.inputs[0].name].focus();
                first = false;
              }

              $method.keypress(function(e) {
                // Workaround to support enter key in ace editor
                if (e.target.offsetParent.className.indexOf('ace_editor') != -1) return;
                
                e.stopPropagation();
                if (e.keyCode == 13) {
                  e.preventDefault();
                  send();
                }
              });

              function send() {
                var args = _.map(method.inputs, function(arg) {
                  return argWidgets[arg.name].value();
                });
                if (!_.some(args, _.isNull))
                  call(contract, method, args, $method);
              }
            });
          cb();
        }
        function call(contract, method, args, $method) {
          var $error = $method.find('[data-name=error]');
          $error.empty();
          var value = parse($value, 'value');
          var gasPrice = parse($gasPrice, 'gasPrice');
          var gasLimit = parse($gasLimit, 'gasLimit');

          if (value === null || gasPrice == null || gasLimit == null)
            return showAdvanced();
          
          function parse($from, name) {
            try {
              return parseInt($from.val());
            } catch (e) {
              $from.parent().parent().addClass('has-error');
              $advanced.find('[data-label=' + name + ']').text(e).show();
              return null;
            }
          }

          var sender = $sender.val();
          invoke();
          /*
            sandbox.predefinedAccounts(function(err, accounts) {
            if (err) return showError(err);
            if (accounts[sender]) invoke(accounts[sender]);
            else pkeyDialog.ask(sender, invoke);
            });
          */
          
          function invoke() {
            var $ret = $method.find('[data-name=ret]');
            var txHash;
            
            args.push({
              value: value,
              gas: gasLimit,
              gasPrice: gasPrice,
              from: sender
            });
            args.push(function(err, result) {
              if (err) $error.text(err.message);
              else {
                if (method.constant) {
                  $method.find('[data-name=ret]')
                    .text('Returned value: ' + result)
                    .parent().show();
                } else {
                  $method.find('[data-name=ret]').text(
                    'Waiting for mining of the transaction with hash ' + result
                  ).parent().show();
                  txHash = result;
                }
              }
            });
            if (!method.constant) watchBlocks();
            contract[method.name][getTypes(method.inputs)].apply(this, args);
            resetAdvanced();

            function watchBlocks() {
              var latestBlock = sandbox.web3.eth.filter('latest');
              latestBlock.watch(function(err, result) {
                if (!txHash) return;
                sandbox.web3.sandbox.receipt(txHash, function(err, receipt) {
                  if (err) console.error(err);
                  else if (!receipt) return;
                  else {
                    window.clearTimeout(timeout);
                    $ret.text('Returned value: ' + receipt.returnValue);
                  }
                });
              });
              var timeout = window.setTimeout(function() {
                latestBlock.stopWatching.bind(latestBlock);
                $ret.text('Got no transaction receipt in 5 secs');
              }, 10000);
            }
            function getTypes(inputs) {
              return _.map(inputs, 'type').join(',');
            }
          }
        }
      }
    }

    function toHex(val) {
      if (!/^\d+$/.test(val)) throw 'Should be a number';
      return utils.pad(parseInt(val, 10).toString(16));
    }
    
    function hide() {
      dialog.hide();
      $showAbi.off('click');
    }
    
    ui.insertCss(require('text!./contract.css'), false, dialog);
    
    dialog.freezePublicAPI({
      showContract: showContract
    });
    
    register(null, {
      'ethergit.ethereum.sandbox.dialog.contract': dialog
    });
  }
});
