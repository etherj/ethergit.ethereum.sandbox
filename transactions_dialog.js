define(function(require) {
    main.consumes = [
        'Dialog', 'ui', 'dialog.error', 'dialog.notification', 'http',
        'ethergit.ethereum.sandbox.dialog.transaction',
        'ethergit.ethereum.sandbox.dialog.new.tx'
    ];
    main.provides = ['ethergit.ethereum.sandbox.dialog.transactions'];
    
    return main;
    
    function main(options, imports, register) {
        var Dialog = imports.Dialog;
        var ui = imports.ui;
        var errorDialog = imports['dialog.error'];
        var notificationDialog = imports['dialog.notification'];
        var http = imports.http;
        var transactionDialog = imports['ethergit.ethereum.sandbox.dialog.transaction'];
        var newTxDialog = imports['ethergit.ethereum.sandbox.dialog.new.tx'];
        var $ = require('./jquery');
        var async = require('async');

        var stablenetUrl = 'http://stablenet.blockapps.net/includetransaction';

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
                    type: 'button', id: 'transactionsDialogSendToNetwork', color: 'red',
                    caption: 'Send to Network', 'default': false, onclick: sendToNetwork
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
//            dialog.aml.setAttribute('zindex', dialog.aml.zindex - 890000);            
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
            sandbox.transactions(function(err, transactions) {
                transactions.forEach(function(tx, id) {
                    $container.append(
                        $('<tr>')
                            .append('<td data-name="from" class="from">' + tx.from + '<span data-name="id" style="display:none">' + id + '</span></td>')
                            .append('<td>' + tx.nonce + '</td>')
                            .append('<td>' + (tx.to.length === 0 ? '[contract create]' : tx.to) + '</td>')
                    );
                });
            });
        }
        
        function openNewTxDialog() {
            newTxDialog.show();
        }

        function sendToNetwork() {
            sandbox.transactions(function(err, transactions) {
                if (err) return errorDialog.show(err);
                async.eachSeries(transactions, sendTx, function(err) {
                    if (err) {
                        console.error(err);
                        errorDialog.show(err);
                    } else {
                        notificationDialog.show('All transactions have been sent');
                    }
                });

                function sendTx(tx, cb) {
                    var txMsg = {
                        from : tx.from,
                        nonce : tx.nonce,
                        gasPrice : tx.gasPrice,
                        gasLimit : tx.gasLimit,
                        value : tx.value.toString(),
                        codeOrData: tx.data,
                        r : tx.r,
                        s : tx.s,
                        v : tx.v,
                        hash : tx.hash
                    };
                    http.request(
                        stablenetUrl,
                        {
                            method: 'POST',
                            contentType: 'application/json; charset=UTF-8',
                            body: JSON.stringify(txMsg)
                        },
                        function(err, data) {
                            cb(err);
                        }
                    );
                }
            });
        }
        
        function hideDialog() {
            dialog.hide();
        }

        dialog.on('hide', function() {
            sandbox.off('changed', render);
        });
        
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
