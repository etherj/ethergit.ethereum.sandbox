define(function(require, exports, module) {
  main.consumes = [
    'Plugin', 'ui', 'layout', 'fs', 'find', 'tabManager', 'commands', 'save',
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
      var $run = $widget.find('[data-name=run]');
      $run.click(function() {
        commands.exec(command, tabs.focussedTab.editor);
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
                enableButton();
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
                enableButton();
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
              enableButton();
              logger.error('<pre>' + err + '</pre>');
            }
            if (typeof cb === 'function') cb(err);
          });
        });
      }

      function disableButton() {
        $run.text('Processing...');
        $run.addClass('disabled');
      }

      function enableButton() {
        $run.text(runCommands[choosenCommand]);
        $run.removeClass('disabled');
      }
      
      sandbox.on('select', function() {
        if (sandbox.getId()) {
          $run.text(runCommands['stopSandbox']);
          $run.removeClass('stopped').addClass('started');
          command = 'stopSandbox';
        } else {
          $run.text(runCommands[choosenCommand]);
          $run.removeClass('started').addClass('stopped');
          command = choosenCommand;
        }
        $run.removeClass('disabled');
      });
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
        sandbox.start(config.env, cb);
      }
      function createContracts(config, contracts, cb) {
        async.eachSeries(contracts, function(contract, cb) {
          var ctor = _.findWhere(contract.abi, { type: 'constructor' });
          if (ctor && ctor.inputs.length > 0) {
            contractConstructorDialog.askArgs(contract, function(err, args) {
              if (err) cb(err);
              else sendTx(args);
            });
          } else sendTx([]);
          
          function sendTx(args) {
            args.push({ contract: contract, data: '0x' + contract.binary });
            args.push(function(err, contract) {
              if (err) cb(err);
              else if (contract.address) cb();
            });
            var newContract = sandbox.web3.eth.contract(contract.abi);
            newContract.new.apply(newContract, args);
          }
        }, cb);
      }
    }

    function stop(cb) {
      sandbox.stop(cb);
    }

    ui.insertCss(require('text!./sandbox_control.css'), false, control);
    
    register(null, { 'ethergit.sandbox.control': control });
  }
});
