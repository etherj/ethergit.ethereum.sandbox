define(function(require) {
    main.consumes = ['editors', 'Editor', 'ui', 'tabManager', 'ethergit.libs'];
    main.provides = ['ethereum-console'];

    return main;

    function main(options, imports, register) {
        var editors = imports.editors;
        var Editor = imports.Editor;
        var ui = imports.ui;
        var tabs = imports.tabManager;
        var libs = imports['ethergit.libs'];

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
