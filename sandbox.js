define(function(require, exports, module) {
    main.consumes = [
        'Plugin', 'commands', 'ui', 'layout', 'fs', 'dialog.error',
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
                    runOrStopSandbox(sandbox, function(err, sandbox) {
                         if (err) return errorDialog.show(err);
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
                sandbox.contracts(function(err, contracts) {
                    if (err) return console.error(err);

                    var contract = contracts.hasOwnProperty(entry.address) ?
                            Object.create(Contract).init(entry.address, contracts[entry.address]) :
                            null;
                    if (entry.topics.length > 0 && entry.topics[0].length === 64) {
                        var event = contract.findEvent(entry.topics[0]);
                        ethConsole.log(
                            event ?
                                showEvent(contract, event, entry) :
                                log(contract, entry)
                        );
                    } else {
                        ethConsole.log(log(contract, entry));
                    }
                });

                function showEvent(contract, event, entry) {
                    entry.topics.shift(); // skip event hash
                    return 'Sandbox Event (' + contract.name + '.' + event.name + '): ' +
                        _(event.inputs).map(function(input) {
                            var val = input.indexed ?
                                    entry.topics.shift() : entry.data.shift();
                            return _.escape(formatter.findFormatter(input.type).format(val));
                        }).join(', ');
                }
                
                function log(contract, entry) {
                    return 'Sandbox LOG (' + contract.name + '): ' +
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
                readRootDir,
                getFileNames,
                filterSolFiles,
                readFiles,
                workaroundWrongFileContent,
                compileTexts
            ], cb);
            
            function readRootDir(cb) {
                fs.readdir('/', function(err, files) { cb(err, files); });
            }
            function getFileNames(fileStats, cb) {
                async.map(fileStats, function(stat, cb) {
                    cb(null, stat.name);
                }, cb);
            }
            function filterSolFiles(fileNames, cb) {
                async.filter(fileNames, function(name, cb) {
                    cb(name.match(/\.sol$/));
                }, cb.bind(undefined, null));
            }
            function readFiles(fileNames, cb) {
                async.map(fileNames, function(file, cb) {
                    fs.readFile('/' + file, cb);
                }, cb);
            }
            // Workaround for https://github.com/c9/core/issues/71
            function workaroundWrongFileContent(texts, cb) {
                async.map(texts, function(text, cb) {
                    cb(null, removeMetaInfo(text));
                }, cb);
            }
            function compileTexts(texts, cb) {
                async.map(texts, compiler.binaryAndABI.bind(compiler), function(err, compiled) {
                    if (err) return cb(err);
                    // flatten the array of arrays of contracts
                    cb(null, [].concat.apply([], compiled));
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
