define(function(require) {
    main.consumes = ['Panel'];
    main.provides = ['ethergit.ethereum.sandbox.panel'];
    
    return main;
    
    function main(options, imports, register) {
        var Panel = imports.Panel;
        var Ethereum = require('./ethereumjs-lib.js');
        var Account = Ethereum.Account;
        
        requirejs.config({
            context: 'sandbox',
            paths:{
                'jquery': 'http://code.jquery.com/jquery-1.11.2.min'
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
                    var $ul = $sandbox.html('<ul style="color:white;font-family:monospace;">').children();

                    stream.on('data', function (data) {
                        var account = new Account(data.value);
                        $ul.append(
                            $('<li>')
                                .text(data.key.toString('hex'))
                                .append(
                                    $('<ul>')
                                        .append('<li> nonce: ' + account.nonce.toString('hex') + '</li>')
                                        .append('<li> balance: ' + account.balance.toString('hex') + '</li>')
                                )
                        );
                    });
                }
            };
    
            function load() {
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