define(function(require) {
    main.consumes = [
        'Panel', 'ui', 'apf',
        'ethergit.libs',
        'ethergit.ethereum.sandbox.dialog.contract',
        'ethergit.sandbox'
    ];
    main.provides = ['ethergit.ethereum.sandbox.panel'];
    
    return main;
    
    function main(options, imports, register) {
        var Panel = imports.Panel;
        var ui = imports.ui;
        var apf = imports.apf;
        var libs = imports['ethergit.libs'];
        var contractDialog = imports['ethergit.ethereum.sandbox.dialog.contract'];
        var sandbox = imports['ethergit.sandbox'];

        var accountTemplate = require('text!./account.html');
        var async = require('async');
        var folder = require('./folder');
        var formatter = require('./formatter');

        var $ = libs.jquery();

        apf.config.setProperty('allow-select', true);

        var panel = new Panel('Ethergit', main.consumes, {
            index: 300,
            width: 400,
            caption: 'Ethereum Sandbox',
            minWidth: 300,
            where: 'right'
        });

        var $id, $sandbox;
        
        panel.on('load', function() {
            ui.insertCss(require('text!./style.css'), false, panel);
            panel.setCommand({
                name: 'sandboxPanel',
                hint: 'Ethereum Sandbox Panel',
                bindKey: { mac: 'Command-Shift-E', win: 'Ctrl-Shift-E' }
            });
            sandbox.on('select', function() {
                if (sandbox.getId()) {
                    panel.show();
                    panel.render();
                    watcher.start();
                } else {
                    panel.hide();
                    panel.render();
                    watcher.stop();
                }
            }, panel);
            sandbox.on('changed', function() { watcher.redraw = true; });
        });

        panel.on('draw', function(e) {
            var $root = $(e.html);
            $root.append(require('text!./sandbox_panel.html'));
            $id = $root.find('[data-name=sandbox-id]');
            $sandbox = $root.find('[data-name=accounts-container]');
            $sandbox.click(folder.foldOrUnfold);
            $sandbox.click(formatter.format.bind(formatter));
            $sandbox.click(function(e) {
                var $el = $(e.target);
                if ($el.data('name') === 'contract') {
                    var address = $el.parent().find('[data-name=address]').text();
                    contractDialog.showContract(address);
                }
            });
        });

        var watcher = {
            redraw: false,
            interval: undefined,
            start: function() {
                clearInterval(this.interval);
                this.interval = setInterval((function() {
                    if (this.redraw && !rendering) {
                        this.redraw = false;
                        panel.render();
                    }
                }).bind(this), 1000);
            },
            stop: function() {
                clearInterval(this.interval);
            }
        };

        var rendering = false;
        panel.render = function() {
            if ($sandbox === null) return;
            if (!sandbox.getId()) {
                $id.text('Not started');
                $sandbox.empty();
            } else {
                rendering = true;
                $id.text(sandbox.getId());
                var $container = $('<div></div>');
                renderAccounts($container, sandbox, function(err) {
                    rendering = false;
                    if (err) return console.error(err);
                    $sandbox.html($container);
                    folder.init($sandbox);
                });
            }
        };
                
        function renderAccounts($container, sandbox, cb) {
            sandbox.contracts(function(err, contracts) {
                if (err) return cb(err);
                getAccounts(sandbox, showAccount.bind(undefined, $container, sandbox, contracts), cb);
            });
            
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
                    $container.find('[data-name=balance]').text(
                        formatter.getFormatter('number').format(account.balance.toString('hex'))
                    );
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
        
        panel.freezePublicAPI({
        });
        
        register(null, {
            'ethergit.ethereum.sandbox.panel': panel
        });
    }
});
