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
                        type: 'dropdown', 
                        id: 'accounts',
                        width: 330,
                        items: [
                            { caption: 'some' },
                            { caption: 'magic' }
                        ]
                    },
                    { type: 'filler' },
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
                dialog.aml.setAttribute('zindex', 10000);

                var dropdown = dialog.getElement('accounts');
                dropdown.childNodes.slice().forEach(function(node) {
                    dropdown.removeChild(node);
                });
                var env = sandbox.env();
                var first = null;
                Object.keys(env).forEach(function(address) {
                    if (!first) first = address;
                    var pkey = env[address].pkey;
                    var item = new ui.item({ caption: address + (pkey ? ' (' + pkey + ')' : ''), value: address });
                    dropdown.appendChild(item);
                    dialog.addElement(item);
                });
                dropdown.setAttribute('value', first);

                var contract = sandbox.contracts()[address];
                var $container = $('[data-name=contract]');
                $container.find('[data-name=name]').text(contract.name);
                $container.click(folder.foldOrUnfold);
                
                var $methods = $container.find('[data-name=methods]').empty();
                contract.abi.forEach(function(method) {
                    var $method = $(require('text!./contract_method.html'));
                    $method.find('[data-name=name]').text(method.name);
                    
                    var $args = $method.find('[data-name=args]');
                    method.inputs.forEach(function(input) {
                        $args.append('<tr><td>' + input.name + ' : ' + getTypeLabel(input.type) + '</td><td><input name="' + input.name + '" type="text"></td><td><span class="error" data-label="' + input.name + '"></span></td></tr>');
                    });

                    $method.find('[data-name=call]').click(function(e) {
                        $container.find('[data-name=error]').empty();
                        $method.find('[data-label]').empty();

                        var address = dialog.getElement('accounts').value;

                        var args = {};
                        $method.find('input').each(function() {
                            args[$(this).attr('name')] = $(this).val();
                        });
                        contract.call(sandbox, address, env[address].pkey, method.name, args, function(errors, results) {
                            if (errors) {
                                if (errors.hasOwnProperty('general'))
                                    $container.find('[data-name=error]').text(errors.general);

                                Object.keys(errors).forEach(function(name) {
                                    $method.find('[data-label=' + name + ']').text(errors[name]);
                                });
                            } else {
                                if (method.outputs.length > 0) {
                                    $method.find('[data-name=returnValue]')
                                        .text(formatter.findFormatter(method.outputs[0].type).format(results.returnValue))
                                        .parent().show();
                                    folder.init($method);
                                }
                            }
                        });
                    });
                    
                    $methods.append($method);
                });
            }
            
            dialog.on('hide', function() {
                $('[data-name=contract]').off('click');
            });
            
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