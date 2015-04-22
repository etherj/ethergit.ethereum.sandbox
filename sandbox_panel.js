define(function(require) {
    main.consumes = ['Panel', 'ui', 'ethergit.ethereum.sandbox.dialog.contract', 'apf'];
    main.provides = ['ethergit.ethereum.sandbox.panel'];
    
    return main;
    
    function main(options, imports, register) {
        var Panel = imports.Panel;
        var ui = imports.ui;
        var contractDialog = imports['ethergit.ethereum.sandbox.dialog.contract'];
        var apf = imports.apf;
        var Ethereum = require('./ethereumjs-lib');
        var Account = Ethereum.Account;
        var accountTemplate = require('text!./account.html');
        var async = require('async');
        var rlp = require('./rlp');
        var folder = require('./folder');
        var Buffer = require('./buffer').Buffer;
        var baseUrl = options.hasOwnProperty('baseUrl') ? options.baseUrl : 'plugins';

        apf.config.setProperty('allow-select', true);

        requirejs.config({
            context: 'sandbox',
            paths:{
                // 'jquery': 'http://code.jquery.com/jquery-1.11.2.min'
                'jquery': baseUrl + '/ethergit.ethereum.sandbox/jquery-1.11.2.min'
            },
            shim: {
                'jquery': {
                    exports: 'jQuery',
                }
            }
        });
        require(['jquery', './formatter'], function($, formatter) {
            var panel = new Panel('Ethergit', main.consumes, {
                index: 300,
                width: 400,
                caption: 'Ethergit Sandbox',
                minWidth: 300,
                where: 'right'
            });

            var sandbox = null;
            var $sandbox = null;

            panel.on('draw', function(e) {
                $sandbox = $(e.html);
                $sandbox.click(folder.foldOrUnfold);
                $sandbox.click(formatter.format.bind(formatter));
                $sandbox.click(function(e) {
                    var $el = $(e.target);
                    if ($el.data('name') === 'contract') {
                        var address = $el.parent().find('[data-name=address]').text();
                        contractDialog.showContract(sandbox, address);
                    }
                });
                panel.render();
            });
            
            panel.render = function() {
                if ($sandbox === null) return;
                
                if (sandbox === null || sandbox.state === 'CLEAN') {
                    $sandbox.html('<div class="accounts-container"><h3>Start Ethereum Sandbox to run your contracts.<h3></div>');
                } else if (sandbox.state === 'INITIALIZING') {
                    $sandbox.html('<div class="accounts-container"><h3>Initializing...<h3></div>');
                } else if (sandbox.state === 'INITIALIZED') {
                    renderAccounts(
                        $sandbox.html('<div class="accounts-container">').children(),
                        sandbox,
                        function() {
                            folder.init($sandbox);
                        }
                    );
                }
            };
    
            function load() {
                ui.insertCss(require('text!./style.css'), false, panel);
                panel.setCommand({
                    name: 'sandboxPanel',
                    hint: 'Ethereum Sandbox Panel',
                    bindKey: { mac: 'Command-Shift-E', win: 'Ctrl-Shift-E' }
                });
            }
            
            function showSandbox(sandboxToShow) {
                sandbox = sandboxToShow;
                sandbox.on('changed', function() { panel.render(); }, panel);
                panel.show();
                panel.render();
            }

            function renderAccounts($container, sandbox, cb) {
                getAccounts(sandbox.trie, showAccount.bind(undefined, $container, sandbox), cb);
                
                // TODO: accountHandler might be asynchronous functions, then cb will be called before the rendering really finished.
                function getAccounts(trie, accountHandler, cb) {
                    var stream = trie.createReadStream();
                    stream.on('data', function(data) {
                        accountHandler(data.key.toString('hex'), new Account(data.value));
                    });
                    stream.on('end', cb);
                }
                function showAccount($container, sandbox, address, account) {
                    var $account = $(accountTemplate);
                    
                    async.parallel([
                        showAccountFields.bind(undefined, $account, sandbox, address, account),
                        getStorageEntries.bind(
                            undefined, sandbox, account,
                            showStorageEntry.bind(undefined, $account.find('[data-name=storage]'))
                        ),
                        getCode.bind(undefined, showCode.bind(undefined, $account.find('[data-name=code]')))
                    ], function(err) {
                        if (err) return cb(err);
                        formatter.init($account.find('[data-name=storage]'));
                        $container.append($account);
                    });

                    function showAccountFields($container, sandbox, address, account, cb) {
                        $container.find('[data-name=address]').text(address);
                        if (sandbox.contracts.hasOwnProperty(address)) {
                            $container.find('[data-name=contract]').text(sandbox.contracts[address].name).show();
                        }
                        $container.find('[data-name=nonce]').text(account.nonce.toString('hex'));
                        $container.find('[data-name=balance]').text(account.balance.toString('hex'));
                        cb();
                    }
                    function getStorageEntries(sandbox, account, storageHandler, cb) {
                        if (account.stateRoot === sandbox.SHA3_RLP_NULL) return;
                        
                        var strie = sandbox.trie.copy();
                        strie.root = account.stateRoot;
                        var stream = strie.createReadStream();
                        stream.on('data', function(data) {
                            storageHandler(
                                data.key.toString('hex'),
                                createBuffer(rlp.decode(data.value)).toString('hex')
                            );
                        });
                        stream.on('end', cb);
                        
                        function createBuffer(input) {
                            if (input.length === 32) return input;
                            
                            var buf = new Buffer(32);
                            buf.fill(0);
                            input.copy(buf, 32 - input.length);
                            return buf;
                        }
                    }
                    function showStorageEntry($container, key, value) {
                        $container.append(
                            '<tr><td><a href="#" class="button" data-formatter="key">number</button></td><td data-name="key">' + key + '</td><td data-name="value">' + value + '</td><td><a href="#" class="button" data-formatter="value">number</button></td></tr>'
                        );
                    }
                    function getCode(codeHandler, cb) {
                        account.getCode(sandbox.trie, function(err, code) {
                            codeHandler(err, code.toString('hex'), cb);
                        });
                    }
                    function showCode($container, err, code, cb) {
                        if (err) return cb(err);
                        $container.text(code);
                        cb();
                    }
                }
            }
            
            panel.on('load', function() {
                load();
            });
            
            panel.freezePublicAPI({
                showSandbox: showSandbox
            });
            
            register(null, {
                'ethergit.ethereum.sandbox.panel': panel
            });
        });
    }
});