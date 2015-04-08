define(function(require, exports, module) {
    main.consumes = ['Plugin', 'commands', 'ui', 'layout', 'fs', 'dialog.error', 'tabManager', 'ethergit.solidity.compiler', 'ethergit.ethereum.sandbox.panel'];
    main.provides = ['ethergit.ethereum.sandbox'];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var commands = imports.commands;
        var ui = imports.ui;
        var layout = imports.layout;
        var fs = imports.fs;
        var errorDialog = imports['dialog.error'];
        var tabs = imports.tabManager;
        var compiler = imports['ethergit.solidity.compiler'];
        var panel = imports['ethergit.ethereum.sandbox.panel'];
        
        var Sandbox = require('./ethereum_sandbox.js');
        var Buffer = require('./buffer.js').Buffer;
        
        var plugin = new Plugin('Ethergit', main.consumes);
        
        function load() {
            commands.addCommand({
                name: 'runSandbox',
                exec: function() {
                    readSandboxEnv(function(err, content) {
                        if (err) return errorDialog.show(err);
                        
                        try {
                            var config = JSON.parse(content);
                        } catch(e) {
                            return errorDialog.show('Could not parse sandbox.json: ' + e.message);
                        }
                        
                        runSandbox(config, function(err) {
                            if (err) return errorDialog.show(err);
                        });
                    });
                }
            }, plugin);
            
            var btnSandbox = ui.insertByIndex(
                layout.getElement('barTools'),
                new ui.button({
                    id: 'btnSandbox',
                    skin: 'c9-toolbarbutton-glossy',
                    command: 'runSandbox',
                    caption: 'Sandbox',
                    disabled: false,
                    class: 'runbtn stopped',
                    icon: 'run.png'
                }),
                300, plugin
            );
        }
        
        function readSandboxEnv(cb) {
            fs.readFile('/sandbox.json', cb);
        }
        
        function runSandbox(config, cb) {
            var sandbox = Object.create(Sandbox).init();
            panel.showSandbox(sandbox);
            sandbox.initEnv(config.env, function(err) {
                if (err) return cb(err);

                // var text = tabs.focussedTab.document.value;
                // compiler.binary(text, function(err, binary) {
                //     if (err) return console.error(err);
                    
                //     console.log('code: ' + binary.toString('hex'));
                    
                //     sandbox.runTx(sandbox.createTx({
                //         nonce: 0,
                //         data: new Buffer(binary, 'hex'),
                //         seed: 'cow'
                //     }), function(err, results) {
                //         if (err) return console.error(err);
                        
                //         console.log('created address: ' + results.createdAddress.toString('hex'));
                //     });
                // });
            });
        }
        
        plugin.on('load', function() {
            load();
        });
        plugin.on('unload', function() {
        
        });
        
        plugin.freezePublicAPI({
            
        });
        
        register(null, {
            'ethergit.ethereum.sandbox': plugin
        });
    }
});