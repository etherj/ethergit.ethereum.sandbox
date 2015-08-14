define(function(require) {
    main.consumes = ['Dialog', 'ui', 'Form', 'ethergit.libs'];
    main.provides = ['ethergit.ethereum.sandbox.dialog.pkey'];
    
    return main;
    
    function main(options, imports, register) {
        var Dialog = imports.Dialog;
        var ui = imports.ui;
        var Form = imports.Form;
        var libs = imports['ethergit.libs'];
        var utils = require('./utils');

        var $ = libs.jquery();
        
        var $pkey, $address;
        
        var dialog = new Dialog('Ethergit', main.consumes, {
            name: 'sandbox-pkey',
            allowClose: true,
            title: 'Enter Private Key',
            width: 500,
            elements: [
                {
                    type: 'button', id: 'privateKeyDialogOk', color: 'green',
                    caption: 'OK', 'default': true, onclick: hideDialog
                },
                {
                    type: 'button', id: 'privateKeyDialogCancel', color: 'blue',
                    caption: 'Cancel', 'default': false, onclick: hideDialog
                }
            ]
        });

        dialog.on('draw', function(e) {
            e.html.innerHTML = require('text!./pkey.html');
            var $root = $(e.html);
            $address = $root.find('[data-name=address]');
            $pkey = $root.find('[data-name=pkey]');
        });
        
        function hideDialog() {
            dialog.hide();
        }
        
        function ask(address, cb) {
            dialog.show();
            $address.text(address);
            $pkey.val('');
            dialog.update([
                {
                    id: 'privateKeyDialogOk',
                    onclick: function() {
                        var pkey = $pkey.val();
                        if (pkey.length !== 64) pkey = utils.sha3(pkey);
                        cb(pkey);
                        hideDialog();
                    }
                }
            ]);
        }        
        
        dialog.freezePublicAPI({
            ask: ask
        });
        
        register(null, {
            'ethergit.ethereum.sandbox.dialog.pkey': dialog
        });
    }
});
