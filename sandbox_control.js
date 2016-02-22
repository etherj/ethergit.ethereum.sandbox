define(function(require, exports, module) {
  main.consumes = [
    'Plugin', 'ui', 'layout', 'fs', 'find', 'tabManager', 'commands', 'save', 'settings',
    'ethergit.libs',
    'ethergit.sandbox',
    'ethergit.solidity.compiler',
    'ethereum-console',
    'ethergit.sandbox.config',
    'ethergit.dialog.contract.constructor'
  ];
  main.provides = ['ethergit.sandbox.control'];
  return main;

  function main(options, imports, register) {
    var Plugin = imports.Plugin;
    var ui = imports.ui;
    var layout = imports.layout;
    var fs = imports.fs;
    var find = imports.find;
    var tabs = imports.tabManager;
    var commands = imports.commands;
    var save = imports.save;
    var settings = imports.settings;
    var libs = imports['ethergit.libs'];
    var sandbox = imports['ethergit.sandbox'];
    var compiler = imports['ethergit.solidity.compiler'];
    var ethConsole = imports['ethereum-console'];
    var config = imports['ethergit.sandbox.config'];
    var contractConstructorDialog = imports['ethergit.dialog.contract.constructor'];

    var async = require('async');
    var utils = require('./utils');
    
    var $ = libs.jquery();
    var _ = libs.lodash();

    var control = new Plugin('Ethergit', main.consumes);
    
    control.on('load', function() {
      var runCommands = {
        'runAllContracts': 'Run All Contracts',
        'runCurrentContract': 'Run Active Contract',
        'stopSandbox': 'Stop Sandbox'
      };
      var choosenCommand = 'runAllContracts';
      var command = choosenCommand;
      
      ui.insertByIndex(
        layout.getElement('barTools'),
        '<application>' + require('text!./sandbox_control.html') + '</application>',
        320, control
      );

      var $widget = $('[data-name=startSandbox]');
      installTheme($widget);
      
      var $run = $widget.find('[data-name=run]');
      $run.click(function() {
        commands.exec(command, tabs.focussedTab ? tabs.focussedTab.editor : null);
      });

      $widget.find('[data-name=runAll]').click(function() {
        if (sandbox.getId()) stopSandbox(run);
        else run();
        
        function run() {
          choosenCommand = 'runAllContracts';
          commands.exec(choosenCommand, tabs.focussedTab.editor);
        }
      });

      $widget.find('[data-name=runCurrent]').click(function() {
        if (sandbox.getId()) stopSandbox(run);
        else run();
        
        function run() {
          choosenCommand = 'runCurrentContract';
          commands.exec(choosenCommand, tabs.focussedTab.editor);
        }
      });

      commands.addCommand({
        name: 'runAllContracts',
        exec: function() {
          disableButton();
          ethConsole.logger(function(err, logger) {
            if (err) return console.error(err);
            logger.clear();
            run(false, function(err) {
              if (err) {
                updateButton();
                logger.error('<pre>' + err + '</pre>');
              }
            });
          });
        }
      }, control);

      commands.addCommand({
        name: 'runCurrentContract',
        exec: function() {
          disableButton();
          ethConsole.logger(function(err, logger) {
            if (err) return console.error(err);
            logger.clear();
            run(true, function(err) {
              if (err) {
                updateButton();
                logger.error('<pre>' + err + '</pre>');
              }
            });
          });
        }
      }, control);

      commands.addCommand({
        name: 'stopSandbox',
        exec: stopSandbox
      }, control);

      function stopSandbox(cb) {
        disableButton();
        ethConsole.logger(function(err, logger) {
          if (err) return console.err(err);
          stop(function(err) {
            if (err) {
              updateButton();
              logger.error('<pre>' + err + '</pre>');
            }
            if (typeof cb === 'function') cb(err);
          });
        });
      }

      function disableButton() {
        $run.children().text('Processing...');
        $run.addClass('disabled');
      }

      sandbox.on('select', updateButton);
      function updateButton() {
        if (sandbox.getId()) {
          $run.children().text(runCommands['stopSandbox']);
          $run.removeClass('stopped').addClass('started');
          command = 'stopSandbox';
        } else {
          $run.children().text(runCommands[choosenCommand]);
          $run.removeClass('started').addClass('stopped');
          command = choosenCommand;
        }
        $run.removeClass('disabled');
      }

      function installTheme($el) {
        $el.addClass(settings.get('user/general/@skin'));
        settings.on('user/general/@skin', function(newTheme, oldTheme) {
          $el.removeClass(oldTheme).addClass(newTheme);
        }, control);
      }
    });

    function run(current, cb) {
      async.waterfall([
        saveAll,
        config.parse.bind(config),
        compileContracts.bind(null, current)
      ], function(err, params) {
        if (err) cb(err);
        else async.series([
          startSandbox.bind(this, params.config),
          createContracts.bind(this, params.config, params.contracts)
        ], cb);
      });

      function saveAll(cb) {
        save.saveAllInteractive(tabs.getTabs(), function(result) {
          cb(result === 0 ? 'Compilation has been canceled.' : null);
        });
      }

      function compileContracts(current, config, cb) {
        async.waterfall([
          getFiles.bind(null, current),
          compile
        ], function(err, contracts) {
          cb(err, { contracts: contracts, config: config });
        });

        function getFiles(current, cb) {
          if (current) {
            if (!tabs.focussedTab || tabs.focussedTab.editorType !== 'ace')
              cb('Focussed tab is not a text file');
            else {
              var path = tabs.focussedTab.path;
              if (!_.startsWith(path, config.contracts))
                cb('Contract should be placed in the directory ' + config.contracts);
              else
                cb(null, [path.substr(config.contracts.length)]);
            }
          } else findSolidityFiles(cb);
          
          function findSolidityFiles(cb) {
            find.findFiles({
              path: '',
              base: find.basePath + config.contracts,
              pattern : '*.sol',
              buffer  : true
            }, function(err, result) {
              var files = result.match(/.+(?=:)/g);
              cb(null, files ? files.map(function(path) { return path; }) : []);
            });
          }
        }
        function compile(files, cb) {
          if (files.length === 0) cb(null, []);
          else {
            compiler.binaryAndABI(files, config.contracts, function(err, compiled) {
              if (err) {
                if (err.type === 'SYNTAX') gotoLine(err);
                cb(err.message);
              }
              else cb(null, compiled);
            });
          }

          function gotoLine(err) {
            tabs.open({
              path: config.contracts + err.file,
              focus: true
            }, function(error, tab){
              if (error) console.error(error);
              else tab.editor.ace.gotoLine(err.line, err.column);
            });
          }
        }
      }

      function startSandbox(config, cb) {
        sandbox.start(config, cb);
      }
      function createContracts(config, contracts, cb) {
        async.eachSeries(contracts, deploy, cb);
        
        function deploy(contract, cb) {
          if (contract.address) cb();
          
          try {
            var libs = findLibs();
          } catch (err) {
            return cb(err);
          }
          
          if (libs.length != 0) {
            async.eachSeries(libs, deploy, function(err) {
              if (err) return cb(err);
              _.each(libs, function(lib) {
                putLibAddress(lib.name, lib.address);
              });
              deploy(contract, cb);
            });
          } else {
            var ctor = _.findWhere(contract.abi, { type: 'constructor' });
            if (ctor && ctor.inputs.length > 0) {
              contractConstructorDialog.askArgs(contract, function(err, args) {
                if (err) cb(err);
                else sendTx(args);
              });
            } else sendTx([]);
          }

          function findLibs() {
            var match, libs = [], libRe = /[^_]__(\w{36})__[^_]/g;
            while (match = libRe.exec(contract.binary)) {
              var lib = _.find(contracts, function(contract) {
                return match[1].indexOf(contract.name) != -1;
              });
              if (!lib) throw "There is not lib to link with " + match[1];
              libs.push(lib);
            }
            return libs;
          }
          function putLibAddress(name, address) {
            var placeholder = '__' + name + '__';
            placeholder = placeholder + _.repeat('_', 40 - placeholder.length);
            contract.binary = contract.binary.replace(placeholder, address.substr(2));
          }
          function sendTx(args) {
            var txHash;
            
            args.push({
              contract: contract,
              data: contract.binary.length == 0 ? '0x00' : '0x' + contract.binary,
              gas: config.transaction.gasLimit,
              gasPrice: config.transaction.gasPrice
            });
            args.push(function(err, newContract) {
              if (err) {
                // web3 doesn't check exceptions, so here's a workaround to show user an exception
                if (err.message === 'The contract code couldn\'t be stored, please check your gas amount.') {
                  sandbox.web3.sandbox.receipt(txHash, function(error, receipt) {
                    if (error) return cb(error);
                    if (receipt.exception) return cb('Exception in ' + contract.name + ' constructor: ' + receipt.exception);
                    else cb(err);
                  });
                } else cb(err);
              }
              else if (newContract.address) {
                contract.address = newContract.address;
                cb();
              }
              else txHash = newContract.transactionHash;
            });
            var newContract = sandbox.web3.eth.contract(contract.abi);
            newContract.new.apply(newContract, args);
          }
        }
      }
    }

    function stop(cb) {
      sandbox.stop(cb);
    }

    ui.insertCss(require('text!./sandbox_control.css'), false, control);
    
    register(null, { 'ethergit.sandbox.control': control });
  }
});
