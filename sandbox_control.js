define(function(require, exports, module) {
  main.consumes = [
    'Plugin', 'ui', 'layout', 'fs', 'find', 'tabManager', 'commands', 'save',
    'settings', 'tree', 'menus', 'debugger',
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
    var workspace = imports.tree;
    var menus = imports.menus;
    var debug = imports['debugger'];
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
        'runAllContractsDebug': 'Run All with Debug',
        'runCurrentContractDebug': 'Run Active with Debug',
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

      $widget.find('[data-name=runAllDebug]').click(function() {
        if (sandbox.getId()) stopSandbox(run);
        else run();
        
        function run() {
          choosenCommand = 'runAllContractsDebug';
          commands.exec(choosenCommand, tabs.focussedTab.editor);
        }
      });

      $widget.find('[data-name=runCurrentDebug]').click(function() {
        if (sandbox.getId()) stopSandbox(run);
        else run();
        
        function run() {
          choosenCommand = 'runCurrentContractDebug';
          commands.exec(choosenCommand, tabs.focussedTab.editor);
        }
      });

      commands.addCommand({
        name: 'runAllContracts',
        bindKey: 'F7',
        exec: function() {
          disableButton();
          ethConsole.logger(function(err, logger) {
            if (err) return console.error(err);
            logger.clear();
            run(false, false, function(err) {
              if (err) {
                updateButton();
                logger.error('Could not start sandbox: ' + getErrorMessage(err));
              }
            });
          });
        },
        isAvailable: function(editor) {
          return !sandbox.getId();
        }
      }, control);

      commands.addCommand({
        name: 'runCurrentContract',
        bindKey: { 
          mac: 'Command-F7', 
          win: 'Ctrl-F7'
        },
        exec: function() {
          disableButton();
          ethConsole.logger(function(err, logger) {
            if (err) return console.error(err);
            logger.clear();
            run(true, false, function(err) {
              if (err) {
                updateButton();
                logger.error(err);
              }
            });
          });
        },
        isAvailable: function(editor) {
          return !sandbox.getId();
        }
      }, control);

      commands.addCommand({
        name: 'runAllContractsDebug',
        bindKey: 'Shift-F7',
        exec: function() {
          disableButton();
          ethConsole.logger(function(err, logger) {
            if (err) return console.error(err);
            logger.clear();
            run(false, true, function(err) {
              if (err) {
                updateButton();
                logger.error(err);
              }
            });
          });
        },
        isAvailable: function(editor) {
          return !sandbox.getId();
        }
      }, control);

      commands.addCommand({
        name: 'runCurrentContractDebug',
        bindKey: { 
          mac: 'Shift-Command-F7', 
          win: 'Shift-Ctrl-F7'
        },
        exec: function() {
          disableButton();
          ethConsole.logger(function(err, logger) {
            if (err) return console.error(err);
            logger.clear();
            run(true, true, function(err) {
              if (err) {
                updateButton();
                logger.error('Could not start sandbox: ' + getErrorMessage(err));
              }
            });
          });
        },
        isAvailable: function(editor) {
          return !sandbox.getId();
        }
      }, control);

      commands.addCommand({
        name: 'stopSandbox',
        exec: stopSandbox,
        bindKey: { 
          mac: 'Alt-F7', 
          win: 'Alt-F7'
        },
        isAvailable: function(editor) {
          return !!sandbox.getId();
        }
      }, control);

      function stopSandbox(cb) {
        disableButton();
        ethConsole.logger(function(err, logger) {
          if (err) return console.err(err);
          stop(function(err) {
            if (err) {
              updateButton();
              logger.error(err);
            }
            debug.stop();
            if (typeof cb === 'function') cb(err);
          });
        });
      }

      menus.addItemByPath('Run/Run All Contracts', new ui.item({ command: 'runAllContracts' }), 1280, control);
      menus.addItemByPath('Run/Run Active Contract', new ui.item({ command: 'runCurrentContract' }), 1290, control);
      menus.addItemByPath('Run/Run All Contracts with Debug', new ui.item({ command: 'runAllContractsDebug' }), 1292, control);
      menus.addItemByPath('Run/Run Active Contract with Debug', new ui.item({ command: 'runCurrentContractDebug' }), 1294, control);
      menus.addItemByPath('Run/Stop Sandbox', new ui.item({ command: 'stopSandbox' }), 1296, control);

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

      function getErrorMessage(err) {
        if (typeof err == 'string') return err;
        if (err.message) return err.message;
        if (err.target) {
          if (err.target.status == 0) return 'Sandbox is not available';
          else return err.target.status + ' - ' + err.target.statusText;
        }
        console.error(err);
        return 'Unknown error';
      }
    });

    function run(current, withDebug, cb) {
      var selected = workspace.selected;
      var selectProjectMsg = 'Please, select a project to run in the workspace panel. Project directory has to be placed in the workspace directory.';
      var noProjectMsg = 'Could not find any project with ethereum.json in the workspace directory.';

      async.waterfall([
        findProjectDir,
        getProjectName,
        saveAll,
        function(results, cb) {
          config.parse(results.projectDir, withDebug, function(err, config) {
            if (err) return cb(err);
            results.config = config;
            cb(null, results);
          });
        },
        compileContracts
      ], function(err, params) {
        if (err) cb(err);
        else async.series([
          startSandbox.bind(this, params.projectName, params.projectDir, withDebug, params.config),
          startDebugger,
          createAccounts.bind(this, params.config),
          createContracts.bind(this, params.config, params.contracts)
        ], cb);
      });

      function findProjectDir(cb) {
        if (current) {
          try {
            var project = getProjectPath(tabs.focussedTab);
            if (selected.indexOf(project) < 0) workspace.select(project);
            cb(null, { projectDir: project });
          } catch (e) {
            return cb(e);
          }
        } else {
          if (!selected || selected == '/') return selectFirstProject(cb);

          var match = /^\/[^\/]+/.exec(selected);
          if (!match) return selectFirstProject(cb);
          
          var projectDir = match[0];
          
          fs.stat(projectDir, function(err, data) {
            if (err) {
              console.error(err);
              return cb(err);
            }
            if (!/(folder|directory)$/.test(data.mime)) return selectFirstProject(cb);
            cb(null, { projectDir: projectDir + '/' });
          });
        }
      }

      function getProjectPath(tab) {
        if (!tab || tab.editorType !== 'ace') throw 'Focussed tab is not a text file';
        var match = /^\/[^\/]+\//.exec(tab.path);
        if (!match) throw 'Active file is not in a project directory';
        return match[0];
      }

      function selectFirstProject(cb) {
        fs.readdir('/', function(err, files) {
          if (err) return cb();
          var dirs = _(files)
                .filter(isDirectory)
                .filter(isNotHidden)
                .value();
          async.detect(dirs, hasEthereumJson, function(dir) {
            if (dir) {
              workspace.select('/' + dir.name);
              cb(selectProjectMsg);
            } else {
              cb(noProjectMsg);
            }
          });
        });

        function isDirectory(stat) {
          return /(folder|directory)$/.test(stat.mime);
        }
        function isNotHidden(stat) {
          return stat.name.charAt(0) != '.';
        }
        function hasEthereumJson(stat, cb) {
          fs.readdir('/' + stat.name, function(err, files) {
            if (err) {
              console.error(err);
              return cb();
            }
            cb(_.where(files, { name: 'ethereum.json' }).length != 0);
          });
        }
      }

      function getProjectName(results, cb) {
        results.projectName = results.projectDir.substr(1, results.projectDir.length - 2);
        cb(null, results);
      }

      function saveAll(results, cb) {
        save.saveAllInteractive(tabs.getTabs(), function(result) {
          cb(result === 0 ? 'Compilation has been canceled.' : null, results);
        });
      }

      function compileContracts(results, cb) {
        async.waterfall([
          getFiles.bind(null, current),
          compile
        ], function(err, contracts) {
          results.contracts = contracts;
          cb(err, results);
        });

        function getFiles(current, cb) {
          if (current) {
            if (!tabs.focussedTab || tabs.focussedTab.editorType !== 'ace')
              cb('Focussed tab is not a text file');
            else {
              var path = tabs.focussedTab.path;
              if (!_.startsWith(path, results.config.contracts))
                cb('Active file should be placed in the directory ' + results.config.contracts);
              else
                cb(null, [path.substr(results.config.contracts.length)]);
            }
          } else findSolidityFiles(cb);
          
          function findSolidityFiles(cb) {
            find.findFiles({
              path: '',
              base: find.basePath + results.config.contracts,
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
            compiler.binaryAndABI(files, results.config.contracts, withDebug, function(err, output) {
              if (err) {
                if (err.type === 'SYNTAX') gotoLine(err);
                cb('<pre>' + err.message + '</pre>');
              } else {
                if (output.warnings) {
                  ethConsole.logger(function(err, logger) {
                    if (err) console.error(err);
                    else logger.error('<pre>' + output.warnings + '</pre>');
                  });
                }
                cb(null, output.contracts);
              }
            });
          }

          function gotoLine(err) {
            tabs.open({
              path: results.config.contracts + err.file,
              focus: true
            }, function(error, tab){
              if (error) console.error(error);
              else tab.editor.ace.gotoLine(err.line, err.column);
            });
          }
        }
      }

      function startSandbox(projectName, projectDir, debug, config, cb) {
        sandbox.start(projectName, projectDir, debug, config, cb);
      }
      function startDebugger(cb) {
        if (withDebug) {
          var process = {
            name: 'ethereum-sandbox',
            web3: sandbox.web3,
            runner: {
              'debugger': 'solidity'
            },
            STARTED: 1,
            running: 1,
            meta: {},
            on: function(event, cb) {}
          };
          debug.debug(process, false, function(err) {
            if (err) return cb('Could not start a debugger: ' + err);
            else {
              console.log('debugger has been started');
              cb();
            }
          });
        } else cb();
      }
      function createAccounts(config, cb) {
        sandbox.web3.sandbox.createAccounts(config.env.accounts, cb);
      }
      function createContracts(config, contracts, cb) {
        if (config.deploy) {
          async.eachSeries(config.deploy, function(name, cb) {
            var contract = _.find(contracts, { name: name });
            if (!contract) return cb('Could not find the contract ' + name);
            deploy(contract, cb);
          }, cb);
        } else {
          async.eachSeries(contracts, deploy, cb);
        }
        
        function deploy(contract, cb) {
          if (contract.address) return cb();
          
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
              if (_.some(libs, matchName.bind(null, match[1]))) continue;
              
              var lib = _.find(contracts, matchName.bind(null, match[1]));
              if (!lib) throw "There is no lib to link with " + match[1];
              libs.push(lib);
            }
            return libs;
            
            function matchName(nameWithUnderscores, lib) {
              var name = lib.name;
              if (name.length > 36) name = name.substr(0, 36);
              else if (name.length < 36) name += _.repeat('_', 36 - name.length);
              return nameWithUnderscores == name;
            }
          }
          function putLibAddress(name, address) {
            if (name.length > 36) name = name.substr(0, 36);
            var placeholder = '__' + name + '__';
            placeholder = placeholder + _.repeat('_', 40 - placeholder.length);
            var re = new RegExp(placeholder, 'g');
            contract.binary = contract.binary.replace(re, address.substr(2));
          }
          function sendTx(args) {
            var txHash;

            args.push({
              contract: contract,
              data: contract.binary.length == 0 ? '0x00' : '0x' + contract.binary
            });
            args.push(function(err, newContract) {
              if (err) {
                // web3 doesn't check exceptions, so here's a workaround to show user an exception
                if (err.message === 'The contract code couldn\'t be stored, please check your gas amount.') {
                  sandbox.web3.sandbox.receipt(txHash, function(error, receipt) {
                    if (error) return cb(error);
                    if (receipt.exception) log('Exception in ' + contract.name + ' constructor: ' + receipt.exception);
                    else log('Contract ' + contract.name + ' has no code.');
                    cb();
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

    function log(message) {
      ethConsole.logger(function(err, logger) {
        if (err) console.error(err);
        else logger.error(message);
      });
    }

    ui.insertCss(require('text!./sandbox_control.css'), false, control);
    
    register(null, { 'ethergit.sandbox.control': control });
  }
});
