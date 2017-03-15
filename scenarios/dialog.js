define(function(require) {
  main.consumes = [
    'Dialog', 'ui', 'layout', 'commands', 'menus', 'Menu', 'fs', 'tree',
    'c9', 'dialog.confirm',
    'ethergit.libs', 'ethergit.sandbox', 'ethergit.dialog.scenario',
    'ethereum-console', 'ethergit.solidity.compiler'
  ];
  main.provides = ['ethergit.dialog.scenarios'];
  return main;

  function main(options, imports, register) {
    var Dialog = imports.Dialog;
    var ui = imports.ui;
    var layout = imports.layout;
    var commands = imports.commands;
    var menus = imports.menus;
    var Menu = imports.Menu;
    var fs = imports.fs;
    var tree = imports.tree;
    var c9 = imports.c9;
    var confirm = imports['dialog.confirm'].show;
    var libs = imports['ethergit.libs'];
    var sandbox = imports['ethergit.sandbox'];
    var scenarioDialog = imports['ethergit.dialog.scenario'];
    var ethConsole = imports['ethereum-console'];
    var compiler = imports['ethergit.solidity.compiler'];

    var async = require('async');
    
    var $ = libs.jquery();
    var _ = libs.lodash();
    var yaml = libs.yaml();

    var $scenarios, $error;

    var scenarioTmpl = _.template(
      '<li>' +
        '<a href="#" data-action="open" data-name="<%= name %>"><%= name %></a> ' +
        '<a href="#" data-action="run" data-name="<%= name %>" class="glyphicon glyphicon-play"></a> ' +
        '<a href="#" data-action="remove" data-name="<%= name %>" class="glyphicon glyphicon-remove"></a> ' +
        '</li>'
    );
    var dialog = new Dialog('Ethergit', main.consumes, {
      name: 'ethergit-dialog-scenarios',
      allowClose: true,
      title: 'Scenarios',
      width: 800,
      elements: [
        {
          type: 'button', id: 'close', color: 'blue',
          caption: 'Close', 'default': true, onclick: hide
        }
      ]
    });

    dialog.on('load', function() {
      commands.addCommand({
        name: 'showScenarios',
        exec: dialog.show.bind(dialog),
        isAvailable: function() {
          return !!sandbox.getId();
        }
      }, dialog);

      var btn = ui.insertByIndex(
        layout.getElement('barTools'),
        new ui.button({
          id: 'btnScenarios',
          skin: 'c9-toolbarbutton-glossy',
          command: 'showScenarios',
          caption: 'Scenarios',
          disabled: true
        }),
        440, dialog
      );

      if (!menus.get('Window/Ethereum').menu) {
        menus.addItemByPath('Window/~', new ui.divider(), 10300, dialog);
        menus.addItemByPath('Window/Ethereum', new Menu({}, dialog), 10320, dialog);
      }
      
      menus.addItemByPath(
        'Window/Ethereum/Scenarios',
        new ui.item({ command: 'showScenarios' }),
        180, dialog
      );

      sandbox.on('select', function() {
        btn.setAttribute('disabled', !sandbox.getId());
      });

      var ctxRunScenario = new ui.item({
        match: 'file',
        enabled: !c9.readonly,
        caption: 'Run Scenario',
        isAvailable: function() {
          if (!tree.selectedNode || tree.selectedNode.isFolder ||
              !_.endsWith(tree.selectedNode.path, '.yaml')) return false;

          if (sandbox.getId()) {
            var pathRx = RegExp('^' + sandbox.getProjectDir() + 'scenarios/[\\w\\s]+\\.yaml$');
            return pathRx.test(tree.selectedNode.path) && !sandbox.isDebugEnabled();
          } else return true;
        },
        onclick: function() {
          var scenario = tree.selected.substring(tree.selected.lastIndexOf('/') + 1, tree.selected.length - 5);
          if (sandbox.getId()) {
            runScenario(scenario, function(err) {
              if (err) log(err);
            });
          } else {
            sandbox.once('select', function() {
              runScenario(scenario, function(err) {
                if(err) log(err);
              });
            });
            commands.exec('startSandbox');
          }
        }
      });
      var ctxRunScenarioWithDebug = new ui.item({
        match: 'file',
        enabled: !c9.readonly,
        caption: 'Run Scenario with Debug',
        isAvailable: function() {
          if (!tree.selectedNode || tree.selectedNode.isFolder ||
              !_.endsWith(tree.selectedNode.path, '.yaml')) return false;

          if (sandbox.getId()) {
            var pathRx = RegExp('^' + sandbox.getProjectDir() + 'scenarios/[\\w\\s]+\\.yaml$');
            return pathRx.test(tree.selectedNode.path) && sandbox.isDebugEnabled();
          } else return true;
        },
        onclick: function() {
          var scenario = tree.selected.substring(tree.selected.lastIndexOf('/') + 1, tree.selected.length - 5);
          if (sandbox.getId()) {
            runScenario(scenario, function(err) {
              if (err) log(err);
            });
          } else {
            sandbox.once('select', function() {
              runScenario(scenario, function(err) {
                if(err) log(err);
              });
            });
            commands.exec('startSandboxDebug');
          }
        }
      });
      tree.getElement('mnuCtxTree', function(mnuCtxTree) {
        menus.addItemToMenu(mnuCtxTree, ctxRunScenario, 180, dialog);
        menus.addItemToMenu(mnuCtxTree, ctxRunScenarioWithDebug, 185, dialog);
      });
    });

    dialog.on('draw', function(e) {
      e.html.innerHTML = require('text!./dialog.html');
      var $root = $(e.html);
      $scenarios = $root.find('[data-name=scenarios]');
      $error = $root.find('[data-name=error]');

      $scenarios.click(function(e) {
        var $el = $(e.target);
        var action = $el.data('action');
        if (action) {
          e.preventDefault();
          if (action == 'open') {
            scenarioDialog.showScenario($el.data('name'));
          } else if (action == 'run') {
            $error.empty();
            runScenario($el.data('name'), function(err) {
              if (err) $error.html(err);
            });
          } else if (action == 'remove') {
            removeScenario($el.data('name'));
          }
        }
      });
      
      $root.keydown(function(e) { e.stopPropagation(); });
      $root.keyup(function(e) {
        e.stopPropagation();
        if (e.keyCode == 27) hide();
      });
    });

    dialog.on('show', function() {
      $scenarios.empty();
      $error.empty();
      
      sandbox.web3.sandbox.getProjectDir(function(err, projectDir) {
        if (err) return console.error(err);

        var scenariosDir = projectDir + 'scenarios/';
        
        fs.exists(scenariosDir, function(exists) {
          if (!exists) {
            $error.text('There is no directory ' + scenariosDir);
            return;
          }
            
          fs.readdir(scenariosDir, function(err, files) {
            if (err) return console.error(err);
            files = _.filter(files, function(file) {
              return _.endsWith(file.name, '.yaml');
            });
            async.map(files, function(file, cb) {
              fs.readFile(scenariosDir + file.name, function(err, content) {
                if (err) return cb(err);
                cb(null, {
                  name: file.name.substr(0, file.name.length - 5),
                  content: content
                });
              });
            }, function(err, scenarios) {
              if (err) return $error.text(err);
              _.each(scenarios, function(scenario) {
                $scenarios.append(scenarioTmpl({
                  name: scenario.name
                }));
              });
            });
          });
        });
      });
    });
    
    function hide() {
      dialog.hide();
    }

    function runScenario(name, cb) {
      sandbox.web3.sandbox.getProjectDir(function(err, projectDir) {
        if (err) return cb(err);

        var file = projectDir + 'scenarios/' + name + '.yaml';
        fs.readFile(file, function(err, content) {
          if (err) return cb(err);

          try {
            var txs = yaml.safeLoad(content);
            var errors = validateScenario(txs);
            if (errors.length > 0) {
              cb(_.reduce(errors, function(html, error) {
                return html + error + '<br/>';
              }, ''));
            } else {
              // set tx ids
              var id = 0;
              txs.each(function(tx) {
                tx.id = ++id;
              });
              ethConsole.logger(function(err, logger) {
                if (err) return console.error(err);
                logger.log('Running scenario <b>' + name + '</b>');
                async.eachSeries(txs, runTx.bind(null, projectDir, logger), function(err) {
                  if (err) logger.error(err);
                  else logger.log('Scenario has been executed successfully');
                });
              });
            }
          } catch (e) {
            cb('<pre>' + e + '</pre>');
          }
        });
      });
    }

    function removeScenario(name) {
      $error.empty();

      confirm(
        'Remove ' + name + '?',
        '',
        'Do you want to remove the scenario ' + name + '?',
        function() {
          sandbox.web3.sandbox.getProjectDir(function(err, projectDir) {
            if (err) return $error.text(err);
            var file = projectDir + 'scenarios/' + name + '.yaml';
            fs.rmfile(file, function(err) {
              if (err) return $error.text(err);
              $scenarios.find('[data-name=' + name + ']').parent().remove();
            });
          });
        }
      );
    }

    function runTx(projectDir, logger, params, cb) {
      if (_.has(params, 'contract')) {
        async.waterfall([
          compile,
          send
        ], function(err, txHash) {
          if (err) cb(err); 
          else onTxHash(txHash, cb);
        });
      } else if (_.has(params, 'call')) {
        async.waterfall([
          getABI,
          call
        ], function(err, txHash) {
          if (err) cb(err); 
          else onTxHash(txHash, cb);
        });
      } else {
        sandbox.web3.eth.sendTransaction(params, function(err, txHash) {
          if (err) cb(err);
          else onTxHash(txHash, cb);
        });
      }

      function onTxHash(hash, cb) {
        var ticks = 0;
        var cleared = false;
        var timer = setInterval(function() {
          sandbox.web3.sandbox.receipt(hash, function(err, receipt) {

            if (cleared) return;

            if (err) {
              cb(err);
              clearInterval(timer);
              cleared = true;
              return;
            }

            if (receipt) {
              
              clearInterval(timer);
              cleared = true;

              if (receipt.exception) {
                cb('Transaction ' + params.id + ' got exception: ' + receipt.exception);
              } else {
                logger.log('Transaction ' + params.id + ' mined');
                cb();
              }
            }

            if (++ticks > 30) {
              clearInterval(timer);
              cleared = true;
              cb('Transaction ' + params.id  + ' exceeded waiting timeout');
            }

          })
        }, 300);
      }

      function compile(cb) {
        sandbox.isDebugEnabled(function(err, enabled) {
          if (err) return cb(err);
          compiler.binaryAndABI(
            params.contract.sources,
            projectDir + params.contract.dir,
            enabled,
            function(err, output) {
              if (err) {
                cb('<pre>' + err.message + '</pre>');
              } else {
                cb(null, output.contracts);
              }
            }
          );
        });
      }
      function send(contracts, cb) {
        var contract = _.find(contracts, { name: params.contract.name });
        if (!contract) return cb('Could not find the contract ' + params.contract.name);

        deploy(contract, cb);

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
          } else sendTx(params.contract.args, cb);

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
          function sendTx(args, cb) {
            var txHash;

            contract.args = _.clone(args);

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
                    if (receipt.exception) cb('Exception in ' + contract.name + ' constructor: ' + receipt.exception);
                    else cb('Contract ' + contract.name + ' has no code.');
                  });
                } else cb(err);
              }
              else if (newContract.address) {
                contract.address = newContract.address;
                cb(null, txHash);
              }
              else txHash = newContract.transactionHash;
            });
            var newContract = sandbox.web3.eth.contract(contract.abi);
            newContract.new.apply(newContract, args);
          }
        }
      }
      function getABI(cb) {
        sandbox.web3.sandbox.contract(params.to, function(err, contract) {
          if (err) cb(err);
          else if (contract) cb(null, contract.abi);
          else cb('Could not find contract details for address ' + params.to);
        });
      }
      function call(abi, cb) {
        var methodName = params.call.substr(0, params.call.indexOf('('));
        var methodInputs = params.call.substring(params.call.indexOf('(') + 1, params.call.length - 1);
        var contract = sandbox.web3.eth.contract(abi).at(params.to);
        var method = contract[methodName];
        if (method) method = method[methodInputs];
        if (!method) return cb('Could not find a method with signature ' + params.call);

        var args = _.clone(params.args);
        args.push(params);
        args.push(cb);
        method.apply(contract, args);
      }
    }

    function validateScenario(scenario) {
      if (!_.isArray(scenario))
        return ['Scenario must be an array of objects with details of its transactions.'];

      return _(scenario)
        .map(function(tx, num) {
          num++;
          var errors;
          if (_.has(tx, 'contract')) errors = validateContractCreation(tx, num);
          else if (_.has(tx, 'call')) errors = validateMethodCall(tx, num);
          else errors = validateTx(tx, num);
          return errors;
        })
        .flatten()
        .value();

      function validateTx(tx, num) {
        var errors = [];
        if (!_.has(tx, 'from')) {
          errors.push('Transaction ' + num + ' must have a field [from]');
        } else if (!isAddress(tx.from)) {
          errors.push('Transaction ' + num + ' must contain an address in the field [from]');
        }
        if (_.has(tx, 'to') && !_.isNull(tx.to) && !isAddress(tx.to)) {
          errors.push('Transaction ' + num + ' must contain an address in the field [to]');
        }
        if (_.has(tx, 'value') && !_.isNull(tx.value) && !isNumber(tx.value)) {
          errors.push('Transaction ' + num + ' must contain a number in the field [value]');
        }
        if (_.has(tx, 'data') && !_.isNull(tx.data) && !isHex(tx.data)) {
          errors.push('Transaction ' + num + ' must contain a hex-data in the field [data]');
        }
        return errors;
      }
      function validateContractCreation(tx, num) {
        var errors = [];
        if (!_.has(tx, 'from')) {
          errors.push('Transaction ' + num + ' must have a field [from]');
        } else if (!isAddress(tx.from)) {
          errors.push('Transaction ' + num + ' must contain an address in the field [from]');
        }
        if (_.has(tx, 'to') && !_.isNull(tx.to)) {
          errors.push('Transaction ' + num + ' must contain null in the field [to]');
        }
        if (_.has(tx, 'value') && !_.isNull(tx.value) && !isNumber(tx.value)) {
          errors.push('Transaction ' + num + ' must contain a number in the field [value]');
        }
        if (!_.has(tx, 'contract') || !_.isObject(tx.contract)) {
          errors.push('Transaction ' + num + ' must contain an object in the field [contract]');
        }
        if (!_.has(tx.contract, 'name') || !_.isString(tx.contract.name)) {
          errors.push('Transaction ' + num + ' must contain a string in the field [contract.name]');
        }
        if (!_.has(tx.contract, 'dir') || !_.isString(tx.contract.dir)) {
          errors.push('Transaction ' + num + ' must contain a string in the field [contract.dir]');
        }
        if (!_.has(tx.contract, 'sources') || !_.isArray(tx.contract.sources) ||
            !_.all(tx.contract.sources, _.isString)) {
          errors.push('Transaction ' + num + ' must contain an array of strings in the field [contract.sources]');
        }
        if (!_.has(tx.contract, 'args') || !_.isArray(tx.contract.args)) {
          errors.push('Transaction ' + num + ' must contain an array in the field [contract.args]');
        }
        return errors;
      }
      function validateMethodCall(tx, num) {
        var errors = [];
        if (!_.has(tx, 'from')) {
          errors.push('Transaction ' + num + ' must have a field [from]');
        } else if (!isAddress(tx.from)) {
          errors.push('Transaction ' + num + ' must contain an address in the field [from]');
        }
        if (!_.has(tx, 'to') || !isAddress(tx.to)) {
          errors.push('Transaction ' + num + ' must contain an address in the field [to]');
        }
        if (_.has(tx, 'value') && !_.isNull(tx.value) && !isNumber(tx.value)) {
          errors.push('Transaction ' + num + ' must contain a number in the field [value]');
        }
        if (!_.has(tx, 'call') || !_.isString(tx.call)) {
          errors.push('Transaction ' + num + ' must contain a string in the field [call]');
        }
        if (!_.has(tx, 'args') || !_.isArray(tx.args)) {
          errors.push('Transaction ' + num + ' must contain an array in the field [args]');
        }
        return errors;
      }
      function isAddress(str) {
        return /^0x[\dabcdef]{40}$/.test(str.toLowerCase());
      }
      function isNumber(value) {
        return _.isNumber(value) || /^0x[\dabcdef]+$/.test(value.toLowerCase());
      }
      function isHex(value) {
        return /^0x[\dabcdef]+$/.test(value.toLowerCase());
      }
    }

    function log(message) {
      ethConsole.logger(function(err, logger) {
        if (err) console.error(err);
        else logger.error(message);
      });
    }

    dialog.freezePublicAPI({});

    register(null, {
      'ethergit.dialog.scenarios': dialog
    });
  }
});
