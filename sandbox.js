define(function(require, exports, module) {
    main.consumes = [
        'Plugin', 'commands', 'ui', 'layout', 'fs', 'dialog.error', 'find', 'tabManager',
        'ethergit.solidity.compiler',
        'ethergit.sandbox',
        'ethergit.ethereum.sandbox.panel',
        'ethergit.ethereum.sandbox.dialog.transactions',
        'ethereum-console',
        'ethergit.libs'
    ];
    main.provides = ['ethergit.ethereum.sandbox'];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var commands = imports.commands;
        var ui = imports.ui;
        var layout = imports.layout;
        var fs = imports.fs;
        var errorDialog = imports['dialog.error'];
        var find = imports.find;
        var tabs = imports.tabManager;
        var sandbox = imports['ethergit.sandbox'];
        var sandboxPanel = imports['ethergit.ethereum.sandbox.panel'];
        var compiler = imports['ethergit.solidity.compiler'];
        var transactionsDialog = imports['ethergit.ethereum.sandbox.dialog.transactions'];
        var ethConsole = imports['ethereum-console'];
        var libs = imports['ethergit.libs'];
        
        var async = require('async');
        var utils = require('./utils');
        var formatter = require('./formatter');
        var Contract = require('./contract');

        var _ = libs.lodash();
        
        var plugin = new Plugin('Ethergit', main.consumes);
        
        function load() {
            commands.addCommand({
                name: 'runSandbox',
                exec: function() {
                    sandboxPanel.show();
                    ethConsole.logger(function(err, logger) {
                        if (err) return console.error(err);
                        logger.clear();
                        runOrStopSandbox(sandbox, function(err, sandbox) {
                            if (err) logger.error('<pre>' + err + '</pre>');
                        });
                    });
                }
            }, plugin);
            
            var btnSandbox = ui.insertByIndex(
                layout.getElement('barTools'),
                new ui.button({
                    id: 'btnSandbox',
                    skin: 'c9-toolbarbutton-glossy',
                    command: 'runSandbox',
                    caption: 'Start Sandbox',
                    disabled: false,
                    icon: 'run.png'
                }),
                300, plugin
            );

            commands.addCommand({
                name: 'showTransactions',
                exec: function() {
                    transactionsDialog.showSandbox(sandbox);
                }
            }, plugin);

            var btnTransactions = ui.insertByIndex(
                layout.getElement('barTools'),
                new ui.button({
                    id: 'btnTransactions',
                    skin: 'c9-toolbarbutton-glossy',
                    command: 'showTransactions',
                    caption: 'Transactions',
                    disabled: true
                }),
                400, plugin
            );
            
            sandbox.on('changed', function() {
                if (sandbox.state() === 'CLEAN') {
                    btnSandbox.setAttribute('disabled', false);
                    btnSandbox.setAttribute('caption', 'Start Sandbox');
                    btnTransactions.setAttribute('disabled', true);
                    btnTransactions.setAttribute('caption', 'Transactions');
                } else if (sandbox.state() === 'INITIALIZING') {
                    btnSandbox.setAttribute('disabled', true);
                    btnSandbox.setAttribute('caption', 'Starting Sandbox...');
                    btnTransactions.setAttribute('disabled', false);
                    sandbox.transactions(function(err, transactions) {
                        if (err) return console.error(err);
                        btnTransactions.setAttribute(
                            'caption', 'Transactions (' + transactions.length + ')'
                        );
                    });
                } else if (sandbox.state() === 'ACTIVE') {
                    btnSandbox.setAttribute('disabled', false);
                    btnSandbox.setAttribute('caption', 'Stop Sandbox');
                    btnTransactions.setAttribute('disabled', false);
                    sandbox.transactions(function(err, transactions) {
                        if (err) return console.error(err);
                        btnTransactions.setAttribute(
                            'caption', 'Transactions (' + transactions.length + ')'
                        );
                    });
                } else if (sandbox.state() === 'STOPPING') {
                    btnSandbox.setAttribute('disabled', true);
                    btnSandbox.setAttribute('caption', 'Stopping Sandbox...');
                    btnTransactions.setAttribute('disabled', false);
                    btnTransactions.setAttribute('caption', 'Transactions');
                }
            });

            sandbox.on('log', function(entry) {
                async.parallel({
                    contracts: sandbox.contracts,
                    logger: ethConsole.logger
                }, showLog);
                
                function showLog(err, options) {
                    if (err) return console.error(err);

                    var contracts = options.contracts;
                    var logger = options.logger;
                    
                    var contract = contracts.hasOwnProperty(entry.address) ?
                            Object.create(Contract).init(entry.address, contracts[entry.address]) :
                            null;
                    if (!contract) {
                        logger.log(log('Unknown', entry));
                    } else if (entry.topics.length > 0 && entry.topics[0].length === 64) {
                        var event = contract.findEvent(entry.topics[0]);
                        logger.log(
                            event ?
                                showEvent(contract.name, event, entry) :
                                log(contract.name, entry)
                        );
                    } else {
                        logger.log(log(contract.name, entry));
                    }
                }

                function showEvent(contractName, event, entry) {
                    entry.topics.shift(); // skip event hash
                    return 'Sandbox Event (' + contractName + '.' + event.name + '): ' +
                        _(event.inputs).map(function(input) {
                            var val = input.indexed ?
                                    entry.topics.shift() : entry.data.shift();
                            return _.escape(formatter.findFormatter(input.type).format(val));
                        }).join(', ');
                }
                
                function log(contractName, entry) {
                    return 'Sandbox LOG (' + contractName + '): ' +
                        _(entry.data).concat(entry.topics)
                        .map(function(val) {
                            return _.escape(formatter.detectType(val).format(val));
                        })
                        .join(', ');
                }
            });
        }
        
        function runOrStopSandbox(sandbox, cb) {
            if (sandbox.state() === 'CLEAN') {
                async.waterfall([
                    compileContracts,
                    readConfig,
                    parseValues,
                    calcPrivateKeys,
                    initSandbox,
                    createContracts
                ], cb);
            } else if (sandbox.state() === 'ACTIVE') {
                sandbox.stop(function(err) {
                    cb(err, sandbox);
                });
            } else cb('Wait until Sandbox finish initialization.');
            
            function readConfig(contracts, cb) {
                fs.readFile('/sandbox.json', function(err, content) {
                    if (err) return cb(err);

                    content = removeMetaInfo(content);
                    
                    try {
                        var config = JSON.parse(content);
                    } catch(e) {
                        return cb('Could not parse sandbox.json: ' + e.message);
                    }
                    
                    cb(null, config, contracts);
                });
            }
            function parseValues(config, contracts, cb) {
                if (!config.hasOwnProperty('env') || Object.keys(config.env) === 0) {
                    return cb('Please, add initial account(s) to sandbox.json');
                }

                try {
                    Object.keys(config.env).forEach(function(address) {
                        var account = config.env[address];
                        ['balance', 'nonce'].forEach(function(field) {
                            if (account.hasOwnProperty(field)) {
                                try {
                                    account[field] = value(account[field]);
                                } catch (e) {
                                    throw 'Could not parse ' + field + ': ' + e;
                                }
                            }
                        });
                        if (account.hasOwnProperty('storage')) {
                            var parsedStorage = {};
                            Object.keys(account.storage).forEach(function(key) {
                                try {
                                    var parsedKey = value(key);
                                } catch (e) {
                                    throw 'Could not parse key of storage entry: ' + e;
                                }
                                try {
                                    parsedStorage[parsedKey] = value(account.storage[key]);
                                } catch (e) {
                                    throw 'Could not parse value of storage entry: ' + e;
                                }
                            });
                            account.storage = parsedStorage;
                        }
                    });
                } catch (e) {
                    return cb(e);
                }
                
                cb(null, config, contracts);

                function value(val) {
                    var type = typeof val;
                    var res;
                    if (type === 'number') {
                        res = utils.pad(val.toString(16));
                    } else if (type === 'string') {
                        if (val.indexOf('0x') === 0) {
                            res = utils.pad(val.substr(2));
                        } else if (/^\d+$/.test(val)) {
                            res = utils.pad(parseInt(val, 10).toString(16));
                        } else {
                            throw '"' + val + '" is not a decimal number (use 0x prefix for hexadecimal numbers)';
                        }
                    } else {
                        throw 'Value should be either number or string';
                    }
                    return res;
                }
            }
            function calcPrivateKeys(config, contracts, cb) {
                try {
                    Object.keys(config.env).forEach(function(address) {
                        var account = config.env[address];
                        if (account.hasOwnProperty('pkey')) {
                            if (typeof account.pkey != 'string') {
                                throw 'Private key should be a hexadecimal hash (64 symbols) or a string';
                            }
                            if (account.pkey.length !== 64) {
                                account.pkey = utils.sha3(account.pkey);
                            }
                        }
                    });
                } catch (e) {
                    return cb(e);
                }
                cb(null, config, contracts);
            }
            function initSandbox(config, contracts, cb) {
                sandbox.start(config.env, function(err) {
                    cb(err, sandbox, contracts);
                });
            }
            function createContracts(sandbox, contracts, cb) {
                async.eachSeries(contracts, function(contract, cb) {
                    sandbox.runTx({
                        data: contract.binary,
                        contract: contract
                    }, cb);
                }, function(err) {
                    cb(err, sandbox);
                });
            }
        }

        function compileContracts(cb) {
            async.waterfall([
                findSolidityFiles,
                compile
            ], cb);

            function findSolidityFiles(cb) {
                find.findFiles({
                    path: '',
                    pattern : '*.sol',
                    buffer  : true
                }, function(err, result) {
                    cb(null, result
                       .match(/.+(?=:)/g)
                       .map(function(path) { return '.' + path; }));
                });
            }
            function compile(files, cb) {
                if (files.length === 0) cb(null, []);
                else
                    compiler.binaryAndABI(files, function(err, compiled) {
                        if (err) {
                            if (err.type === 'SYNTAX') {
                                tabs.open({
                                    path: err.file,
                                    focus: true
                                }, function(error, tab){
                                    if (error) return console.error(error);
                                    tab.editor.ace.gotoLine(err.line, err.column);
                                });
                            }
                            cb(err.message);
                        }
                        else cb(null, compiled);
                    });
            }
        }

        // Workaround for https://github.com/c9/core/issues/71
        function removeMetaInfo(text) {
            var jsonAtTheEnd = text.indexOf('{"changed"');
            if (jsonAtTheEnd === -1) jsonAtTheEnd = text.indexOf('{"filter"');
            return jsonAtTheEnd !== -1 ? text.substr(0, jsonAtTheEnd) : text;
        }

        plugin.on('load', function() {
            load();
        });
        plugin.on('unload', function() {
        
        });
        
        plugin.freezePublicAPI({
            
        });
        
        register(null, {
            'ethergit.ethereum.sandbox': plugin
        });
    }
});
