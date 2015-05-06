define(function(require) {
    main.consumes = ['Dialog', 'ui', 'Form'];
    main.provides = ['ethergit.ethereum.sandbox.dialog.pkey'];
    
    return main;
    
    function main(options, imports, register) {
        var Dialog = imports.Dialog;
        var ui = imports.ui;
        var Form = imports.Form;
        
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
        
        var form = new Form({
            rowheight: 30,
            colwidth: 100,
            edge: "0 0 0 0",
            form: [
                {   
                    title: 'Private key',
                    name: 'pkey',
                    type: 'textbox'
                }
            ]
        });
        
        function hideDialog() {
            dialog.hide();
        }
        
        function ask(cb) {
            dialog.update([
                {
                    id: 'privateKeyDialogOk',
                    onclick: function() {
                        cb(form.toJson());
                        hideDialog();
                    }
                }
            ]);
            dialog.show();
        }
        
        dialog.on('draw', function(e) {
            ui.insertCss('.bk-container .label { color: #222222; }', false, dialog);
            form.attachTo(e.html);
        });
        
        dialog.on('show', function() {
            form.reset();
        });
        
        dialog.on('load', function() {

        });
        
        dialog.freezePublicAPI({
            ask: ask
        });
        
        register(null, {
            'ethergit.ethereum.sandbox.dialog.pkey': dialog
        });
    }
});