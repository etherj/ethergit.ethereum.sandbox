define(function(require) {
  main.consumes = [
    'Dialog', 'fs', 'ui',
    'ethergit.solidity.compiler', 'ethergit.libs',
    'ethergit.sandbox', 'ethereum-console'
  ];
  main.provides = ['ethergit.dialog.scenario'];
  return main;

  function main(options, imports, register) {
    var Dialog = imports.Dialog;
    var fs = imports.fs;
    var ui = imports.ui;
    var libs = imports['ethergit.libs'];
    var sandbox = imports['ethergit.sandbox'];
    var ethConsole = imports['ethereum-console'];
    var compiler = imports['ethergit.solidity.compiler'];

    var $ = libs.jquery();
    var _ = libs.lodash();
    var yaml = libs.yaml();

    var async = require('async');
    var folder = require('../folder')(_);

    var scenarioName, $error, $name, $txs;

    var txTmpl = _.template(
      '<div>' +
        '<h4>Transaction <%= num %></h4>' +
        '<ul class="list-unstyled">' +
        '<li><strong>From:</strong> <%= from %></li>' +
        '<% if (to) { %><li><strong>To:</strong> <%= to %></li><% } %>' +
        '<li><strong>Value:</strong> <%= value %></li>' +
        '<% if (data) { %>' +
        '<li>' +
        '<strong>Data:</strong> ' +
        '<span data-folder class="long-string folder"><%= data %></span>' +
        '</li>' +
        '<% } %>' +
        '</ul>' +
        '</div>'
    );
    var contractCreationTmpl = _.template(
      '<div>' +
        '<h4>Transaction <%= num %></h4>' +
        '<ul class="list-unstyled">' +
        '<li><strong>From:</strong> <%= from %></li>' +
        '<li><strong>Value:</strong> <%= value %></li>' +
        '<li><strong>Contract name:</strong> <%= contract.name %></li>' +
        '<li><strong>Directory:</strong> <%= contract.dir %></li>' +
        '<li><strong>Sources:</strong> <%= contract.sources %></li>' +
        '<li><strong>Args:</strong> <%= contract.args %></li>' +
        '</ul>' +
        '</div>'
    );
    var methodCallTmpl = _.template(
      '<div>' +
        '<h4>Transaction <%= num %></h4>' +
        '<ul class="list-unstyled">' +
        '<li><strong>From:</strong> <%= from %></li>' +
        '<li><strong>To:</strong> <%= from %></li>' +
        '<li><strong>Value:</strong> <%= value %></li>' +
        '<li><strong>Method:</strong> <%= call %></li>' +
        '<li><strong>Args:</strong> <%= JSON.stringify(args) %></li>' +
        '</ul>' +
        '</div>'
    );
    
    var dialog = new Dialog('Ethergit', main.consumes, {
      name: 'ethergit-dialog-scenario',
      allowClose: true,
      title: 'Scenario',
      width: 600,
      elements: [
        {
          type: 'button', id: 'run', color: 'green',
          caption: 'Run', onclick: runScenario
        },
        {
          type: 'button', id: 'close', color: 'blue',
          caption: 'Close', 'default': true, onclick: hide
        }
      ]
    });

    dialog.on('load', function() {
      ui.insertCss(require('text!./style.css'), false, dialog);
    });

    dialog.on('draw', function(e) {
      e.html.innerHTML = require('text!./dialog.html');
      var $root = $(e.html);
      $error = $root.find('[data-name=error]');
      $name = $root.find('[data-name=name]');
      $txs = $root.find('[data-name=txs]');

      $txs.click(folder.handler);
      
      $root.keydown(function(e) { e.stopPropagation(); });
      $root.keyup(function(e) {
        e.stopPropagation();
        if (e.keyCode == 27) hide();
      });
    });

    function showScenario(name) {
      scenarioName = name;
      
      dialog.show();
      $error.empty();
      $txs.empty();
      $name.text(name);
      
      sandbox.web3.sandbox.getProjectDir(function(err, projectDir) {
        if (err) return $error.text(err);

        var file = projectDir + 'scenarios/' + name + '.yaml';
        fs.readFile(file, function(err, content) {
          if (err) return $error.text(err);
          try {
            var txs = yaml.safeLoad(content);
            var errors = validateScenario(txs);
            if (errors.length > 0) {
              $error.html(
                _.reduce(errors, function(html, error) {
                  return html + error + '<br/>';
                }, '')
              );
            } else {
              _.each(txs, function(tx, num) {
                var html;
                if (_.has(tx, 'contract')) {
                  html = contractCreationTmpl({
                    num: num + 1,
                    from: tx.from,
                    value: tx.value,
                    contract: {
                      name: tx.contract.name,
                      dir: tx.contract.dir,
                      sources: tx.contract.sources.join(', '),
                      args: JSON.stringify(tx.contract.args)
                    }
                  });
                } else if (_.has(tx, 'call')) {
                  html = methodCallTmpl({
                    num: num + 1,
                    from: tx.from,
                    to: tx.to,
                    value: tx.value,
                    call: tx.call,
                    args: tx.args
                  });
                } else {
                  html = txTmpl({
                    num: num + 1,
                    from: tx.from,
                    to: tx.to,
                    value: tx.value,
                    data: tx.data
                  });
                }
                $txs.append(html);
              });
              folder.init($txs);
            }
          } catch (e) {
            $error.html('<pre>' + e + '</pre>');
          }
        });
      });
    }

    function hide() {
      dialog.hide();
    }

    function runScenario() {
      $error.empty();

      sandbox.web3.sandbox.getProjectDir(function(err, projectDir) {
        if (err) return $error.text(err);

        var file = projectDir + 'scenarios/' + scenarioName + '.yaml';
        fs.readFile(file, function(err, content) {
          if (err) return $error.text(err);

          try {
            var txs = yaml.safeLoad(content);
            var errors = validateScenario(txs);
            if (errors.length > 0) {
              $error.html(
                _.reduce(errors, function(html, error) {
                  return html + error + '<br/>';
                }, '')
              );
            } else {
              ethConsole.logger(function(err, logger) {
                if (err) return console.error(err);
                logger.log('Running scenario <b>' + scenarioName + '</b>');
                async.eachSeries(txs, runTx.bind(null, projectDir), function(err) {
                  if (err) logger.error(err);
                  else logger.log('Scenario has been executed successfully');
                });
              });
            }
          } catch (e) {
            $error.html('<pre>' + e + '</pre>');
          }
        });
      });
    }

    function runTx(projectDir, params, cb) {
      if (_.has(params, 'contract')) {
        async.waterfall([
          compile,
          send
        ], cb);
      } else if (_.has(params, 'call')) {
        async.waterfall([
          getABI,
          call
        ], cb);
      } else {
        sandbox.web3.eth.sendTransaction(params, cb);
      }

      function compile(cb) {
        sandbox.web3.debug.getEnabled(function(err, enabled) {
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
          if (_.has(tx, 'call')) errors = validateMethodCall(tx, num);
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

    dialog.freezePublicAPI({
      'showScenario': showScenario
    });

    register(null, {
      'ethergit.dialog.scenario': dialog
    });
  }
});
