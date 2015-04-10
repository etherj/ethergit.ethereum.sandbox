define(function(require, exports, module) {
    main.consumes = ['Plugin', 'commands', 'ui', 'layout', 'fs', 'dialog.error', 'ethergit.solidity.compiler', 'ethergit.ethereum.sandbox.panel'];
    main.provides = ['ethergit.ethereum.sandbox'];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var commands = imports.commands;
        var ui = imports.ui;
        var layout = imports.layout;
        var fs = imports.fs;
        var errorDialog = imports['dialog.error'];
        var compiler = imports['ethergit.solidity.compiler'];
        var panel = imports['ethergit.ethereum.sandbox.panel'];
        
        var Sandbox = require('./ethereum_sandbox.js');
        var Buffer = require('./buffer.js').Buffer;
        var async = require('async');
        
        var plugin = new Plugin('Ethergit', main.consumes);
        
        function load() {
            commands.addCommand({
                name: 'runSandbox',
                exec: function() {
                    readSandboxEnv(function(err, content) {
                        if (err) return errorDialog.show(err);
                        
                        try {
                            var config = JSON.parse(content);
                        } catch(e) {
                            return errorDialog.show('Could not parse sandbox.json: ' + e.message);
                        }
                        
                        runSandbox(config, function(err) {
                            if (err) return errorDialog.show(err);
                            
                            btnSandbox.setAttribute('caption', 'Stop Sandbox');
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
                    caption: 'Sandbox',
                    disabled: false,
                    class: 'runbtn stopped',
                    icon: 'run.png'
                }),
                300, plugin
            );
        }
        
        function readSandboxEnv(cb) {
            fs.readFile('/sandbox.json', cb);
        }
        
        function runSandbox(config, cb) {
            var createSandbox = function(contracts, cb) {
                var sandbox = Object.create(Sandbox).init();
                panel.showSandbox(sandbox);
                sandbox.initEnv(config.env, function(err) {
                    cb(err, sandbox, contracts);
                });
            };
            var createContracts = function(sandbox, contracts, cb) {
                async.eachSeries(contracts, function(contract, cb) {
                    sandbox.runTx({
                        data: new Buffer(contract, 'hex')
                    }, cb);
                }, function(err) {
                    cb(err, sandbox);
                });
            };

            async.waterfall([
                compileContracts,
                createSandbox,
                createContracts
            ], cb);
        }
        
        function compileContracts(cb) {
            var readRootDir = function(cb) {
                fs.readdir('/', function(err, files) { cb(err, files); });
            };
            var getFileNames = function(fileStats, cb) {
                async.map(fileStats, function(stat, cb) {
                    cb(null, stat.name);
                }, function(err, names) {
                    cb(err, names);
                });
            };
            var filterSolFiles = function(fileNames, cb) {
                async.filter(fileNames, function(name, cb) {
                    cb(name.match(/\.sol$/));
                }, function(solFiles) {
                    cb(null, solFiles);
                });
            };
            var readFiles = function(fileNames, cb) {
                async.map(fileNames, function(file, cb) {
                    fs.readFile('/' + file, cb);
                }, function(err, contents) {
                    cb(err, contents);
                });
            };
            var compileTexts = function(texts, cb) {
                async.map(texts, function(text, cb) {
                    compiler.binary(text, cb);
                }, function(err, binaries) {
                    cb(err, binaries);
                });
            };
            
            async.waterfall([
                readRootDir,
                getFileNames,
                filterSolFiles,
                readFiles,
                compileTexts
            ], cb);
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