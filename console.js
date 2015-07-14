define(function(require) {
    main.consumes = [
        'editors', 'Editor', 'ui', 'tabManager',
        'ethergit.libs',
        'ethergit.sandbox'
    ];
    main.provides = ['ethereum-console'];

    return main;

    function main(options, imports, register) {
        var editors = imports.editors;
        var Editor = imports.Editor;
        var ui = imports.ui;
        var tabs = imports.tabManager;
        var libs = imports['ethergit.libs'];
        var sandbox = imports['ethergit.sandbox'];

        var async = require('async');
        var Contract = require('./contract');
        var formatter = require('./formatter');
        
        var $ = libs.jquery();

        function EthereumConsole() {
            var ethConsole = new Editor('Ethergit', main.consumes, []);

            ethConsole.freezePublicAPI({
                log: log,
                error: error,
                clear: clear
            });

            ui.insertCss(require('text!./console.css'), false, ethConsole);
            
            ethConsole.load(null, 'ethereum-console');

            var $log;
            ethConsole.on('draw', function(e) {
                var $root = $(e.htmlNode).html(            
                    '<div class="ethereum-console-container">\
                        <ul class="ethereum-console list-unstyled" data-name="ethereum-console"></ul>\
                    </div>'
                );
                $log = $root.find('ul[data-name=ethereum-console]');
            });

            ethConsole.on('documentLoad', function(e) {
                e.doc.title = 'Ethereum Console';
            });

            return ethConsole;

            function log(entry) {
                $log.append('<li>' + entry + '</li>');
            }

            function error(entry) {
                $log.append('<li class="text-danger">' + entry + '</li>');
            }

            function clear() {
                $log.empty();
            }
        }
        
        var handle = editors.register('ethereum-console', 'Ethereum Console', EthereumConsole, []);

        handle.on('load', function() {
            sandbox.on('log', function(entry) {
                async.parallel({
                    contracts: sandbox.contracts,
                    logger: show
                }, showLog);
                
                function showLog(err, options) {
                    if (err) return console.error(err);

                    var contracts = options.contracts;
                    var logger = options.logger;
                    
                    var contract = contracts.hasOwnProperty(entry.address) ?
                            Object.create(Contract).init(entry.address, contracts[entry.address]) :
                            null;
                    if (!contract) {
                        logger.log(log('Unknown', entry));
                    } else if (entry.topics.length > 0 && entry.topics[0].length === 64) {
                        var event = contract.findEvent(entry.topics[0]);
                        logger.log(
                            event ?
                                showEvent(contract.name, event, entry) :
                                log(contract.name, entry)
                        );
                    } else {
                        logger.log(log(contract.name, entry));
                    }
                }

                function showEvent(contractName, event, entry) {
                    entry.topics.shift(); // skip event hash
                    return 'Sandbox Event (' + contractName + '.' + event.name + '): ' +
                        _(event.inputs).map(function(input) {
                            var val = input.indexed ?
                                    entry.topics.shift() : entry.data.shift();
                            return _.escape(formatter.findFormatter(input.type).format(val));
                        }).join(', ');
                }
                
                function log(contractName, entry) {
                    return 'Sandbox LOG (' + contractName + '): ' +
                        _(entry.data).concat(entry.topics)
                        .map(function(val) {
                            return _.escape(formatter.detectType(val).format(val));
                        })
                        .join(', ');
                }
            });
        });
        
        handle.freezePublicAPI({
            logger: show
        });
        
        register(null, {
            'ethereum-console': handle
        });

        function show(cb) {
            var pane = tabs.getPanes().length > 1 ?
                    tabs.getPanes()[1] :
                    tabs.getPanes()[0].vsplit(true);
            
            tabs.open({
                editorType: 'ethereum-console',
                title: 'Ethereum Console',
                active: true,
                pane: pane,
                demandExisting: true
            }, function(err, tab) {
                if (err) return cb(err);
                if (!tab.classList.names.contains('dark')) tab.classList.add('dark');
                cb(null, tab.editor);
            });
        }
    }
});
