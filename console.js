define(function(require) {
    main.consumes = ['editors', 'Editor', 'ui', 'tabManager'];
    main.provides = ['ethereum-console'];

    return main;

    function main(options, imports, register) {
        var editors = imports.editors;
        var Editor = imports.Editor;
        var ui = imports.ui;
        var tabs = imports.tabManager;

        function EthereumConsole() {
            var ethConsole = new Editor('Ethergit', main.consumes, []);

            ethConsole.freezePublicAPI({
                log: log
            });

            ui.insertCss(require('text!./console.css'), false, ethConsole);
            
            ethConsole.load(null, 'ethereum-console');

            var container;
            ethConsole.on('draw', function(e) {
                var content = e.htmlNode;
                ui.insertHtml(
                    content,
                    '<div class="ethereum-console-container">\
                        <ul class="ethereum-console list-unstyled" data-name="ethereum-console"></ul>\
                    </div>',
                    ethConsole
                );
                container = content.querySelector('ul[data-name=ethereum-console]');
            });

            ethConsole.on('documentLoad', function(e) {
                e.doc.title = 'Ethereum Console';
            });

            return ethConsole;

            function log(entry) {
                ui.insertHtml(container, '<li>' + entry + '</li>', ethConsole);
            }
        }
        
        var handle = editors.register('ethereum-console', 'Ethereum Console', EthereumConsole, []);

        handle.freezePublicAPI({
            log: function(entry) {
                showLog(function(err, tab) {
                    if (err) console.error(err);
                    else tab.editor.log(entry);
                });
            }
        });
        
        register(null, {
            'ethereum-console': handle
        });

        function showLog(cb) {
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
                if (!tab.classList.names.contains('dark')) tab.classList.add('dark');
                cb(err, tab);
            });
        }
    }
});
