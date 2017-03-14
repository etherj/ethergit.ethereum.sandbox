define(function(require, exports, module) {
  main.consumes = ['Plugin', 'dialog.question', 'settings', 'fs', 'ui', 
                   'proc', 'dialog.notification', 'commands', 'menus'];
  main.provides = ['ethergit.example'];
  return main;

  function main(options, imports, register) {
    
    var Plugin = imports.Plugin;
    var plugin = new Plugin('Ethergit', main.consumes);
    var settings = imports.settings;
    var question = imports['dialog.question'].show;
    var notify = imports['dialog.notification'].show;
    var fs = imports.fs;
    var proc = imports.proc;
    var commands = imports.commands;
    var menus = imports.menus;
    var ui = imports.ui;

    var async = require('async');

    settings.on('read', function() {
      settings.setDefaults("user/ethergit-example", [
        ['version', 0]
      ]);
    }, plugin);

    commands.addCommand({
      name: 'updateExampleProject',
      exec: function() { 
        question('Example project',
          'Do you want to update example project?',
          '<b>Note:</b> update overrides all the changes made in example-project folder.',
          function() {
            updateExampleProject(options.exampleProjectVersion);
          },
          function() {
          }, {
            all: false,
            cancel: false,
            isHTML: true
          });
      },
    }, plugin);

    menus.addItemByPath('File/Update Example Project', new ui.item({
      command: 'updateExampleProject'
    }), 1400, plugin);

    var settingsVersion = getSettingsVersion();
    getFileVersion(function(err, version) {
      
      if (err) return;

      var fileVersion = version;
      
      if (settingsVersion < options.exampleProjectVersion 
          && fileVersion < options.exampleProjectVersion) {

        question('Example project',
          'Example project is out of date. Would you like to update it?',
          '<b>Note:</b> update overrides all the changes made in example-project folder.',
          function() {
            updateExampleProject(options.exampleProjectVersion);
          },
          function() {
            setSettingsVersion(options.exampleProjectVersion);
          }, {
            all: false,
            cancel: false,
            isHTML: true
          });
      }
    });

    function updateExampleProject(version) {
      proc.spawn('bash', {
        args: ['-c', 'rm -rf example-project && git clone https://github.com/ether-camp/example-project.git && rm -rf example-project/.git'],
        cwd: './workspace'
      }, function(err, process) {
        
        if (err) return;

        process.on('exit', function(code) {
          setSettingsVersion(version);
          notify('<div class="c9-update">Example project has been updated</div>', true);
        });

      });
    }

    function getSettingsVersion() {
      return settings.getNumber('user/ethergit-example/@version');
    }

    function setSettingsVersion(version) {
      settings.set('user/ethergit-example/@version', version);
    }

    function getFileVersion(cb) {
      fs.readFile('/example-project/package.json', function(err, content) {
        
        if (err) {
          cb(err);
        } else {
          var version = JSON.parse(content).version;
          cb(null, version ? version : 0);
        }

      });
    }
        
    register(null, {
      'ethergit.example': plugin
    });
  }
});
