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
        var Contract = require('./contract');
        var utils = require('./utils');

        var $ = libs.jquery();
        var _ = libs.lodash();

        // Cached elements
        var $root, $error, $advanced, $sender, $value, $gasPrice, $gasLimit,
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
            $error = $root.find('[data-name=error]');
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
                    sandbox.env(cb);
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
                    var contract = Object.create(Contract).init(address, contractRaw);
                    $name.text(contract.name);
                    $methods.empty();

                    var argsForm = _.template(
                        '<div class="form-group">\
                            <label for="<%= name %>" class="col-sm-4 control-label"><%= name %> : <%= type %></label>\
                            <div class="col-sm-8">\
                            <input type="text" name="<%= name %>" class="form-control" placeholder="">\
                            <p data-label="<%= name %>" class="help-block" style="display:none"></p>\
                        </div></div>'
                    );
                    contract.abi
                        .filter(function(method) { return method.type === 'function'; })
                        .forEach(function(method) {
                            var $method = $(require('text!./contract_method.html'));
                            $method.find('[data-name=name]').text(method.name);

                            var $args = $method.find('[data-name=args]');
                            method.inputs.forEach(function(input) {
                                $args.append(argsForm({
                                    name : input.name,
                                    type: getTypeLabel(input.type)
                                }));
                            });

                            $method.find('[data-name=call]').click(function(e) {
                                e.preventDefault();
                                var args = _(method.inputs).indexBy('name').mapValues(function(arg) {
                                    return $method.find('input[name=' + arg.name + ']').val(); 
                                }).value();
                                call(contract, method, args, $method);
                            });
                            
                            $methods.append($method);
                        });
                    
                    cb();
                }
                function call(contract, method, args, $method) {
                    $error.empty();
                    $root.find('[data-label]').hide();
                    $root.find('.has-error').removeClass('has-error');

                    var value = parse($value, 'value');
                    var gasPrice = parse($gasPrice, 'gasPrice');
                    var gasLimit = parse($gasLimit, 'gasLimit');

                    if (value === null || gasPrice == null || gasLimit == null)
                        return showAdvanced();
                    
                    function parse($from, name) {
                        try {
                            return toHex($from.val());
                        } catch (e) {
                            $from.parent().parent().addClass('has-error');
                            $advanced.find('[data-label=' + name + ']').text(e).show();
                            return null;
                        }
                    }

                    var sender = $sender.val();
                    sandbox.env(function(err, env) {
                        if (err) return showError(err);
                        if (env[sender].pkey) invoke(env[sender].pkey);
                        else pkeyDialog.ask(invoke);
                    });

                    
                    function invoke(pkey) {
                        contract.call(sandbox, {
                            from: sender,
                            pkey: pkey,
                            name: method.name,
                            args: args,
                            value: toHex($value.val()),
                            gasPrice: toHex($gasPrice.val()),
                            gasLimit: toHex($gasLimit.val())
                        }, function(errors, results) {
                            if (errors) {
                                if (errors.hasOwnProperty('general'))
                                    $error.text(errors.general);
                                _.each(errors, function(error, name) {
                                    $method.find('input[name=' + name + ']')
                                        .parent().parent().addClass('has-error');
                                    $method.find('[data-label=' + name + ']')
                                        .text(error).show();
                                });
                            } else {
                                if (method.outputs.length > 0) {
                                    $method.find('[data-name=ret]')
                                        .text(
                                            formatter
                                                .findFormatter(method.outputs[0].type)
                                                .format(results.returnValue)
                                        )
                                        .parent().show();
                                    folder.init($method);
                                }
                            }
                        });
                    }
                }
            }
        }
        
        function getTypeLabel(type) {
            if (type === 'address') return 'address';
            if (type.indexOf('bytes') > -1) return 'string';
            return 'number';
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
