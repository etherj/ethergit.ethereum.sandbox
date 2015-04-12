define(function(require) {
    main.consumes = ['Panel', 'ui', 'dialog.error'];
    main.provides = ['ethergit.ethereum.sandbox.panel'];
    
    return main;
    
    function main(options, imports, register) {
        var Panel = imports.Panel;
        var ui = imports.ui;
        var errorDialog = imports['dialog.error'];
        var Ethereum = require('./ethereumjs-lib.js');
        var Account = Ethereum.Account;
        var accountTemplate = require('text!./account.html');
        var async = require('async');
        var rlp = require('./rlp.js');

        requirejs.config({
            context: 'sandbox',
            paths:{
                // 'jquery': 'http://code.jquery.com/jquery-1.11.2.min'
                'jquery': 'vfs/0/plugins/token/ethergit.ethereum.sandbox/jquery-1.11.2.min'
            },
            shim: {
                'jquery': {
                    exports: 'jQuery',
                }
            }
        })(['jquery'], function($) {
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
                        sandbox, function() {}
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
                sandbox.on('changed', function() { panel.render(); });
                panel.show();
                panel.render();
            }
            
            function renderAccounts($container, sandbox, cb) {
                getAccounts(sandbox.trie, showAccount.bind(undefined, $container, sandbox), cb);
                
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
                        showAccountFields.bind(undefined, $account, address, account),
                        getStorageEntries.bind(
                            undefined, sandbox, account,
                            showStorageEntry.bind(undefined, $account.find('[data-name=storage]'))
                        ),
                        getCode.bind(undefined, showCode.bind(undefined, $account.find('[data-name=code]')))
                    ], function(err) {
                        if (err) return cb(err);
                        $container.append($account);
                        cb();
                    });

                    function showAccountFields($container, address, account, cb) {
                        $container.find('[data-name=address]').text(address);
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
                                removeLeadingZeroBytes(data.key.toString('hex')),
                                rlp.decode(data.value).toString('hex')
                            );
                        });
                        stream.on('end', cb);
                        
                        function removeLeadingZeroBytes(str) {
                            if (str.length % 2 !== 0)
                                console.error('Wrong hex str: ' + str);
                                
                            var firstNonZeroByte = str.length - 2;
                            for (var i = 0; i < str.length; i += 2) {
                                if (str[i] !== '0' || str[i + 1] !== '0')
                                    firstNonZeroByte = i;
                            }
                            
                            return str.substring(firstNonZeroByte);
                        }
                    }
                    function showStorageEntry($container, key, value) {
                        $container.append('<tr><td>' + key + '</td><td>' + value + '</td></tr>');
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