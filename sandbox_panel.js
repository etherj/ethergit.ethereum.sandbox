define(function(require) {
  main.consumes = [
    'Panel', 'ui', 'apf',
    'ethergit.libs',
    'ethergit.ethereum.sandbox.dialog.contract',
    'ethergit.sandbox'
  ];
  main.provides = ['ethergit.ethereum.sandbox.panel'];
  
  return main;
  
  function main(options, imports, register) {
    var Panel = imports.Panel;
    var ui = imports.ui;
    var apf = imports.apf;
    var libs = imports['ethergit.libs'];
    var contractDialog = imports['ethergit.ethereum.sandbox.dialog.contract'];
    var sandbox = imports['ethergit.sandbox'];

    var accountTemplate = require('text!./account.html');
    var async = require('async');
    var folder = require('./folder');
    var formatter = require('./formatter');

    var $ = libs.jquery();
    var _ = libs.lodash();

    apf.config.setProperty('allow-select', true);

    var panel = new Panel('Ethergit', main.consumes, {
      index: 300,
      width: 400,
      caption: 'Ethereum Sandbox',
      minWidth: 300,
      where: 'right'
    });

    var $id, $sandbox, $sandboxes;
    
    panel.on('load', function() {
      ui.insertCss(require('text!./style.css'), false, panel);
      panel.setCommand({
        name: 'sandboxPanel',
        hint: 'Ethereum Sandbox Panel',
        bindKey: { mac: 'Command-Shift-E', win: 'Ctrl-Shift-E' }
      });
      sandbox.on('select', function() {
        if (sandbox.getId()) {
          watcher.redraw = true;
          panel.show();
          watcher.start();
        } else {
          panel.hide();
          watcher.stop();
        }
      }, panel);
      sandbox.on('changed', function() { watcher.redraw = true; });
    });

    panel.on('draw', function(e) {
      var $root = $(e.html);
      $root.append(require('text!./sandbox_panel.html'));
      $id = $root.find('[data-name=sandbox-id]');
      $sandboxes = $root.find('[data-name=select-sandbox]');
      $sandboxes.click(function(e) {
        var id = $(e.target).data('id');
        sandbox.select(id === 'notSelected' ? null : id);
      });
      $sandbox = $root.find('[data-name=accounts-container]');
      $sandbox.click(folder.foldOrUnfold);
      $sandbox.click(formatter.format.bind(formatter));
      $sandbox.click(function(e) {
        var $el = $(e.target);
        if ($el.data('name') === 'contract') {
          var address = $el.parent().find('[data-name=address]').text();
          contractDialog.showContract(address);
        }
      });
      watchSandboxes();
    });

    function watchSandboxes() {
      var prevSandboxes;
      setInterval(updateSandboxes, 5000);
      updateSandboxes();
    }
    var prevSandboxes = [];
    function updateSandboxes() {
      sandbox.list(function(err, sandboxes) {
        if (err) return console.error(err);
        if (!_.eq(prevSandboxes, sandboxes)) {
          prevSandboxes = sandboxes;
          $sandboxes.empty().append('<li data-id="notSelected">Not selected</li>');
          _.each(sandboxes, function(id) {
            $sandboxes.append('<li data-id="' + id + '">' + id + '</li>');
          });
          $sandboxes.val(sandbox.getId() || 'not_selected');
        }
      });
    }

    var watcher = {
      redraw: false,
      interval: undefined,
      start: function() {
        clearInterval(this.interval);
        this.interval = setInterval((function() {
          if (this.redraw && !rendering) {
            this.redraw = false;
            panel.render();
          }
        }).bind(this), 1000);
      },
      stop: function() {
        clearInterval(this.interval);
        panel.render();    
      }
    };

    var rendering = false;
    panel.render = function() {
      if ($sandbox === null) return;
      if (!sandbox.getId()) {
        $id.text('Not started');
        $sandbox.empty();
      } else {
        rendering = true;
        $id.text(sandbox.getId());
        var $container = $('<div></div>');
        renderAccounts($container, sandbox, function(err) {
          rendering = false;
          if (err) return console.error(err);
          $sandbox.html($container);
          folder.init($sandbox);
        });
      }
    };
    
    function renderAccounts($container, sandbox, cb) {
      async.parallel({
        accounts: sandbox.accounts.bind(sandbox, true),
        coinbase: sandbox.coinbase.bind(sandbox),
        contracts: sandbox.contracts.bind(sandbox)
      }, function(err, results) {
        if (err) return cb(err);

        var contracts = results.contracts,
            coinbase = results.coinbase;

        _.each(results.accounts, function(account, address) {
          showAccount(address, account);
        });

        cb();
        
        function showAccount(address, account) {
          var $account = $(accountTemplate);

          $account.attr('data-account', address);
          
          async.parallel([
            showAccountFields,
            showStorage,
            showCode,
          ], function(err) {
            if (err) return cb(err);
            formatter.init($account.find('[data-name=storage]'));
            $container.append($account);
          });
          
          function showAccountFields(cb) {
            $account.find('[data-name=address]').text(address);
            if (coinbase === address) {
              $account.find('[data-name=miner]').show();
            }
            if (contracts.hasOwnProperty(address)) {
              $account.find('[data-name=contract]').text(contracts[address].name).show();
            }
            $account.find('[data-name=nonce]').text(account.nonce);
            $account.find('[data-name=balance]').text(account.balance);
            cb();
          }
          function showStorage(cb) {
            var $container = $account.find('[data-name=storage]');
            _.each(account.storage, function(value, key) {
              $container.append(
                '<tr><td><a href="#" class="button" data-formatter="key">number</button></td>'
                  + '<td data-folder data-name="key" class="folder">' + key + '</td>'
                  + '<td data-folder data-name="value" class="folder">' + value + '</td>'
                  + '<td><a href="#" class="button" data-formatter="value">number</button></td></tr>'
              );
            });
            cb();
          }
          function showCode(cb) {
            $account.find('[data-name=code]').text(account.code);
            cb();
          }
        }
      });
    }
    
    panel.freezePublicAPI({
    });
    
    register(null, {
      'ethergit.ethereum.sandbox.panel': panel
    });
  }
});
