define(function(require) {
    main.consumes = ['Dialog', 'ui', 'ethergit.ethereum.sandbox.dialog.transaction'];
    main.provides = ['ethergit.ethereum.sandbox.dialog.transactions'];
    
    return main;
    
    function main(options, imports, register) {
        var Dialog = imports.Dialog;
        var ui = imports.ui;
        var transactionDialog = imports['ethergit.ethereum.sandbox.dialog.transaction'];
        var baseUrl = options.hasOwnProperty('baseUrl') ? options.baseUrl : 'plugins';
        
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
        require(['jquery'], function($) {
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
                sandbox.transactions.forEach(function(tx, id) {
                    $container.append(
                        $('<tr>')
                            .append('<td data-name="from" class="from">' + tx.tx.getSenderAddress().toString('hex') + '<span data-name="id" style="display:none">' + id + '</span></td>')
                            .append('<td>' + tx.tx.nonce.toString('hex') + '</td>')
                            .append('<td>' + (tx.tx.to.length === 0 ? '[contract create]' : tx.tx.to.toString('hex')) + '</td>')
                    );
                });
                $container.click(function(e) {
                    var $el = $(e.target);
                    if ($el.data('name') === 'from') {
                        transactionDialog.showTransaction(sandbox, $el.find('[data-name=id]').text());
                    }
                });
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