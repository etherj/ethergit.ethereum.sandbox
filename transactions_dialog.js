define(function(require) {
    main.consumes = ['Dialog', 'ui'];
    main.provides = ['ethergit.ethereum.sandbox.dialog.transactions'];
    
    return main;
    
    function main(options, imports, register) {
        var Dialog = imports.Dialog;
        var ui = imports.ui;
        var folder = require('./folder.js');
        
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
            var dialog = new Dialog('Ethergit', main.consumes, {
                name: 'sandbox-transactions',
                allowClose: true,
                title: 'Ethereum Sandbox Transactions',
                width: 800,
                elements: [
                    {
                        type: 'button', id: 'closeTransactionsDialog', color: 'blue',
                        caption: 'Close', 'default': true, onclick: hideDialog
                    }
                ]
            });
            
            dialog.on('draw', function(e) {
                e.html.innerHTML = require('text!./transactions.html');
            });

            function showSandbox(sandbox) {
                dialog.show();
                var $container = $('[data-name=transactions]').empty();
                sandbox.transactions.forEach(function(tx) {
                    $container.append(
                        $('<tr>')
                            .append('<td data-folder>' + tx.getSenderAddress().toString('hex') + '</td>')
                            .append('<td>' + tx.nonce.toString('hex') + '</td>')
                            .append('<td data-folder>' + tx.to.toString('hex') + '</td>')
                            .append('<td>' + tx.value.toString('hex') + '</td>')
                            .append('<td data-folder>' + tx.data.toString('hex') + '</td>')
                            .append('<td data-folder>' + tx.serialize().toString('hex') + '</td>')
                    );
                });
                folder.init($container);
            }
            
            function hideDialog() {
                dialog.hide();
            }
            
            dialog.on('load', function() {
                ui.insertCss(require('text!./transactions.css'), false, dialog);
            });
            
            dialog.freezePublicAPI({
                showSandbox: showSandbox
            });
            
            register(null, {
                'ethergit.ethereum.sandbox.dialog.transactions': dialog
            });
        });
    }
});