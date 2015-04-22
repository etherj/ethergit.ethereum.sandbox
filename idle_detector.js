define(function(require) {
    main.consumes = ['Plugin'];
    main.provides = ['ethergit.idle.detector'];
    
    return main;
    
    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var baseUrl = options.hasOwnProperty('baseUrl') ? options.baseUrl : 'plugins';

        requirejs.config({
            context: 'sandbox',
            paths:{
                // 'jquery': 'http://code.jquery.com/jquery-1.11.2.min'
                'jquery': baseUrl + '/ethergit.ethereum.sandbox/jquery-1.11.2.min'
            },
            shim: {
                'jquery': {
                    exports: 'jQuery',
                }
            }
        });
        require(['jquery'], function($) {
            var plugin  = new Plugin('Ethergit', main.consumes);
            
            function load() {
                var idleTime = 0;
                var idleInterval = setInterval(timerIncrement, 10000);

                $(this).mousemove(function (e) {
                    idleTime = 0;
                });
                $(this).keypress(function (e) {
                    idleTime = 0;
                });

                function timerIncrement() {
                    idleTime = idleTime + 1;
                    if (idleTime === 5) {
                        console.log('5 minute idle.');
                        // Send message to some service.
                        clearInterval(idleInterval);
                    }
                }
            }
            
            plugin.on('load', load);
            plugin.on('unload', function() {});
            
            register(null, { "ethergit.idle.detector": plugin });
        });
    }
});