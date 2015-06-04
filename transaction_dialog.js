define(function(require) {
    main.consumes = ['Dialog', 'ui'];
    main.provides = ['ethergit.ethereum.sandbox.dialog.transaction'];
    
    return main;
    
    function main(options, imports, register) {
        var Dialog = imports.Dialog;
        var ui = imports.ui;
        var folder = require('./folder');
        var $ = require('./jquery');
        
        var dialog = new Dialog('Ethergit', main.consumes, {
            name: 'sandbox-transaction',
            allowClose: true,
            title: 'Transaction',
            width: 500,
            elements: [
                {
                    type: 'button', id: 'closeTransactionDialog', color: 'blue',
                    caption: 'Close', 'default': true, onclick: hideDialog
                }
            ]
        });
        
        dialog.on('draw', function(e) {
            e.html.innerHTML = require('text!./transaction.html');
            $(e.html).click(folder.foldOrUnfold);
        });

        function showTransaction(sandbox, id) {
            dialog.show();
            var $container = $('[data-name=transaction]');
            var tx = sandbox.transactions()[id];
            Object.keys(tx).forEach(function(field) {
                $container.find('[data-name=' + field + ']').text(tx[field]);
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
    }
});
