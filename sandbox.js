define(function(require, exports, module) {
    main.consumes = ['Plugin', 'http', 'dialog.error', 'ethergit.libs'];
    main.provides = ['ethergit.sandbox'];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var http = imports.http;
        var showError = imports['dialog.error'].show;
        var libs = imports['ethergit.libs'];
        
        var async = require('async');
        var utils = require('./utils');
        var formatter = require('./formatter');
        var Contract = require('./contract');

        var _ = libs.lodash();
        var web3 = libs.web3();
        
        var plugin = new Plugin('Ethergit', main.consumes);
        var emit = plugin.getEmitter();
        var id, filters = {};
        var sandboxUrl = 'http://' + window.location.hostname + ':8555/sandbox/';
        
        web3._extend({
            property: 'sandbox',
            methods: [
                new web3._extend.Method({
                    name: 'createAccounts',
                    call: 'sandbox_createAccounts',
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
                    name: 'predefinedAccounts',
                    call: 'sandbox_predefinedAccounts',
                    params: 0
                }),
                new web3._extend.Method({
                    name: 'accounts',
                    call: 'sandbox_accounts',
                    params: 0
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
                })
            ],
            properties: [
                new web3._extend.Property({
                    name: 'id',
                    getter: 'sandbox_id'
                })
            ]
        });

        function select(sandboxId) {
            if (id) {
                _.invoke(filters, 'stopWatching');
                connectionWatcher.stop();
            }
            if (sandboxId != id) {
                id = sandboxId;
                if (id) {
                    web3.setProvider(new web3.providers.HttpProvider(sandboxUrl + id));
                    setDefaultAccount();
                    setupFilters();
                    connectionWatcher.start();
                }
                emit('select');
            }

            
        }
        
        function start(env, cb) {
            async.series([
                create,
                function(cb) {
                    web3.setProvider(
                        new web3.providers.HttpProvider(sandboxUrl + id)
                    );
                    cb();
                },
                web3.sandbox.setBlock.bind(web3.sandbox, env.block),
                web3.sandbox.createAccounts.bind(web3.sandbox, env.accounts),
                async.asyncify(setupFilters),
                async.asyncify(connectionWatcher.start.bind(connectionWatcher))
            ], function(err) {
                if (err) id = null;
                emit('select');
                cb(err);
            });

            function create(cb) {
                http.request(sandboxUrl, { method: 'POST' }, function(err, data) {
                    if (err) return cb(err);
                    id = data.id;
                    cb();
                });
            }
        }
        
        function setupFilters() {
            filters['pending'] = web3.eth.filter('pending');
            filters['pending'].watch(function(err, result) {
                if (err) console.error(err);
                else emit('changed', result);
            });
            filters['log'] = web3.eth.filter({});
            filters['log'].watch(function(err, result) {
                if (err) console.error(err);
                else emit('log', result);
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

        plugin.on('select', setDefaultAccount);

        function setDefaultAccount() {
            web3.sandbox.defaultAccount(function(err, address) {
                if (err) console.error(err);
                web3.eth.defaultAccount = address;
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

        function coinbase(cb) {
            web3.eth.getCoinbase(function(err, result) {
                if (err) cb(err);
                else cb(null, result.substr(2));
            });
        }
        
        plugin.freezePublicAPI({
            get web3() { return web3 },
            getId: function() { return id; },
            select: select,
            start: start,
            stop: stop,
            list: list,
            runTx: web3.sandbox.runTx.bind(web3.sandbox),
            accounts: web3.sandbox.accounts.bind(web3.sandbox),
            predefinedAccounts: web3.sandbox.predefinedAccounts.bind(web3.sandbox),
            contracts: web3.sandbox.contracts.bind(web3.sandbox),
            transactions: web3.sandbox.transactions.bind(web3.sandbox),
            coinbase: coinbase
        });
        
        register(null, {
            'ethergit.sandbox': plugin
        });
    }
});
