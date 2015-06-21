define(function(require, exports, module) {
    main.consumes = [
        'Plugin', 'commands', 'ui', 'layout', 'fs', 'dialog.error',
        'ethergit.solidity.compiler',
        'ethergit.sandbox',
        'ethergit.ethereum.sandbox.panel',
        'ethergit.ethereum.sandbox.dialog.transactions'
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
        
        var async = require('async');
        var utils = require('./utils');
        
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
        }
        
        function runOrStopSandbox(sandbox, cb) {
            if (sandbox.state() === 'CLEAN') {
                async.waterfall([
                    compileContracts,
                    readConfig,
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
            function calcPrivateKeys(config, contracts, cb) {
                Object.keys(config.env).forEach(function(address) {
                    var account = config.env[address];
                    if (account.hasOwnProperty('pkey') && account.pkey.length !== 64) {
                        account.pkey = utils.sha3(account.pkey);
                        console.log('key: ' + account.pkey);
                    }
                });
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
                async.map(texts, compiler.binaryAndABI.bind(compiler), cb);
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
