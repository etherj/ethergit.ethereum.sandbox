define(function(require) {
  main.consumes = [
    'editors', 'Editor', 'ui', 'tabManager', 'settings',
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
    var settings = imports.settings;
    var libs = imports['ethergit.libs'];
    var sandbox = imports['ethergit.sandbox'];

    var async = require('async');
    var Contract = require('./contract');
    var formatter = require('./formatter');
    var utils = require('./utils');
    var folder = require('./folder');
    
    var $ = libs.jquery();
    var _ = libs.lodash();
    var SolidityEvent = libs.SolidityEvent();
    var BigNumber = libs.BigNumber();

    var theme = settings.get('user/general/@skin');
    settings.on('user/general/@skin', function(newTheme) {
      theme = newTheme;
    });
    
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
        installTheme($log);
        $root.click(folder.handler);
      });

      ethConsole.on('documentLoad', function(e) {
        e.doc.title = 'Ethereum Console';
      });

      return ethConsole;

      function log(entry) {
        if (_.isString(entry)) $log.append('<li>' + entry + '</li>');
        else $log.append($('<li>').append(entry));
      }

      function error(entry) {
        $log.append('<li class="ethereum-console-warning">' + entry + '</li>');
      }

      function clear() {
        $log.empty();
      }

      function installTheme($el) {
        $el.addClass(settings.get('user/general/@skin'));
        settings.on('user/general/@skin', function(newTheme, oldTheme) {
          $el.removeClass(oldTheme).addClass(newTheme);
        }, ethConsole);
      }
    }
    
    var handle = editors.register('ethereum-console', 'Ethereum Console', EthereumConsole, []);

    var inProcess = false, pendingEntries = [];
    handle.on('load', function() {
      var filter;
      sandbox.on('select', function() {
        if (filter) {
          filter.stopWatching();
          filter = null;
        }
        if (sandbox.getId()) {
          filter = sandbox.web3.eth.filter({});
          filter.watch(function(err, entry) {
            if (err) console.error(err);
            else printLog(entry);
          });
        }
      });

      function printLog(entry) {
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
          var data = entry.data;
          var topics = entry.topics;
          var contract = options.contracts.hasOwnProperty(address) ?
                Object.create(Contract).init(address, options.contracts[address]) :
                null;
          if (!contract) {
            logger.log(log(address, [data], topics));
          } else {
            var event = topics.length > 0 ? contract.findEvent(topics[0]) : null;
            if (event) {
              logger.log(showEvent(contract.name, event, data, topics));
            } else {
              logger.log(log(contract.name, split(data), topics));
            }
          }
          function split(str) {
            var match = str.substr(2).match(/.{1,64}/g);
            return match ? _.map(match, function(data) { return '0x' + data; }) : [];
          }
        }

        function showEvent(contractName, event, data, topics) {
          var e = new SolidityEvent(null, event, null);
          var result = e.decode({ data: data, topics: topics });
          return 'Sandbox Event (' + contractName + '.' + event.name + '): ' +
            _(result.args).map(function(val) {
              if (isBigNumber(val)) return val.toString();
              else return JSON.stringify(val);
            }).join(', ');
        }
        
        function log(contractName, data, topics) {
          var $el = $('<span>Sandbox LOG (' + contractName + '): <span data-name="data"></span></span>');
          var $data = $el.find('[data-name=data]');
          _(data).concat(topics)
            .map(function(value) {
              return formatter(value);
            })
            .each(function($value) {
              $data.append($value);
            })
            .value();
          return $el;
        }

        function isBigNumber(object) {
          return object instanceof BigNumber ||
            (object && object.constructor && object.constructor.name === 'BigNumber');
        };
      }
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
        // workaround for tab styles
        if (!tab.classList.names.contains(theme)) tab.classList.add(theme);
        if (!tab.classList.names.contains('tab5')) tab.classList.add('tab5');
        cb(null, tab.editor);
      });
    }
  }
});
