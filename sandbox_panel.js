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
                
                if (sandbox === null) {
                    $sandbox.html('<h3>Start Ethereum Sandbox to run your contracts.<h3>');
                } else if (sandbox.state === 'INITIALIZING') {
                    $sandbox.html('<h3>Initializing...<h3>');
                } else if (sandbox.state === 'INITIALIZED') {
                    var stream = sandbox.vm.trie.createReadStream();
                    var $main = $sandbox.html('<div class="accounts-container">').children();
                    
                    stream.on('data', function (data) {
                        var account = new Account(data.value);
                        var $container = $(accountTemplate);
                        
                        var getStorage = function(cb) {
                            var removeLeadingZeroBytes = function(str) {
                                if (str.length % 2 !== 0)
                                    console.error('Wrong hex str: ' + str);
                                    
                                var firstNonZeroByte = str.length - 2;
                                for (var i = 0; i < str.length; i += 2) {
                                    if (str[i] !== '0' || str[i + 1] !== '0')
                                        firstNonZeroByte = i;
                                }
                                
                                return str.substring(firstNonZeroByte);
                            };
                            
                            var strie = sandbox.trie.copy();
                            strie.root = account.stateRoot;
                            var sstream = strie.createReadStream();
                            var storage = {};
                            sstream.on('data', function(data) {
                                storage[removeLeadingZeroBytes(data.key.toString('hex'))] = rlp.decode(data.value).toString('hex');
                            });
                            sstream.on('end', function() {
                                cb(null, storage);
                            });
                        };
                        var getCode = function(cb) {
                            account.getCode(sandbox.trie, function(err, code) {
                                cb(err, code.toString('hex'));
                            });
                        };
                        
                        async.parallel({
                            storage: getStorage,
                            code: getCode
                        }, function(err, results) {
                            if (err) return errorDialog.show(err);
                            
                            $container.find('[data-name=address]').text(data.key.toString('hex'));
                            $container.find('[data-name=nonce]').text(account.nonce.toString('hex'));
                            $container.find('[data-name=balance]').text(account.balance.toString('hex'));
                            Object.getOwnPropertyNames(results.storage).forEach(function(key) {
                                $container.find('[data-name=storage]')
                                    .append('<tr><td>' + key + '</td><td>' + results.storage[key] + '</td></tr>');
                            });
                            $container.find('[data-name=code]').text(results.code);
                            
                            $main.append($container);
                        });
                    });
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
                sandbox.on('stateChanged', function() { panel.render(); });
                panel.show();
                panel.render();
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