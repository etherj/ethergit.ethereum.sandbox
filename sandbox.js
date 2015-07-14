define(function(require, exports, module) {
    main.consumes = [
        'Plugin', 'commands', 'ui', 'layout', 'fs', 'dialog.error', 'find', 'tabManager',
        'ethergit.solidity.compiler',
        'ethergit.sandbox',
        'ethergit.ethereum.sandbox.panel',
        'ethergit.ethereum.sandbox.dialog.transactions',
        'ethereum-console',
        'ethergit.libs'
    ];
    main.provides = ['ethergit.ethereum.sandbox'];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var commands = imports.commands;
        var ui = imports.ui;
        var layout = imports.layout;
        var fs = imports.fs;
        var errorDialog = imports['dialog.error'];
        var find = imports.find;
        var tabs = imports.tabManager;
        var sandbox = imports['ethergit.sandbox'];
        var sandboxPanel = imports['ethergit.ethereum.sandbox.panel'];
        var compiler = imports['ethergit.solidity.compiler'];
        var transactionsDialog = imports['ethergit.ethereum.sandbox.dialog.transactions'];
        var ethConsole = imports['ethereum-console'];
        var libs = imports['ethergit.libs'];
        
        var async = require('async');
        var utils = require('./utils');
        var formatter = require('./formatter');
        var Contract = require('./contract');

        var _ = libs.lodash();
        
        var plugin = new Plugin('Ethergit', main.consumes);
        
        function load() {
            
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
