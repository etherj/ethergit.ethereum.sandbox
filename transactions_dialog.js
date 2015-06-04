define(function(require) {
    main.consumes = [
        'Dialog', 'ui',
        'ethergit.ethereum.sandbox.dialog.transaction',
        'ethergit.ethereum.sandbox.dialog.new.tx'
    ];
    main.provides = ['ethergit.ethereum.sandbox.dialog.transactions'];
    
    return main;
    
    function main(options, imports, register) {
        var Dialog = imports.Dialog;
        var ui = imports.ui;
        var transactionDialog = imports['ethergit.ethereum.sandbox.dialog.transaction'];
        var newTxDialog = imports['ethergit.ethereum.sandbox.dialog.new.tx'];
        var $ = require('./jquery');

        var dialog = new Dialog('Ethergit', main.consumes, {
            name: 'sandbox-transactions',
            allowClose: true,
            title: 'Ethereum Sandbox Transactions',
            width: 800,
            elements: [
                {
                    type: 'button', id: 'transactionsDialogNewTx', color: 'green',
                    caption: 'New Transaction', 'default': false, onclick: openNewTxDialog
                },
                {
                    type: 'button', id: 'transactionsDialogClose', color: 'blue',
                    caption: 'Close', 'default': true, onclick: hideDialog
                }
            ]
        });
        
        var sandbox;
        
        dialog.on('draw', function(e) {
            e.html.innerHTML = require('text!./transactions.html');
            dialog.aml.setAttribute('zindex', dialog.aml.zindex - 890000);
            
        });

        function showSandbox(targetSandbox) {
            dialog.show();
            sandbox = targetSandbox;
            render();
            sandbox.on('changed', render, dialog);
            
            $('[data-name=transactions]').off('click').click(function(e) {
                var $el = $(e.target);
                if ($el.data('name') === 'from') {
                    transactionDialog.showTransaction(sandbox, $el.find('[data-name=id]').text());
                }
            });
        }
        
        function render() {
            var $container = $('[data-name=transactions]').empty();
            var transactions = sandbox.transactions();
            transactions.forEach(function(tx, id) {
                $container.append(
                    $('<tr>')
                        .append('<td data-name="from" class="from">' + tx.from + '<span data-name="id" style="display:none">' + id + '</span></td>')
                        .append('<td>' + tx.nonce + '</td>')
                        .append('<td>' + (tx.to.length === 0 ? '[contract create]' : tx.to) + '</td>')
                );
            });
        }
        
        function openNewTxDialog() {
            newTxDialog.show();
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
    }
});
