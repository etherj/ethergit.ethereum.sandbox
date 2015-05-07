define(function(require) {
    main.consumes = [
        'Dialog', 'ui', 'Form',
        'ethergit.sandbox', 'ethergit.ethereum.sandbox.dialog.pkey'
    ];
    main.provides = ['ethergit.ethereum.sandbox.dialog.new.tx'];
    
    return main;
    
    function main(options, imports, register) {
        var Dialog = imports.Dialog;
        var ui = imports.ui;
        var Form = imports.Form;
        var sandbox = imports['ethergit.sandbox'];
        var pkeyDialog = imports['ethergit.ethereum.sandbox.dialog.pkey'];
        
        var dialog = new Dialog('Ethergit', main.consumes, {
            name: 'sandbox-new-tx',
            allowClose: true,
            title: 'New Transaction',
            width: 500,
            elements: [
                {
                    type: 'button', id: 'newTxDialogOk', color: 'green',
                    caption: 'OK', 'default': true, onclick: send
                },
                {
                    type: 'button', id: 'newTxDialogCancel', color: 'blue',
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
                    title: 'From',
                    name: 'from',
                    type: 'dropdown'
                },
                {
                    title: 'To',
                    name: 'to',
                    type: 'dropdown'
                },
                {
                    title: 'Value',
                    name: 'value',
                    type: 'textbox',
                    defaultValue: '0'
                },
                {
                    name: 'error',
                    type: 'label',
                    caption: ''
                }
            ]
        });
        
        function send() {
            var options = form.toJson();
            
            if (!/^\d+$/.test(options.value)) {
                form.getElement('error').setAttribute('caption', 'Value must be a digit.');
            } else {
                var pkey = sandbox.env()[options.from].pkey;
                if (pkey !== null) sendTx(pkey);
                else {
                    pkeyDialog.ask(function(data) {
                        sendTx(data.pkey);
                    });
                }
            }
            
            function sendTx(pkey) {
                sandbox.runTx({
                    from: options.from,
                    to: options.to,
                    value: parseInt(options.value, 10).toString(16),
                    pkey: pkey
                }, function(err) {
                    if (err) {
                        form.getElement('error').setAttribute('caption', err);
                    } else {
                        form.getElement('error').setAttribute('caption', '');
                        hideDialog();
                    }
                });
            }
        }
        
        function hideDialog() {
            dialog.hide();
        }
        
        dialog.on('draw', function(e) {
            ui.insertCss('.bk-container .label { color: #222222; }', false, dialog);
            form.attachTo(e.html);
            dialog.aml.setAttribute('zindex', dialog.aml.zindex - 890000);
        });
        
        dialog.on('show', function() {
            form.reset();
            
            var items = [];
            var env = sandbox.env();
            Object.keys(env).forEach(function(address) {
                var pkey = env[address].pkey;
                items.push({ caption: address + (pkey ? ' (' + pkey + ')' : ''), value: address });
            });
            form.update([{
                id: 'from',
                value: items[0].value,
                items: items
            }]);
            
            sandbox.accounts(function(err, accounts) {
                if (err) return console.error(err);
                
                var items = Object.keys(accounts).map(function(address) {
                    return { caption: address, value: address };
                });
                form.update([{
                    id: 'to',
                    value: items[0].value,
                    items: items
                }]);
            });
        });
        
        dialog.on('load', function() {
        });
        
        dialog.freezePublicAPI({
        });
        
        register(null, {
            'ethergit.ethereum.sandbox.dialog.new.tx': dialog
        });
    }
});