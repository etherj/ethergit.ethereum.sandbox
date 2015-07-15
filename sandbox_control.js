define(function(require, exports, module) {
    main.consumes = [
        'Plugin', 'ui', 'layout', 'fs', 'find', 'tabManager', 'commands', 'save',
        'ethergit.libs',
        'ethergit.sandbox',
        'ethergit.solidity.compiler',
        'ethereum-console'
    ];
    main.provides = ['ethergit.sandbox.control'];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var layout = imports.layout;
        var fs = imports.fs;
        var find = imports.find;
        var tabs = imports.tabManager;
        var commands = imports.commands;
        var save = imports.save;
        var libs = imports['ethergit.libs'];
        var sandbox = imports['ethergit.sandbox'];
        var compiler = imports['ethergit.solidity.compiler'];
        var ethConsole = imports['ethereum-console'];

        var async = require('async');
        var utils = require('./utils');
        
        var $ = libs.jquery();
        var _ = libs.lodash();

        var control = new Plugin('Ethergit', main.consumes);
        
        control.on('load', function() {
            var runCommands = {
                'runAllContracts': 'Run All Contracts',
                'runCurrentContract': 'Run Active Contract',
                'stopSandbox': 'Stop Sandbox'
            };
            var choosenCommand = 'runAllContracts';
            var command = choosenCommand;
            
            ui.insertByIndex(
                layout.getElement('barTools'),
                '<application>' + require('text!./sandbox_control.html') + '</application>',
                320, control
            );

            var $widget = $('[data-name=startSandbox]');
            var $run = $widget.find('[data-name=run]');
            $run.click(function() {
                commands.exec(command, tabs.focussedTab.editor);
            });

            var $runAll = $widget.find('[data-name=runAll]');
            $runAll.click(function() {
                if (sandbox.state() !== 'CLEAN') stopSandbox(run);
                else run();
                
                function run() {
                    choosenCommand = 'runAllContracts';
                    commands.exec(choosenCommand, tabs.focussedTab.editor);
                }
            });

            var $runCurrent = $widget.find('[data-name=runCurrent]');
            $runCurrent.click(function() {
                if (sandbox.state() !== 'CLEAN') stopSandbox(run);
                else run();
                
                function run() {
                    choosenCommand = 'runCurrentContract';
                    commands.exec(choosenCommand, tabs.focussedTab.editor);
                }
            });
            
            commands.addCommand({
                name: 'runAllContracts',
                exec: function() {
                    ethConsole.logger(function(err, logger) {
                        if (err) return console.err(err);
                        logger.clear();
                        run(false, function(err) {
                            if (err) logger.error('<pre>' + err + '</pre>');
                        });
                    });
                }
            }, control);

            commands.addCommand({
                name: 'runCurrentContract',
                exec: function() {
                    ethConsole.logger(function(err, logger) {
                        if (err) return console.err(err);
                        logger.clear();
                        run(true, function(err) {
                            if (err) logger.error('<pre>' + err + '</pre>');
                        });
                    });
                }
            }, control);            

            commands.addCommand({
                name: 'stopSandbox',
                exec: stopSandbox
            }, control);

            function stopSandbox(cb) {
                ethConsole.logger(function(err, logger) {
                    if (err) return console.err(err);
                    stop(function(err) {
                        if (err) logger.error(err);
                        if (typeof cb === 'function') cb(err);
                    });
                });
            }

            sandbox.on('stateChanged', function() {
                var config = {
                    CLEAN: {
                        caption: runCommands[choosenCommand],
                        disabled: false,
                        command: choosenCommand
                    },
                    STARTING: {
                        caption: 'Starting...',
                        disabled: true
                    },
                    ACTIVE: {
                        caption: runCommands['stopSandbox'],
                        disabled: false,
                        command: 'stopSandbox'
                    },
                    STOPPING: {
                        caption: 'Stopping...',
                        disabled: true
                    }
                };

                update(config[sandbox.state()]);
                
                function update(config) {
                    $run.text(config.caption);
                    
                    if (config.disabled) $run.addClass('disabled');
                    else $run.removeClass('disabled');
                    
                    if (config.command === 'stopSandbox')
                        $run.removeClass('stopped').addClass('started');
                    else
                        $run.removeClass('started').addClass('stopped');
                    
                    command = config.command;
                }
            });
        });

        function run(current, cb) {
            if (sandbox.state() !== 'CLEAN') return cb('Sandbox is running already');

            async.series({
                save: saveAll,
                config: loadConfig,
                contracts: compileContracts.bind(null, current)
            }, function(err, params) {
                if (err) cb(err === 'CANCEL' ? null : err);
                else async.series([
                    startSandbox.bind(this, params.config),
                    createContracts.bind(this, params.contracts)
                ], cb);
            });

            function saveAll(cb) {
                save.saveAllInteractive(tabs.getTabs(), function(result) {
                    cb(result === 0 ? 'CANCEL' : null);
                });
            }
            
            function loadConfig(cb) {
                async.waterfall([
                    read,
                    adjustValues,
                    calcPrivateKeys
                ], cb);
                
                function read(cb) {
                    fs.readFile('/ethereum.json', function(err, content) {
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
                    if (!config.hasOwnProperty('env') || !config.env.hasOwnProperty('accounts') ||
                        Object.keys(config.env).length === 0) {
                        return cb('Please, add initial account(s) to ethereum.json');
                    }

                    try {
                        if (config.env.hasOwnProperty('block')) {
                            var block = config.env.block;
                            if (block.hasOwnProperty('coinbase'))
                                try {
                                    block.coinbase = address(block.coinbase);
                                } catch (e) {
                                    throw 'Could not parse block.address: ' + e;
                                }
                            _.each(
                                ['difficulty', 'gasLimit', 'number', 'timestamp'],
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

                        _.each(config.env.accounts, function(account) {
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
                        });
                    } catch (e) {
                        return cb(e);
                    }
                    
                    cb(null, config);

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
                    function address(val) {
                        if (typeof val !== 'string' || val.length !== 40)
                            throw 'Address should be a string with 40 characters';
                        return val;
                    }
                }
                function calcPrivateKeys(config, cb) {
                    try {
                        _.each(config.env.accounts, function(account) {
                            if (account.hasOwnProperty('pkey')) {
                                if (typeof account.pkey != 'string') {
                                    throw 'Private key should be a hexadecimal hash (64 symbols) or a string';                            }
                                if (account.pkey.length !== 64) {
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

            function compileContracts(current, cb) {
                async.waterfall([
                    getFiles.bind(null, current),
                    compile
                ], cb);

                function getFiles(current, cb) {
                    if (current) {
                        if (!tabs.focussedTab) cb('Open a Solidity file to run it.');
                        else cb(null, ['.' + tabs.focussedTab.path]);
                    } else findSolidityFiles(cb);
                
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
                }
                function compile(files, cb) {
                    if (files.length === 0) cb(null, []);
                    else {
                        compiler.binaryAndABI(files, function(err, compiled) {
                            if (err) {
                                if (err.type === 'SYNTAX') gotoLine(err);
                                cb(err.message);
                            }
                            else cb(null, compiled);
                        });
                    }

                    function gotoLine(err) {
                        tabs.open({
                            path: err.file,
                            focus: true
                        }, function(error, tab){
                            if (error) console.error(error);
                            else tab.editor.ace.gotoLine(err.line, err.column);
                        });
                    }
                }
            }

            function startSandbox(config, cb) {
                sandbox.start(config.env, cb);
            }

            function createContracts(contracts, cb) {
                async.eachSeries(contracts, function(contract, cb) {
                    sandbox.runTx({
                        data: contract.binary,
                        contract: contract
                    }, cb);
                }, cb);
            }
        }

        function stop(cb) {
            if (sandbox.state() !== 'ACTIVE') cb('Sandbox is not running');
            else sandbox.stop(cb);
        }

        ui.insertCss(require('text!./sandbox_control.css'), false, control);
        
        register(null, { 'ethergit.sandbox.control': control });
    }
});
