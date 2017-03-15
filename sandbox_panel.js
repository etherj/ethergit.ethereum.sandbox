define(function(require) {
  main.consumes = [
    'Panel', 'ui', 'apf', 'settings',
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
    var settings = imports.settings;
    var libs = imports['ethergit.libs'];
    var contractDialog = imports['ethergit.ethereum.sandbox.dialog.contract'];
    var sandbox = imports['ethergit.sandbox'];

    var accountTemplate = require('text!./account.html');
    var async = require('async');

    var $ = libs.jquery();
    var _ = libs.lodash();
    var BN = libs.BigNumber();

    var folder = require('./folder')(_);
    var formatter = require('./formatter')(_);

    apf.config.setProperty('allow-select', true);

    var panel = new Panel('Ethergit', main.consumes, {
      index: 300,
      width: 400,
      caption: 'Ethereum Sandbox',
      minWidth: 300,
      where: 'right'
    });

    var $id, $pinId, $projectNameContainer, $projectName, $sandbox, $sandboxes;
    
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
      $projectNameContainer = $root.find('[data-name=project-name-container]');
      $projectName = $root.find('[data-name=project-name]');

      installTheme($root.find('#sandboxPanel'));
      
      $pinId = $root.find('[data-name=pin-sandbox-id]');
      $pinId.click(function() {
        sandbox.pinOrUnpin();
        updatePinAndId();
      });
      
      $sandboxes = $root.find('[data-name=select-sandbox]');
      $sandboxes.click(function(e) {
        var id = $(e.target).data('id');
        sandbox.select(id === 'notSelected' ? null : id);
      });

      
      $sandbox = $root.find('[data-name=accounts-container]');
      $sandbox.click(folder.handler);
      $sandbox.click(function(e) {
        var $el = $(e.target);
        if ($el.data('name') === 'contract') {
          var address = $el.parent().find('[data-name=address]').text();
          contractDialog.showContract(address);
        }
      });
      watchSandboxes();

      function installTheme($el) {
        $el.addClass(settings.get('user/general/@skin'));
        settings.on('user/general/@skin', function(newTheme, oldTheme) {
          $el.removeClass(oldTheme).addClass(newTheme);
        }, panel);
      }
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

    function updatePinAndId() {
      if (sandbox.pinnedId() != null) {
        $id.text(sandbox.pinnedId());
        $pinId.addClass('active');
      } else {
        $pinId.removeClass('active');
        if (sandbox.getId()) {
          $pinId.show();
          $id.text(sandbox.getId());
        } else {
          $pinId.hide();
          $id.text('Not selected');
        }
      }
    }
    
    var rendering = false;
    panel.render = function() {
      if (!$sandbox) return;

      updatePinAndId();
      showOrHideProjectName(sandbox);
      
      if (!sandbox.getId()) {
        $sandbox.empty();
      } else {
        rendering = true;
        var $container = $('<div></div>');
        renderAccounts($container, sandbox, function(err) {
          rendering = false;
          if (err) return console.error(err);
          $sandbox.html($container);
        });
      }
    };

    function showOrHideProjectName(sandbox) {
      if (!sandbox.getId()) {
        $projectNameContainer.hide();
        $projectName.empty();
      } else {
        sandbox.web3.sandbox.getProjectName(function(err, name) {
          if (err) return console.error(name);
          $projectName.text(name);
          $projectNameContainer.show();
        });
      }
    }
    
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
            $container.append($account);
          });
          
          function showAccountFields(cb) {
            $account.find('[data-name=address]').text(address);
            if (account.name) {
              $account.find('[data-name=name]').show().text(account.name);
            }
            if (coinbase === address) {
              $account.find('[data-name=miner]').show();
            }
            if (contracts.hasOwnProperty(address)) {
              $account.find('[data-name=contract]').text(contracts[address].name).show();
            }
            $account.find('[data-name=nonce]').text(parseNumber(account.nonce));
            $account.find('[data-name=balance]').html(parseNumber(account.balance));
            cb();

            function parseNumber(number) {
              return number ? new BN(number.substr(2), 16).toFixed() : 0;
            }
          }
          function showStorage(cb) {
            var $container = $account.find('[data-name=storage]');
            _.each(account.storage, function(value, key) {
              $container.append(
                $('<tr>')
                  .append(formatter(
                    key,
                    '<td><a href="#" data-name="switch" class="button"><%= type %></button></td>'
                      + '<td><span data-folder data-name="value" data-folder="" class="folder"><%= value %></span></td>'
                  ))
                  .append(formatter(
                    value,
                    '<td><span data-folder data-name="value" data-folder data-folder-len="40" class="folder"><%= value %></span></td>'
                      + '<td><a href="#" data-name="switch" data-folder="" class="button"><%= type %></a></td>'
                  ))
              );
            });
            cb();
          }
          function showCode(cb) {
            var $code = $account.find('[data-name=code]');
            $code.text(account.code);
            folder.init($code.parent());
            cb();
          }
        }
      });
    }

    // hide buttons that confuse users.
    ui.insertCss(require('text!./hide_buttons.css'), false, panel);
    
    panel.freezePublicAPI({
    });
    
    register(null, {
      'ethergit.ethereum.sandbox.panel': panel
    });
  }
});
