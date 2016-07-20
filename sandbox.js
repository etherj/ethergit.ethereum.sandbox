define(function(require, exports, module) {
  main.consumes = ['Plugin', 'http', 'dialog.error', 'ethergit.libs'];
  main.provides = ['ethergit.sandbox'];
  return main;

  function main(options, imports, register) {
    this.version = JSON.parse(require('text!./package.json')).version;
    
    var Plugin = imports.Plugin;
    var http = imports.http;
    var showError = imports['dialog.error'].show;
    var libs = imports['ethergit.libs'];
    
    var async = require('async');
    var utils = require('./utils');
    var Contract = require('./contract');

    var Web3 = libs.web3();
    var _ = libs.lodash();
    var web3Formatters = libs.formatters();

    var formatter = require('./formatter')(_);

    var web3 = new Web3();

    var plugin = new Plugin('Ethergit', main.consumes);
    var emit = plugin.getEmitter();
    var id, pinnedId = null, filters = {};
    var sandboxUrl = '//' + window.location.hostname + ':8555/sandbox/';

    web3._extend({
      property: 'sandbox',
      methods: [
        new web3._extend.Method({
          name: 'createAccounts',
          call: 'sandbox_createAccounts',
          params: 1
        }),
        new web3._extend.Method({
          name: 'addAccounts',
          call: 'sandbox_addAccounts',
          params: 1
        }),
        new web3._extend.Method({
          name: 'setBlock',
          call: 'sandbox_setBlock',
          params: 1
        }),
        new web3._extend.Method({
          name: 'defaultAccount',
          call: 'sandbox_defaultAccount',
          params: 0
        }),
        new web3._extend.Method({
          name: 'accounts',
          call: 'sandbox_accounts',
          params: 1
        }),
        new web3._extend.Method({
          name: 'runTx',
          call: 'sandbox_runTx',
          params: 1
        }),
        new web3._extend.Method({
          name: 'contracts',
          call: 'sandbox_contracts',
          params: 0
        }),
        new web3._extend.Method({
          name: 'transactions',
          call: 'sandbox_transactions',
          params: 0
        }),
        new web3._extend.Method({
          name: 'receipt',
          call: 'sandbox_receipt',
          params: 1
        }),
        new web3._extend.Method({
          name: 'setProjectName',
          call: 'sandbox_setProjectName',
          params: 1
        }),
        new web3._extend.Method({
          name: 'setBreakpoint',
          call: 'sandbox_setBreakpoint',
          params: 2
        })
      ],
      properties: [
        new web3._extend.Property({
          name: 'id',
          getter: 'sandbox_id'
        }),
        new web3._extend.Property({
          name: 'gasLimit',
          getter: 'sandbox_gasLimit',
          outputFormatter: web3Formatters.outputBigNumberFormatter
        }),
        new web3._extend.Property({
          name: 'projectName',
          getter: 'sandbox_projectName'
        })
      ]
    });

    function select(sandboxId) {
      pinnedId = null;
      if (id) {
        _.invoke(filters, 'stopWatching');
        connectionWatcher.stop();
      }
      if (sandboxId != id) {
        id = sandboxId;
        if (id) {
          web3.setProvider(new Web3.providers.HttpProvider(sandboxUrl + id));
          setDefaultAccount();
          setupFilters();
          connectionWatcher.start();
        }
        emit('select');
      }
    }
    
    function start(projectName, config, cb) {
      var accounts = _(config.env.accounts)
          .pairs()
          .filter(function(account) {
            return account[1].hasOwnProperty('pkey');
          })
          .reduce(function(result, account) {
            result[account[0]] = {
              pkey: account[1].pkey,
              'default': account[1]['default']
            };
            return result;
          }, {});
      
      async.series([
        create,
        function(cb) {
          web3.setProvider(
            new Web3.providers.HttpProvider(sandboxUrl + id)
          );
          cb();
        },
        web3.sandbox.setProjectName.bind(web3.sandbox, projectName),
        web3.sandbox.setBlock.bind(web3.sandbox, config.env.block),
        web3.sandbox.createAccounts.bind(web3.sandbox, config.env.accounts),
        web3.sandbox.addAccounts.bind(web3.sandbox, accounts),
        setDefaultAccount,
        async.asyncify(setupFilters),
        async.asyncify(connectionWatcher.start.bind(connectionWatcher))
      ], function(err) {
        if (err) id = null;
        emit('select');
        cb(err);
      });

      function create(cb) {
        var query = {};
        if (pinnedId != null) query.id = pinnedId;
        
        http.request(sandboxUrl, {
          method: 'POST',
          query: query,
          contentType: 'application/json',
          body: JSON.stringify({
            plugins: config.hasOwnProperty('plugins') ? config.plugins : {}
          })
        }, function(err, data) {
          if (err) return cb(err);
          id = data.id;
          cb();
        });
      }
    }
    
    function setupFilters() {
      filters['block'] = web3.eth.filter('latest');
      filters['block'].watch(function(err, result) {
        if (err) return console.error(err);
        web3.eth.getBlock(result, function(err, block) {
          if (err) console.error(err);
          else if (block.transactions.length >0) emit('changed', result);
        });
      });
    }

    var connectionWatcher = {
      handler: undefined,
      start: function() {
        this.handler = setInterval(function() {
          try {
            web3.net.getListening(function(err, result) {
              if (err || !result) stopSandbox();
            });
          } catch (e) {
            stopSandbox();
          }
          function stopSandbox() {
            showError('The sandbox has been stopped.');
            select();
          }
        }, 5000);
      },
      stop: function() {
        clearInterval(this.handler);
      }
    };

    function setDefaultAccount(cb) {
      web3.sandbox.defaultAccount(function(err, address) {
        if (err) {
          if (cb) cb(err);
          else console.error(err);
        } else {
          web3.eth.defaultAccount = address;
          if (cb) cb();
        }
      });
    }
    
    function stop(cb) {
      _.invoke(filters, 'stopWatching');
      connectionWatcher.stop();
      http.request(sandboxUrl + id, { method: 'DELETE' }, function(err, data) {
        if (err) console.error(err);
        id = null;
        emit('select');
        cb();
      });
    }

    function list(cb) {
      http.request(sandboxUrl, { method: 'GET' }, cb);
    }

    plugin.freezePublicAPI({
      get web3() { return web3; },
      getId: function() { return id; },
      pinnedId: function() { return pinnedId; },
      pinOrUnpin: function() { pinnedId = pinnedId == null ? id : null; },
      select: select,
      start: start,
      stop: stop,
      list: list,
      runTx: web3.sandbox.runTx.bind(web3.sandbox),
      accounts: web3.sandbox.accounts.bind(web3.sandbox),
      contracts: web3.sandbox.contracts.bind(web3.sandbox),
      transactions: web3.sandbox.transactions.bind(web3.sandbox),
      coinbase: web3.eth.getCoinbase.bind(web3.eth)
    });
    
    register(null, {
      'ethergit.sandbox': plugin
    });
  }
});
