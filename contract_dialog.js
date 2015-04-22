define(function(require) {
    main.consumes = ['Dialog', 'ui'];
    main.provides = ['ethergit.ethereum.sandbox.dialog.contract'];
    
    return main;
    
    function main(options, imports, register) {
        var Dialog = imports.Dialog;
        var ui = imports.ui;
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
        require(['jquery', './formatter', './folder'], function($, formatter, folder) {
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
            });

            function showContract(sandbox, address) {
                dialog.show();
                var contract = sandbox.contracts[address];
                var $container = $('[data-name=contract]');
                $container.find('[data-name=name]').text(contract.name);
                $container.click(function(e) {
                    formatter.format(e);
                    if ($(e.target).data('formatter'))
                        folder.init($(e.target).parent().parent());
                });
                $container.click(folder.foldOrUnfold);
                
                var $methods = $container.find('[data-name=methods]').empty();
                contract.abi.forEach(function(method) {
                    var $method = $(require('text!./contract_method.html'));
                    $method.find('[data-name=name]').text(method.name);
                    
                    var $args = $method.find('[data-name=args]');
                    method.inputs.forEach(function(input) {
                        $args.append('<tr><td>' + input.name + ' : ' + getTypeLabel(input.type) + '</td><td><input type="text"></td></tr>');
                    });

                    $method.find('[data-name=call]').click(function(e) {
                        var args = $(e.target).parent().find('input').map(function() {
                            return $(this).val();
                        });
                        sandbox.callContractMethod(address, method, args, function(err, results) {
                            if (err) return console.error(err);
                            
                            if (results.vm.hasOwnProperty('returnValue')) {
                                $method.find('[data-name=returnValue]')
                                    .text(results.vm.returnValue.toString('hex'))
                                    .parent().show();
                                formatter.init($method);
                                folder.init($method);
                            }
                        });
                    });
                    
                    $methods.append($method);
                });
            }
            
            function getTypeLabel(type) {
                if (type === 'address') return 'address';
                if (type.indexOf('bytes') > -1) return 'string';
                return 'number';
            }
            
            function hideDialog() {
                dialog.hide();
            }
            
            dialog.on('load', function() {
                ui.insertCss(require('text!./contract.css'), false, dialog);
            });
            
            dialog.freezePublicAPI({
                showContract: showContract
            });
            
            register(null, {
                'ethergit.ethereum.sandbox.dialog.contract': dialog
            });
        });
    }
});