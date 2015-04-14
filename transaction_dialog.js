define(function(require) {
    main.consumes = ['Dialog', 'ui'];
    main.provides = ['ethergit.ethereum.sandbox.dialog.transaction'];
    
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
                name: 'sandbox-transaction',
                allowClose: true,
                title: 'Transaction',
                width: 500,
                elements: [
                    {
                        type: 'button', id: 'closeTransactionsDialog', color: 'blue',
                        caption: 'Close', 'default': true, onclick: hideDialog
                    }
                ]
            });
            
            dialog.on('draw', function(e) {
                e.html.innerHTML = require('text!./transaction.html');
            });

            function showTransaction(sandbox, id) {
                dialog.show();
                var $container = $('[data-name=transaction]');
                var tx = sandbox.transactions[id];
                [
                    ['from', tx.getSenderAddress().toString('hex')],
                    ['nonce', tx.nonce.toString('hex')],
                    ['to', tx.to.toString('hex')],
                    ['value', tx.value.toString('hex')],
                    ['data', tx.data.toString('hex')],
                    ['rlp', tx.serialize().toString('hex')]
                ].forEach(function(field) {
                    $container.find('[data-name=' + field[0] + ']').text(field[1]);
                });
                folder.init($container);
            }
            
            function hideDialog() {
                dialog.hide();
            }
            
            dialog.on('load', function() {
                ui.insertCss(require('text!./transaction.css'), false, dialog);
            });
            
            dialog.freezePublicAPI({
                showTransaction: showTransaction
            });
            
            register(null, {
                'ethergit.ethereum.sandbox.dialog.transaction': dialog
            });
        });
    }
});