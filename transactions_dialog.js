define(function(require) {
  main.consumes = [
    'Dialog', 'ui', 'dialog.error', 'http', 'tabManager', 'commands', 'layout',
    'menus', 'Menu', 'MenuItem', 'fs',
    'ethergit.libs',
    'ethergit.ethereum.sandbox.dialog.transaction',
    'ethergit.ethereum.sandbox.dialog.new.tx',
    'ethergit.sandbox',
    'ethergit.ethereum.sandbox.dialog.pkey',
    'ethergit.dialog.send.to.net',
    'ethergit.dialog.scenario'
  ];
  main.provides = ['ethergit.ethereum.sandbox.dialog.transactions'];
  
  return main;
  
  function main(options, imports, register) {
    var Dialog = imports.Dialog;
    var ui = imports.ui;
    var errorDialog = imports['dialog.error'];
    var http = imports.http;
    var tabs = imports.tabManager;
    var commands = imports.commands;
    var layout = imports.layout;
    var menus = imports.menus;
    var Menu = imports.Menu;
    var MenuItem = imports.MenuItem;
    var fs = imports.fs;
    var libs = imports['ethergit.libs'];
    var transactionDialog = imports['ethergit.ethereum.sandbox.dialog.transaction'];
    var newTxDialog = imports['ethergit.ethereum.sandbox.dialog.new.tx'];
    var sendToNetDialog = imports['ethergit.dialog.send.to.net'];
    var sandbox = imports['ethergit.sandbox'];
    var scenarioDialog = imports['ethergit.dialog.scenario'];
    
    var async = require('async');
    var utils = require('./utils');

    var $ = libs.jquery();
    var _ = libs.lodash();
    var yaml = libs.yaml();

    var $txs, $error;
    
    var txTmpl = _.template(
      '<tr>' +
        '<td><input type="checkbox" checked data-name="toScenario"/></td>' +
        '<td data-name="from" class="from"><%= from %><span data-name="id" style="display:none"><%= id %></span></td>' +
        '<td><%= nonce %></td>' +
        '<td><%= to %></td>' +
        '</tr>'
    );
    var scenarioHeaderTmpl = _.template(
      '# \n' +
        '# <%= name %> \n' +
        '# \n' +
        '# Created on: <%= time %> \n' +
        '# \n'
    );
    
    var dialog = new Dialog('Ethergit', main.consumes, {
      name: 'sandbox-transactions',
      allowClose: true,
      title: 'Ethereum Sandbox Transactions',
      width: 800,
      elements: [
        {
          type: 'button', id: 'newScenario', color: 'blue',
          caption: 'New Scenario', 'default': false, onclick: newScenario
        },
        {
          type: 'button', id: 'transactionsDialogNewTx', color: 'green',
          caption: 'New Transaction', 'default': false, onclick: openNewTxDialog
        },
        {
          type: 'button', id: 'transactionsDialogSendToNetwork', color: 'red',
          caption: 'Send Contracts to Net', 'default': false, onclick: openSendToNetDialog
        },
        {
          type: 'button', id: 'transactionsDialogClose', color: 'blue',
          caption: 'Close', 'default': true, onclick: hideDialog
        }
      ]
    });

    dialog.on('load', function() {
      commands.addCommand({
        name: 'showTransactions',
        exec: dialog.show.bind(dialog),
        isAvailable: function(editor) {
          return !!sandbox.getId();
        }
      }, dialog);

      var btnTransactions = ui.insertByIndex(
        layout.getElement('barTools'),
        new ui.button({
          id: 'btnTransactions',
          skin: 'c9-toolbarbutton-glossy',
          command: 'showTransactions',
          caption: 'Transactions',
          disabled: true
        }),
        400, dialog
      );

      if (!menus.get('Window/Ethereum').menu) {
        menus.addItemByPath("Window/~", new ui.divider(), 10300, dialog);
        menus.addItemByPath('Window/Ethereum', new Menu({}, dialog), 10320, dialog);
      }
      
      var menuTransactions = new ui.item({ command: 'showTransactions' });
      menus.addItemByPath("Window/Ethereum/Transactions", menuTransactions, 100, dialog);

      sandbox.on('select', function() {
        if (sandbox.getId()) {
          btnTransactions.setAttribute('disabled', false);
          updateTxCounter();
        } else {
          btnTransactions.setAttribute('caption', 'Transactions');
          btnTransactions.setAttribute('disabled', true);
          menuTransactions.setAttribute('caption', 'Transactions');
        }
      });

      sandbox.on('changed', updateTxCounter);

      function updateTxCounter() {
        sandbox.transactions(false, function(err, transactions) {
          if (err) return console.error(err);
          btnTransactions.setAttribute(
            'caption', 'Transactions (' + transactions.length + ')'
          );
          menuTransactions.setAttribute(
            'caption', 'Transactions (' + transactions.length + ')'
          );
        });
      }
    });
    
    dialog.on('draw', function(e) {
      e.html.innerHTML = require('text!./transactions.html');
      var $root = $(e.html);
      $txs = $root.find('[data-name=transactions]');
      $error = $root.find('[data-name=error]');
    });

    dialog.on('show', function() {
      $error.empty();
      render();
      sandbox.on('changed', render, dialog);
      
      $('[data-name=transactions]').off('click').click(function(e) {
        var $el = $(e.target);
        if ($el.data('name') === 'from') {
          transactionDialog.showTransaction(sandbox, $el.find('[data-name=id]').text());
        }
      });
    });
    
    function render() {
      var $container = $('[data-name=transactions]').empty();
      sandbox.transactions(false, function(err, transactions) {
        if (err) return $error.text(err);
        transactions.forEach(function(tx, id) {
          $container.append(txTmpl({
            from: tx.from,
            id: id,
            nonce: tx.nonce,
            to: tx.to ? tx.to : '[contract create]'
          }));
        });
      });
    }

    function openSendToNetDialog() {
      sendToNetDialog.show();
      hideDialog();
    }
    
    function openNewTxDialog() {
      newTxDialog.show();
    }

    function newScenario() {
      $error.empty();
      var nums = [];
      $txs.children().each(function(idx, el) {
        var $tx = $(el);
        if ($tx.find('[data-name=toScenario]').is(':checked')) {
          nums.push(parseInt($tx.find('[data-name=id]').text()));
        }
      });
      if (nums.length == 0) {
        $error.text('Select transactions for the new scenario.');
        return;
      }
      sandbox.transactions(true, function(err, transactions) {
        if (err) return $error.text(err);
        var scenario = [];
        var comments = [];
        _.each(_.pick(transactions, nums), function(tx) {
          var comment, details;
          if (_.has(tx, 'contract')) {
            var dir = tx.contract.dir;
            // remove /root/workspace/project-dir
            tx.contract.dir = dir.substr(dir.indexOf('/', 16) + 1);
            details =  _.pick(tx, ['from', 'to', 'value', 'contract']);
            comment = 'Create contract ' + details.contract.name;
          } else {
            details = _.pick(tx, ['from', 'to', 'value', 'data']);
          }
          scenario.push(details);
          comments.push(comment);
        });

        sandbox.web3.sandbox.getProjectDir(function(err, projectDir) {
          if (err) return $error.text(err);
          findNotUsedName(projectDir, function(err, name) {
            if (err) return $error.text(err);
            var file = projectDir + 'scenarios/' + name + '.yaml';
            fs.writeFile(file, addComments(name, comments, yaml.safeDump(scenario)), function(err) {
              if (err) return $error.text(err);
              scenarioDialog.showScenario(name);
            });
          });
        });
      });
    }

    function findNotUsedName(projectDir, cb) {
      var num = 1;
      var prefix = projectDir + 'scenarios/' + 'Scenario';
      var suffix = '.yaml';
      var tries = 100;
      async.during(
        function(cb) {
          if (--tries < 0) cb('Could not find a free name for the scenario.');
          else fs.exists(prefix + num + suffix, cb.bind(null, null));
        },
        function(cb) {
          num++;
          cb();
        },
        function(err) {
          cb(err, 'Scenario' + num);
        }
      );
    }

    function addComments(name, comments, scenario) {
      var header = scenarioHeaderTmpl({
        name: name,
        time: new Date().toLocaleString()
      });
      scenario = header + scenario;
      var parts = scenario.split('\n-');
      scenario = parts.shift();
      while (parts.length > 0) {
        scenario += '\n';
        var comment = comments.shift();
        if (comment) scenario += '\n# ' + comment;
        scenario += '\n-' + parts.shift();
      }
      return scenario;
    }
    
    function hideDialog() {
      dialog.hide();
    }

    dialog.on('hide', function() {
      sandbox.off('changed', render);
    });
    
    dialog.on('load', function() {
      ui.insertCss(require('text!./transactions.css'), false, dialog);
    });
    
    dialog.freezePublicAPI({ });
    
    register(null, {
      'ethergit.ethereum.sandbox.dialog.transactions': dialog
    });
  }
});
