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
    var utils = require('./utils');
    
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

    var inProcess = false, pendingEntries = [];
    handle.on('load', function() {
      sandbox.on('log', function printLog(entry) {
        if (inProcess) return pendingEntries.push(entry);
        inProcess = true;
        
        async.parallel({
          contracts: sandbox.contracts,
          logger: show
        }, function(err, options) {
          showLog(err, options);
          inProcess = false;
          if (pendingEntries.length != 0) printLog(pendingEntries.shift());
        });
        
        function showLog(err, options) {
          if (err) return console.error(err);

          var logger = options.logger;

          var address = entry.address;
          var data = split(entry.data);
          var topics = entry.topics;
          var contract = options.contracts.hasOwnProperty(address) ?
                Object.create(Contract).init(address, options.contracts[address]) :
                null;
          if (!contract) {
            logger.log(log(address, data, topics));
          } else {
            var event = topics.length > 0 ? contract.findEvent(topics[0]) : null;
            if (event) {
              logger.log(
                event ?
                  showEvent(contract.name, event, data, topics) :
                  log(contract.name, data, topics)
              );
            } else {
              logger.log(log(contract.name, data, topics));
            }
          }
          function split(str) {
            var match = str.substr(2).match(/.{1,64}/g);
            return match ? _.map(match, function(data) { return '0x' + data; }) : [];
          }
        }

        function showEvent(contractName, event, data, topics) {
          topics.shift(); // skip event hash
          return 'Sandbox Event (' + contractName + '.' + event.name + '): ' +
            _(event.inputs).map(function(input) {
              return input.indexed ? topics.shift() : data.shift();
            }).join(', ');
        }
        
        function log(contractName, data, topics) {
          return 'Sandbox LOG (' + contractName + '): ' + _(data).concat(topics).join(', ');
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
