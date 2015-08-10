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
        var _ = libs.lodash();

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
                $log.append('<li class="ethereum-console-warning">' + entry + '</li>');
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

                    var address = entry.address.substr(2);
                    var data = split(entry.data.substr(2));
                    var topics = _.invoke(entry.topics, 'substr', 2);
                    var contract = contracts.hasOwnProperty(address) ?
                            Object.create(Contract).init(entry.address, contracts[address]) :
                            null;
                    if (!contract) {
                        logger.log(log(address, data, topics));
                    } else if (topics.length > 0 && topics[0].length === 64) {
                        var event = contract.findEvent(topics[0]);
                        logger.log(
                            event ?
                                showEvent(contract.name, event, data, topics) :
                                log(contract.name, data, topics)
                        );
                    } else {
                        logger.log(log(contract.name, data, topics));
                    }
                    function split(str) {
                        return str.match(/.{1,64}/g);
                    }
                }

                function showEvent(contractName, event, data, topics) {
                    topics.shift(); // skip event hash
                    return 'Sandbox Event (' + contractName + '.' + event.name + '): ' +
                        _(event.inputs).map(function(input) {
                            var val = input.indexed ? topics.shift() : data.shift();
                            return _.escape(formatter.findFormatter(input.type).format(val));
                        }).join(', ');
                }
                
                function log(contractName, data, topics) {
                    return 'Sandbox LOG (' + contractName + '): ' +
                        _(data).concat(topics)
                        .map(function(val) {
                            return _.escape(formatter.getFormatter('data').format(val));
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
