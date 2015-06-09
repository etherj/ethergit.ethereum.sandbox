define(function(require) {
    main.consumes = [
        'Panel', 'ui', 'apf',
        'ethergit.ethereum.sandbox.dialog.contract',
        'ethergit.sandbox'
    ];
    main.provides = ['ethergit.ethereum.sandbox.panel'];
    
    return main;
    
    function main(options, imports, register) {
        var Panel = imports.Panel;
        var ui = imports.ui;
        var apf = imports.apf;
        var contractDialog = imports['ethergit.ethereum.sandbox.dialog.contract'];
        var sandbox = imports['ethergit.sandbox'];
        var accountTemplate = require('text!./account.html');
        var async = require('async');
        var folder = require('./folder');
        var $ = require('./jquery');
        var formatter = require('./formatter');

        apf.config.setProperty('allow-select', true);

        var panel = new Panel('Ethergit', main.consumes, {
            index: 300,
            width: 400,
            caption: 'Ethergit Sandbox',
            minWidth: 300,
            where: 'right'
        });

        var $sandbox = null;

        panel.on('draw', function(e) {
            $sandbox = $(e.html);
            $sandbox.click(folder.foldOrUnfold);
            $sandbox.click(formatter.format.bind(formatter));
            $sandbox.click(function(e) {
                var $el = $(e.target);
                if ($el.data('name') === 'contract') {
                    var address = $el.parent().find('[data-name=address]').text();
                    contractDialog.showContract(sandbox, address);
                }
            });
            panel.render();
        });
        
        panel.render = function() {
            if ($sandbox === null) return;
            
            if (sandbox.state() === 'CLEAN') {
                $sandbox.html('<div class="accounts-container"><h3>Start Ethereum Sandbox to run your contracts.<h3></div>');
            } else if (sandbox.state() === 'INITIALIZING') {
                $sandbox.html('<div class="accounts-container"><h3>Initializing...<h3></div>');
            } else if (sandbox.state() === 'ACTIVE') {
                renderAccounts(
                    $sandbox.html('<div class="accounts-container">').children(),
                    sandbox,
                    function(err) {
                        if (err) return console.error(err);
                        
                        folder.init($sandbox);
                    }
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
            sandbox.on('changed', panel.render.bind(panel), panel);
        }
        
        function renderAccounts($container, sandbox, cb) {
            sandbox.contracts(function(err, contracts) {
                if (err) return cb(err);
                getAccounts(sandbox, showAccount.bind(undefined, $container, sandbox, contracts), cb);
            });
            
            // TODO: accountHandler might be asynchronous functions, then cb will be called before the rendering really finished.
            function getAccounts(sandbox, accountHandler, cb) {
                sandbox.accounts(function(err, accounts) {
                    if (err) return cb(err);
                    
                    Object.keys(accounts).forEach(function(key) {
                        accountHandler(key, accounts[key]);
                    });
                    cb();
                });
            }
            function showAccount($container, sandbox, contracts, address, account) {
                var $account = $(accountTemplate);
                
                async.parallel([
                    showAccountFields.bind(undefined, $account, sandbox, address, account, contracts),
                    showStorage.bind(undefined, $account.find('[data-name=storage]'), account.storage),
                    showCode.bind(undefined, $account.find('[data-name=code]'), account.code)
                ], function(err) {
                    if (err) return cb(err);
                    formatter.init($account.find('[data-name=storage]'));
                    $container.append($account);
                });

                function showAccountFields($container, sandbox, address, account, contracts, cb) {
                    $container.find('[data-name=address]').text(address);
                    if (contracts.hasOwnProperty(address)) {
                        $container.find('[data-name=contract]').text(contracts[address].name).show();
                    }
                    $container.find('[data-name=nonce]').text(account.nonce.toString('hex'));
                    $container.find('[data-name=balance]').text(account.balance.toString('hex'));
                    cb();
                }
                function showStorage($container, storage, cb) {
                    Object.keys(storage).forEach(function(key) {
                        $container.append(
                            '<tr><td><a href="#" class="button" data-formatter="key">number</button></td>'
                                + '<td data-name="key">' + key + '</td>'
                                + '<td data-folder data-name="value" class="folder">' + storage[key] + '</td>'
                                + '<td><a href="#" class="button" data-formatter="value">number</button></td></tr>'
                        );
                    });
                    cb();
                }
                function showCode($container, code, cb) {
                    $container.text(code);
                    cb();
                }
            }
        }
        
        panel.on('load', function() {
            load();
        });
        
        panel.freezePublicAPI({
        });
        
        register(null, {
            'ethergit.ethereum.sandbox.panel': panel
        });
    }
});
