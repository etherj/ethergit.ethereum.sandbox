define(function(require, exports, module) {
  main.consumes = ['Plugin', 'fs', 'ethergit.libs', 'ethergit.solidity.compiler'];
  main.provides = ['ethergit.sandbox.config'];
  return main;

  function main(options, imports, register) {
    var Plugin = imports.Plugin;
    var fs = imports.fs;
    var libs = imports['ethergit.libs'];
    var compiler = imports['ethergit.solidity.compiler'];

    var config = new Plugin('Ethergit', main.consumes);

    var async = require('async');
    var utils = require('./utils');

    var _ = libs.lodash();

    function parse(projectDir, cb) {
      async.waterfall([
        read,
        adjustValues,
        calcPrivateKeys
      ], cb);
      
      function read(cb) {
        fs.readFile(projectDir + '/ethereum.json', function(err, content) {
          if (err) return cb(err);
          try {
            var config = JSON.parse(utils.removeMetaInfo(content));
          } catch(e) {
            return cb('Could not parse ethereum.json: ' + e.message);
          }
          cb(null, config);
        });
      }
      function adjustValues(config, cb) {
        if (config.hasOwnProperty('plugins') && !_.isPlainObject(config.plugins)) {
          return cb('Field plugins has to be a map in ethereum.json');
        }
        
        if (!config.hasOwnProperty('env') || !config.env.hasOwnProperty('accounts') ||
            Object.keys(config.env).length === 0) {
          return cb('Please, add initial account(s) to ethereum.json');
        }

        if (!config.hasOwnProperty('contracts')) {
          return cb('Please, specify contracts directory in ethereum.json');
        }
        if (typeof config.contracts != 'string') {
          return cb('Field contracts in ethereum.json should be a string');
        }
        config.contracts = projectDir + config.contracts;
        if (!_.endsWith(config.contracts, '/')) config.contracts += '/';

        if (config.hasOwnProperty('deploy')) {
          if (!_.isArray(config.deploy)) return cb('Field deploy in ethereum.json should be an array');
          if (!_.all(config.deploy, _.isString)) return cb('Deploy array in ethereum.json should contain only strings');
        }
        
        try {
          adjustBlock();
        } catch (e) {
          return cb(e);
        }

        async.forEachOf(config.env.accounts, adjustAccount, _.partial(cb, _, config));

        function adjustBlock() {
          if (config.env.hasOwnProperty('block')) {
            var block = config.env.block;
            if (block.hasOwnProperty('coinbase')) {
              try {
                block.coinbase = parseAddress(block.coinbase);
              } catch (e) {
                throw 'Could not parse block.address: ' + e;
              }
            }
            
            _.each(
              ['difficulty', 'gasLimit', 'gasPrice'],
              function(field) {
                if (block.hasOwnProperty(field)) {
                  try {
                    block[field] = value(block[field]);
                  } catch (e) {
                    throw 'Could not parse block.' + field + ': ' + e;
                  }
                }
              }
            );
          }
        }
        function adjustAccount(account, address, cb) {
          try {
            parseAddress(address);

            if (account.hasOwnProperty('name') && typeof account.name != 'string')
              throw 'Account name must be a string';
            
            _.each(['balance', 'nonce'], function(field) {
              if (account.hasOwnProperty(field)) {
                try {
                  account[field] = value(account[field]);
                } catch (e) {
                  throw 'Could not parse account.' + field + ': ' + e;
                }
              }
            });
            if (account.hasOwnProperty('storage')) {
              account.storage = _(account.storage).map(function(val, key) {
                try {
                  var parsedKey = value(key);
                } catch (e) {
                  throw 'Could not parse key of storage entry: ' + e;
                }
                try {
                  return [parsedKey, value(val)];
                } catch (e) {
                  throw 'Could not parse value of storage entry: ' + e;
                }
              }).object().value();
            }
          } catch (e) {
            return cb(e);
          }
          if (account.hasOwnProperty('deploy')) {
            if (typeof account.deploy != 'object' ||
                !account.deploy.hasOwnProperty('contract') || typeof account.deploy.contract != 'string' ||
                !account.deploy.hasOwnProperty('source') || typeof account.deploy.source != 'string')
              return cb('deploy field of an account object should be an object with fields source and contract');
            
            compiler.binaryAndABI([account.deploy.source], projectDir, false, function(err, output) {
              if (err) return cb('Compilation error: ' + err.message);

              var contract = _.find(output.contracts, { name: account.deploy.contract });
              if (contract) {
                account.runCode = contract;
                cb();
              } else {
                cb('There is no contract ' + account.deploy.contract + ' in the file ' + account.deploy.source);
              }
            });
          } else cb();
        }
        function value(val) {
          var type = typeof val;
          var res;
          if (type === 'number') {
            res = '0x' + val.toString(16);
          } else if (type === 'string') {
            if (val.indexOf('0x') === 0) {
              res = val;
            } else if (/^\d+$/.test(val)) {
              res = '0x' + parseInt(val, 10).toString(16);
            } else {
              throw '"' + val + '" is not a decimal number (use 0x prefix for hexadecimal numbers)';
            }
          } else {
            throw 'Value should be either number or string';
          }
          return res;
        }
        function parseAddress(val) {
          if (typeof val !== 'string' || !val.match(/^0x[\dabcdef]{40}$/))
            throw 'Address should be a string with 0x prefix and 40 characters';
          return val;
        }
      }
      function calcPrivateKeys(config, cb) {
        try {
          _.each(config.env.accounts, function(account) {
            if (account.hasOwnProperty('pkey')) {
              if (typeof account.pkey != 'string') {
                throw 'Private key should be a hexadecimal hash (64 symbols) or a string';                            }
              if (!account.pkey.match(/^0x[\dabcdef]{64}$/)) {
                account.pkey = utils.sha3(account.pkey);
              }
            }
          });
        } catch (e) {
          return cb(e);
        }
        cb(null, config);
      }
    }
    
    config.freezePublicAPI({
      parse: parse
    });
    register(null, { 'ethergit.sandbox.config': config });
  }
});
