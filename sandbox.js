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

        function start(env, cb) {
            emit('process');
            async.series([
                create,
                function(cb) {
                    web3.setProvider(
                        new web3.providers.HttpProvider('http://localhost:8555/sandbox/' + id)
                    );
                    cb();
                },
                web3.sandbox.setBlock.bind(web3.sandbox, env.block),
                web3.sandbox.createAccounts.bind(web3.sandbox, env.accounts),
                setupFilter
            ], function(err) {
                if (err) id = null;
                emit('select');
                cb(err);
            });

            function create(cb) {
                http.request(
                    'http://localhost:8555/sandbox',
                    { method: 'POST' },
                    function(err, data) {
                        id = data.id;
                        cb();
                    }
                );
            }
            function setupFilter(cb) {
                filter = web3.eth.filter('pending');
                filter.watch(function(err, result) {
                    emit('changed', result);
                });
                cb();
            }
        }

        function stop(cb) {
            emit('process');
            filter.stopWatching();
            http.request(
                'http://localhost:8555/sandbox/' + id,
                { method: 'DELETE' },
                function(err, data) {
                    id = null;
                    emit('select');
                    cb();
                }
            );
        }
        
        plugin.freezePublicAPI({
            getId: function() { return id; },
            start: start,
            stop: stop,
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
