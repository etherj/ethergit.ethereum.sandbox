define(function(require) {
    main.consumes = ['Dialog', 'ethergit.libs'];
    main.provides = ['ethergit.dialog.account'];

    return main;

    function main(options, imports, register) {
        var Dialog = imports.Dialog;
        var libs = imports['ethergit.libs'];

        var utils = require('./utils');
        
        var $ = libs.jquery();
        var _ = libs.lodash();

        var $root, $address, $pkey;

        var dialog = new Dialog('Ethergit', main.consumes, {
            name: 'ethergit-account',
            allowClose: true,
            title: 'Specify Account',
            width: 500,
            elements: [
                {
                    type: 'button', id: 'accountDialogOK', color: 'green',
                    caption: 'OK', 'default': true, onclick: hideDialog
                },
                {
                    type: 'button', id: 'accountDialogCancel',
                    caption: 'Cancel', 'default': false, onclick: hideDialog
                }
            ]
        });

        dialog.on('draw', function(e) {
            e.html.innerHTML = require('text!./account_dialog.html');
            $root = $(e.html);
            $address = $root.find('[data-name=address]');
            $pkey = $root.find('[data-name=pkey]');
        });

        function ask(cb) {
            dialog.show();
            $address.val('');
            $pkey.val('');
            $root.find('[data-label]').hide();
            $root.find('.has-error').removeClass('has-error');
            dialog.update([
                {
                    id: 'accountDialogOK',
                    onclick: function() {
                        $root.find('[data-label]').hide();
                        $root.find('.has-error').removeClass('has-error');
 
                        var address = $address.val();
                        var pkey = $pkey.val();
                        var errors = validate(address, pkey);
                        if (_.size(errors) != 0) {
                            _.each(errors, function(error, name) {
                                $root.find('input[name=' + name + ']')
                                    .parent().parent().addClass('has-error');
                                $root.find('[data-label=' + name + ']')
                                    .text(error).show();
                            });
                        } else {
                            if (pkey.length !== 66) pkey = utils.sha3(pkey);
                            cb(null, { address: address, pkey: pkey });
                            hideDialog();
                        }
                    }
                },
                {
                    id: 'accountDialogCancel',
                    onclick: function() {
                        cb('Canceled');
                        hideDialog();
                    }
                }
            ]);

            function validate(address, pkey) {
                var errors = {};
                if (address.length != 40 || !/^[\dabcdef]*$/.test(address)) {
                    errors.address = 'Address must be hexadecimal string containing 40 characters.';
                }
                if (pkey.length == 0) {
                    errors.pkey = 'Private key should contain at least one symbol.';
                }
                return errors;
            }
        }

        function hideDialog() {
            dialog.hide();
        }

        dialog.freezePublicAPI({
            ask: ask
        });
        
        register(null, {
            'ethergit.dialog.account': dialog
        });

    }
});
