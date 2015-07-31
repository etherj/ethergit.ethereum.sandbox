define(function(require, exports, module) {
    main.consumes = ['Plugin', 'http', 'ethergit.libs'];
    main.provides = ['ethergit.sandbox'];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var http = imports.http;
        var libs = imports['ethergit.libs'];
        
        var async = require('async');
        var utils = require('./utils');
        var formatter = require('./formatter');
        var Contract = require('./contract');

        var _ = libs.lodash();
        var web3 = libs.web3();
        
        var plugin = new Plugin('Ethergit', main.consumes);
        var emit = plugin.getEmitter();
        var id, filter;
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
            if (id) filter.stopWatching();
            if (sandboxId != id) {
                id = sandboxId;
                if (id) {
                    web3.setProvider(new web3.providers.HttpProvider(sandboxUrl + id));
                    setupFilter();
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
                async.asyncify(setupFilter)
            ], function(err) {
                if (err) id = null;
                emit('select');
                cb(err);
            });

            function create(cb) {
                http.request(sandboxUrl, { method: 'POST' }, function(err, data) {
                    id = data.id;
                    cb();
                });
            }
        }
        
        function setupFilter() {
            filter = web3.eth.filter('pending');
            filter.watch(function(err, result) {
                emit('changed', result);
            });
        }

        function stop(cb) {
            filter.stopWatching();
            http.request(sandboxUrl + id, { method: 'DELETE' }, function(err, data) {
                id = null;
                emit('select');
                cb();
            });
        }

        function list(cb) {
            http.request(sandboxUrl, { method: 'GET' }, cb);
        }
        
        plugin.freezePublicAPI({
            getId: function() { return id; },
            select: select,
            start: start,
            stop: stop,
            list: list,
            runTx: web3.sandbox.runTx.bind(web3.sandbox),
            accounts: web3.sandbox.accounts.bind(web3.sandbox),
            predefinedAccounts: web3.sandbox.predefinedAccounts.bind(web3.sandbox),
            contracts: web3.sandbox.contracts.bind(web3.sandbox),
            transactions: web3.sandbox.transactions.bind(web3.sandbox)
        });
        
        register(null, {
            'ethergit.sandbox': plugin
        });
    }
});
