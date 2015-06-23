define(function(require) {
    main.consumes = [
        'Dialog', 'ui', 'dialog.error', 'http', 'tabManager',
        'ethergit.ethereum.sandbox.dialog.transaction',
        'ethergit.ethereum.sandbox.dialog.new.tx'
    ];
    main.provides = ['ethergit.ethereum.sandbox.dialog.transactions'];
    
    return main;
    
    function main(options, imports, register) {
        var Dialog = imports.Dialog;
        var ui = imports.ui;
        var errorDialog = imports['dialog.error'];

        var http = imports.http;
        var tabs = imports.tabManager;
        var transactionDialog = imports['ethergit.ethereum.sandbox.dialog.transaction'];
        var newTxDialog = imports['ethergit.ethereum.sandbox.dialog.new.tx'];
        var $ = require('./jquery');
        var async = require('async');
        var utils = require('./utils');
        
        var stablenetUrl = 'http://stablenet.blockapps.net';
        var sendTxUrl = stablenetUrl + '/includetransaction';
        var showTxUrl = stablenetUrl + '/query/transaction?hash=';
        var showAccountUrl = stablenetUrl + '/query/account?address=';
        
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

                openLog(function(err, tab) {
                    if (err) return console.error(err);

                    tab.editor.addEntry('Sending transactions...');
                    
                    async.series([
                        checkNonces.bind(null, transactions),
                        sendTransactions.bind(null, transactions)
                    ], function(err) {
                        if (err) errorDialog.show(err);
                    });

                    function checkNonces(transactions, cb) {
                        var accountsMap = transactions
                                .reduce(function(uniqueAccounts, tx) {
                                    if (!uniqueAccounts.hasOwnProperty(tx.from)) {
                                        uniqueAccounts[tx.from] = {
                                            address: tx.from,
                                            nonce: tx.nonce
                                        };
                                    }
                                    return uniqueAccounts;
                                }, {});

                        var accounts = [];
                        for (var address in accountsMap) {
                            accounts.push(accountsMap[address]);
                        }
                        
                        async.each(accounts, getRealNonce, function(err) {
                            if (err) return cb(err);
                            
                            var badAccounts = accounts.filter(function(account) {
                                return account.nonce !== account.realNonce;
                            });

                            if (badAccounts.length !== 0) {
                                badAccounts.each(function(badAccount) {
                                    tab.editor.addEntry(
                                        'The nonce for [' +
                                            '<a target="_blank" href="' + showAccountUrl + badAccount.address + '">' +
                                            badAccount.address + '</a>] in stable network is ' + badAccount.realNonce.toString(16)
                                    );
                                });
                                tab.editor.addEntry('Please update sandbox values to sync with stable network');
                                cb('Please update sandbox values to sync with stable network');
                            } else cb();
                        });
                        
                        function getRealNonce(account, cb) {
                            http.request(showAccountUrl + account.address, function(err, realAccount) {
                                if (err) return cb(err);
                                account.realNonce = realAccount.length === 0 ? 0 : realAccount[0].nonce;
                                cb();
                            });
                        }
                    }

                    function sendTransactions(transactions, cb) {
                        async.eachSeries(transactions, sendTx, function(err) {
                            if (err) {
                                console.error('Could not send a transaction to stable net: ' + err);
                                tab.editor.addEntry('Could not send a transaction to stable net: ' + err);
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
                            if (tx.to) txMsg.to = tx.to;
                            
                            http.request(
                                sendTxUrl,
                                {
                                    method: 'POST',
                                    contentType: 'application/json; charset=UTF-8',
                                    body: JSON.stringify(txMsg)
                                },
                                function(err, data) {
                                    if (err) return cb(err);
                                    
                                    var txId = data.substr(data.indexOf('hash=') + 5);
                                    var newAddress = tx.to ?
                                            undefined :
                                            utils.calcNewAddress(tx.from, tx.nonce).toString('hex');
                                    tab.editor.addEntry(txEntry(txId, newAddress));
                                    cb(null);

                                    function txEntry(txId, newAddress) {
                                        var msg = 'The transaction has been sent ' +
                                                '<a target="_blank" href="' + showTxUrl + txId + '">' + txId + '</a>';
                                        if (newAddress)
                                            msg += ' (a new contract created: <a target="_blank" href="' + showAccountUrl + newAddress + '">' + newAddress + '</a>)';
                                        return msg;
                                    }
                                }
                            );
                        }
                    }
                });
            });
        }

        function openLog(cb) {
            var pane = tabs.getPanes().length > 1 ?
                    tabs.getPanes()[1] :
                    tabs.getPanes()[0].vsplit(true);
            
            tabs.open({
                editorType: 'stablenet-log',
                title: 'Stablenet Log',
                active: true,
                pane: pane,
                demandExisting: true
            }, function(err, tab) {
                if (!tab.classList.names.contains('dark')) tab.classList.add('dark');
                cb(err, tab);
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
