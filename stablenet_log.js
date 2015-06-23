define(function(require) {
    main.consumes = ['editors', 'Editor', 'ui'];
    main.provides = ['stablenet-log'];

    return main;

    function main(options, imports, register) {
        var editors = imports.editors;
        var Editor = imports.Editor;
        var ui = imports.ui;

        function StablenetLog() {
            var log = new Editor('Ethergit', main.consumes, []);

            log.freezePublicAPI({
                addEntry: addEntry
            });

            ui.insertCss('.stablenet-log { color: white; }', false, log);
            
            log.load(null, 'stablenet-log');

            var container;
            log.on('draw', function(e) {
                var content = e.htmlNode;
                ui.insertHtml(content, '<ul class="stablenet-log" data-name="stablenet-log"></ul>', log);
                container = content.querySelector('ul[data-name=stablenet-log]');
            });

            log.on('documentLoad', function(e) {
                e.doc.title = 'Stablenet Log';
            });

            return log;

            function addEntry(entry) {
                ui.insertHtml(container, '<li>' + entry + '</li>', log);
            }
        }
        
        var handle = editors.register('stablenet-log', 'Stablenet Log', StablenetLog, []);

        register(null, {
            'stablenet-log': handle
        });
    }
});
