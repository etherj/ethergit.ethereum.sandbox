define(function(require) {
    main.consumes = [
        'Dialog', 'ui', 'dialog.error',
        'ethergit.libs',
        'ethergit.ethereum.sandbox.dialog.pkey',
        'ethergit.sandbox'
    ];
    main.provides = ['ethergit.ethereum.sandbox.dialog.contract'];
    
    return main;
    
    function main(options, imports, register) {
        var Dialog = imports.Dialog;
        var ui = imports.ui;
        var showError = imports['dialog.error'].show;
        var libs = imports['ethergit.libs'];
        var pkeyDialog = imports['ethergit.ethereum.sandbox.dialog.pkey'];
        var sandbox = imports['ethergit.sandbox'];
        var async = require('async');
        var formatter = require('./formatter');
        var folder = require('./folder');
        var utils = require('./utils');
        var widgets = require('./ui/widgets');

        var $ = libs.jquery();
        var _ = libs.lodash();
        var web3 = libs.web3();

        // Cached elements
        var $root, $advanced, $sender, $value, $gasPrice, $gasLimit,
            $contract, $name, $methods;
        
        var dialog = new Dialog('Ethergit', main.consumes, {
            name: 'sandbox-contract',
            allowClose: true,
            title: 'Contract',
            width: 500,
            elements: [
                {
                    type: 'button', id: 'closeContractDialog', color: 'blue',
                    caption: 'Close', 'default': true, onclick: hideDialog
                }
            ]
        });
        
        dialog.on('draw', function(e) {
            e.html.innerHTML = require('text!./contract.html');
            $root = $(e.html);
            $advanced = $root.find('[data-name=advanced]');
            $sender = $advanced.find('select[name=sender]');
            $value = $advanced.find('input[name=value]');
            $gasPrice = $advanced.find('input[name=gasPrice]');
            $gasLimit = $advanced.find('input[name=gasLimit]');
            $contract = $root.find('[data-name=contract]');
            $name = $contract.find('[data-name=name]');
            $methods = $contract.find('[data-name=methods]');

            $contract.click(folder.foldOrUnfold);
            
            var showOrHideAdvanced = (function() {
                var $icon = $root.find('[data-name=advanced-btn-icon]');
                return function() {
                    if ($advanced.is(":visible")) {
                        $icon.removeClass('glyphicon-menu-down').addClass('glyphicon-menu-up');
                        $advanced.slideUp({ duration: 500 });
                    } else {
                        $icon.removeClass('glyphicon-menu-up').addClass('glyphicon-menu-down');
                        $advanced.slideDown({ duration: 500 });
                    }
                };
            })();
            $root.find('[data-name=advanced-btn]').click(showOrHideAdvanced);
        });

        function showAdvanced() {
            if (!$advanced.is(":visible")) {
                $root.find('[data-name=advanced-btn-icon]')
                    .removeClass('glyphicon-menu-up')
                    .addClass('glyphicon-menu-down');
                $advanced.slideDown({ duration: 500 });
            }
        }

        function showContract(address) {
            dialog.show();
            
            async.parallel([ showAccounts, showContract ], function(err) {
                if (err) showError(err);
            });

            function showAccounts(cb) {
                async.waterfall([ load, show ], cb);

                function load(cb) {
                    sandbox.predefinedAccounts(cb);
                }
                function show(accounts, cb) {
                    $sender.html(
                        Object.keys(accounts).reduce(function(html, address) {
                            return html + '<option>' + address + '</option>';
                        }, '')
                    );
                    cb();
                }
            }

            function showContract(cb) {
                async.waterfall([ load, show ], cb);

                function load(cb) {
                    sandbox.contracts(function(err, contracts) {
                        if (!contracts.hasOwnProperty(address))
                            return cb('Could not find a contract with address ' + address);
                        cb(null, contracts[address]);
                    });
                }
                function show(contractRaw, cb) {
                    var contract = web3.eth.contract(contractRaw.abi).at('0x' + address);
                    $name.text(contractRaw.name);
                    $methods.empty();

                    var argHtml = function(name, type, widget) {
                        var $html = $(
                            '<div class="form-group">\
                                <label class="col-sm-4 control-label">' + name + ' : ' + type + '</label>\
                                <div class="col-sm-8" data-name="field"></div>\
                            </div>'
                        );
                        $html.find('[data-name=field]').append(widget.html());
                        return $html;
                    };
                    contractRaw.abi
                        .filter(function(method) { return method.type === 'function'; })
                        .forEach(function(method) {
                            var $method = $(require('text!./contract_method.html'));
                            $method.find('[data-name=name]').text(method.name);

                            var argWidgets = [];
                            var $args = $method.find('[data-name=args]');
                            method.inputs.forEach(function(input) {
                                argWidgets[input.name] = widgets(input.type);
                                $args.append(argHtml(input.name, input.type, argWidgets[input.name]));
                            });
                            $method.find('[data-name=call]').click(function(e) {
                                e.preventDefault();
                                var args = _.map(method.inputs, function(arg) {
                                    return argWidgets[arg.name].value();
                                });
                                if (!_.some(args, _.isNull))
                                    call(contract, method, args, $method);
                            });
                            $methods.append($method);
                        });
                    cb();
                }
                function call(contract, method, args, $method) {
                    var $error = $method.find('[data-name=error]');
                    $error.empty();
                    var value = parse($value, 'value');
                    var gasPrice = parse($gasPrice, 'gasPrice');
                    var gasLimit = parse($gasLimit, 'gasLimit');

                    if (value === null || gasPrice == null || gasLimit == null)
                        return showAdvanced();
                    
                    function parse($from, name) {
                        try {
                            return parseInt($from.val());
                        } catch (e) {
                            $from.parent().parent().addClass('has-error');
                            $advanced.find('[data-label=' + name + ']').text(e).show();
                            return null;
                        }
                    }

                    var sender = $sender.val();
                    invoke();
                    /*
                    sandbox.predefinedAccounts(function(err, accounts) {
                        if (err) return showError(err);
                        if (accounts[sender]) invoke(accounts[sender]);
                        else pkeyDialog.ask(sender, invoke);
                    });
                     */
                    
                    function invoke() {
                        var $ret = $method.find('[data-name=ret]');
                        var txHash;
                        
                        args.push({
                            value: value,
                            gas: gasLimit,
                            gasPrice: gasPrice,
                            from: '0x' + sender
                        });
                        args.push(function(error, result) {
                            if (error) $error.text(error.message);
                            else {
                                $method.find('[data-name=ret]').text(
                                    'Waiting for mining of the transaction with hash ' + result
                                ).parent().show();
                                folder.init($method);
                            }
                        });
                        watchBlocks();
                        contract[method.name].apply(this, args);

                        function watchBlocks() {
                            var latestBlock = web3.eth.filter('latest');
                            latestBlock.watch(function(err, result) {
                                if (!txHash) return;
                                web3.sandbox.getTransactionReceipt(txHash, function(err, receipt) {
                                    if (err) console.error(err);
                                    else if (!receipt) return;
                                    else {
                                        window.clearTimeout(timeout);
                                        $ret.text('Returned value: ' + receipt.return);
                                    }
                                });
                            });
                            var timeout = window.setTimeout(function() {
                                latestBlock.stopWatching.bind(latestBlock);
                                $ret.text('Got no transaction receipt in 5 secs');
                            }, 5000);
                        }
                    }
                }
            }
        }

        function toHex(val) {
            if (!/^\d+$/.test(val)) throw 'Should be a number';
            return utils.pad(parseInt(val, 10).toString(16));
        }
        
        function hideDialog() {
            dialog.hide();
        }
        
        ui.insertCss(require('text!./contract.css'), false, dialog);
        
        dialog.freezePublicAPI({
            showContract: showContract
        });
        
        register(null, {
            'ethergit.ethereum.sandbox.dialog.contract': dialog
        });
    }
});
