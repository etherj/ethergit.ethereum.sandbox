define(function(require, exports, module) {
    main.consumes = ['Panel', 'commands', 'menus', 'ui', 'layout'];
    main.provides = ['ethergit.ethereum.sandbox'];
    return main;

    function main(options, imports, register) {
        var Panel = imports.Panel;
        var commands = imports.commands;
        var menus = imports.menus;
        var ui = imports.ui;
        var layout = imports.layout;
        
        var plugin = new Panel('Ethergit', main.consumes, {
            index: 200,
            width: 400,
            caption: 'Ethereum Sandbox',
            minWidth: 300,
            where: 'right'
        });
        var emit = plugin.getEmitter();
        
        plugin.on('draw', function(e) {
            e.html.innerHTML = 'Hello World!';
        });
        
        function load() {
            plugin.setCommand({
                name    : 'sandboxPanel',
                hint    : 'Ethereum Sandbox panel',
                bindKey : { mac: 'Command-Shift-E', win: 'Ctrl-Shift-E' }
            });
            
            commands.addCommand({
                name: 'runSandbox',
                exec: function() {
                    console.log('running sandbox!');
                }
            }, plugin);
            
            var BtnSandbox = ui.insertByIndex(
                layout.getElement('barTools'),
                new ui.button({
                    id: 'btnSandbox',
                    skin: 'c9-toolbarbutton-glossy',
                    command: 'runSandbox',
                    caption: 'Sandbox',
                    disabled: false,
                    class: 'runbtn stopped',
                    icon: 'run.png',
                }),
                300, plugin
            );
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