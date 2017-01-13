define(function(require) {
  main.consumes = [
    'Dialog', 'ui', 'layout', 'commands', 'menus', 'Menu', 'fs',
    'ethergit.libs', 'ethergit.sandbox', 'ethergit.dialog.scenario',
    'ethereum-console'
  ];
  main.provides = ['ethergit.dialog.scenarios'];
  return main;

  function main(options, imports, register) {
    var Dialog = imports.Dialog;
    var ui = imports.ui;
    var layout = imports.layout;
    var commands = imports.commands;
    var menus = imports.menus;
    var Menu = imports.Menu;
    var fs = imports.fs;
    var libs = imports['ethergit.libs'];
    var sandbox = imports['ethergit.sandbox'];
    var scenarioDialog = imports['ethergit.dialog.scenario'];
    var ethConsole = imports['ethereum-console'];

    var async = require('async');
    
    var $ = libs.jquery();
    var _ = libs.lodash();

    var $scenarios, $error;

    var scenarioTmpl = _.template(
      '<li>' +
        '<a href="#" data-action="open" data-name="<%= name %>"><%= name %></a> ' +
        '<a href="#" data-action="run" data-name="<%= name %>" class="glyphicon glyphicon-play"></a> ' +
        '<a href="#" data-action="remove" data-name="<%= name %>" class="glyphicon glyphicon-remove"></a> ' +
        '</li>'
    );
    var dialog = new Dialog('Ethergit', main.consumes, {
      name: 'ethergit-dialog-scenarios',
      allowClose: true,
      title: 'Scenarios',
      width: 800,
      elements: [
        {
          type: 'button', id: 'close', color: 'blue',
          caption: 'Close', 'default': true, onclick: hide
        }
      ]
    });

    dialog.on('load', function() {
      commands.addCommand({
        name: 'showScenarios',
        exec: dialog.show.bind(dialog),
        isAvailable: function() {
          return !!sandbox.getId();
        }
      }, dialog);

      var btn = ui.insertByIndex(
        layout.getElement('barTools'),
        new ui.button({
          id: 'btnScenarios',
          skin: 'c9-toolbarbutton-glossy',
          command: 'showScenarios',
          caption: 'Scenarios',
          disabled: true
        }),
        440, dialog
      );

      if (!menus.get('Window/Ethereum').menu) {
        menus.addItemByPath('Window/~', new ui.divider(), 10300, dialog);
        menus.addItemByPath('Window/Ethereum', new Menu({}, dialog), 10320, dialog);
      }
      
      menus.addItemByPath(
        'Window/Ethereum/Scenarios',
        new ui.item({ command: 'showScenarios' }),
        180, dialog
      );

      sandbox.on('select', function() {
        btn.setAttribute('disabled', !sandbox.getId());
      });
    });

    dialog.on('draw', function(e) {
      e.html.innerHTML = require('text!./dialog.html');
      var $root = $(e.html);
      $scenarios = $root.find('[data-name=scenarios]');
      $error = $root.find('[data-name=error]');

      $scenarios.click(function(e) {
        var $el = $(e.target);
        var action = $el.data('action');
        if (action) {
          e.preventDefault();
          if (action == 'open') {
            scenarioDialog.showScenario($el.data('name'));
          } else if (action == 'run') {
            runScenario($el.data('name'));
          } else if (action == 'remove') {
            removeScenario($el.data('name'));
          }
        }
      });
      
      $root.keydown(function(e) { e.stopPropagation(); });
      $root.keyup(function(e) {
        e.stopPropagation();
        if (e.keyCode == 27) hide();
      });
    });

    dialog.on('show', function() {
      $scenarios.empty();
      $error.empty();
      
      sandbox.web3.sandbox.getProjectDir(function(err, projectDir) {
        if (err) return console.error(err);

        var scenariosDir = projectDir + 'scenarios/';
        
        fs.exists(scenariosDir, function(exists) {
          if (!exists) {
            $error.text('There is no directory ' + scenariosDir);
            return;
          }
            
          fs.readdir(scenariosDir, function(err, files) {
            if (err) return console.error(err);
            files = _.filter(files, function(file) {
              return _.endsWith(file.name, '.json');
            });
            async.map(files, function(file, cb) {
              fs.readFile(scenariosDir + file.name, function(err, content) {
                if (err) return cb(err);
                cb(null, {
                  name: file.name.substr(0, file.name.length - 5),
                  content: content
                });
              });
            }, function(err, scenarios) {
              if (err) return $error.text(err);
              _.each(scenarios, function(scenario) {
                $scenarios.append(scenarioTmpl({
                  name: scenario.name
                }));
              });
            });
          });
        });
      });
    });
    
    function hide() {
      dialog.hide();
    }

    function runScenario(name) {
      $error.empty();

      sandbox.web3.sandbox.getProjectDir(function(err, projectDir) {
        if (err) return $error.text(err);

        var file = projectDir + 'scenarios/' + name + '.json';
        fs.readFile(file, function(err, content) {
          if (err) return $error.text(err);

          try {
            var txs = JSON.parse(content);
            ethConsole.logger(function(err, logger) {
              if (err) return console.error(err);
              logger.log('Running scenario <b>' + name + '</b>');
              async.each(txs, runTx, function(err) {
                if (err) logger.error(err);
                else logger.log('Scenario has been executed successfully');
              });
            });
          } catch (e) {
            $error.text(e);
          }
        });
      });
    }

    function removeScenario(name) {
      $error.empty();

      sandbox.web3.sandbox.getProjectDir(function(err, projectDir) {
        if (err) return $error.text(err);

        var file = projectDir + 'scenarios/' + name + '.json';
        fs.rmfile(file, function(err) {
          if (err) return $error.text(err);
          $scenarios.find('[data-name=' + name + ']').parent().remove();
        });
      });
    }

    function runTx(params, cb) {
      sandbox.web3.eth.sendTransaction(params, cb);
    }

    dialog.freezePublicAPI({});

    register(null, {
      'ethergit.dialog.scenarios': dialog
    });
  }
});
