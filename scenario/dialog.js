define(function(require) {
  main.consumes = [
    'Dialog', 'fs', 'ui', 'ethergit.libs', 'ethergit.sandbox'
  ];
  main.provides = ['ethergit.dialog.scenario'];
  return main;

  function main(options, imports, register) {
    var Dialog = imports.Dialog;
    var fs = imports.fs;
    var ui = imports.ui;
    var libs = imports['ethergit.libs'];
    var sandbox = imports['ethergit.sandbox'];

    var $ = libs.jquery();
    var _ = libs.lodash();

    var folder = require('../folder')(_);
    
    var $error, $name, $txs;
    
    var dialog = new Dialog('Ethergit', main.consumes, {
      name: 'ethergit-dialog-scenario',
      allowClose: true,
      title: 'Scenario',
      width: 600,
      elements: [
        {
          type: 'button', id: 'close', color: 'blue',
          caption: 'Close', 'default': true, onclick: hide
        }
      ]
    });

    dialog.on('load', function() {
      ui.insertCss(require('text!./style.css'), false, dialog);
    });

    dialog.on('draw', function(e) {
      e.html.innerHTML = require('text!./dialog.html');
      var $root = $(e.html);
      $error = $root.find('[data-name=error]');
      $name = $root.find('[data-name=name]');
      $txs = $root.find('[data-name=txs]');

      $txs.click(folder.handler);
      
      $root.keydown(function(e) { e.stopPropagation(); });
      $root.keyup(function(e) {
        e.stopPropagation();
        if (e.keyCode == 27) hide();
      });
    });

    function showScenario(name) {
      dialog.show();
      $error.empty();
      $txs.empty();
      $name.text(name);
      
      sandbox.web3.sandbox.getProjectDir(function(err, projectDir) {
        if (err) return $error.text(err);

        var file = projectDir + 'scenarios/' + name + '.json';
        fs.readFile(file, function(err, content) {
          if (err) return $error.text(err);
          try {
            var txs = JSON.parse(content);
            _.each(txs, function(tx) {
              $txs.append(
                '<tr>' +
                  '<td><span data-folder class="long-string folder">' + tx.from + '</span></td>' +
                  '<td><span data-folder class="long-string folder">' + (tx.to || '[creation]') + '</span></td>' +
                  '<td>' + (tx.value || 0) + '</td>' +
                  '<td><span data-folder class="long-string folder">' + (tx.data || 'none') + '</span></td>' +
                  '</tr>'
              );
            });
            folder.init($txs);
          } catch (e) {
            $error.text(e);
          }
        });
      });
    }

    function hide() {
      dialog.hide();
    }

    dialog.freezePublicAPI({
      'showScenario': showScenario
    });

    register(null, {
      'ethergit.dialog.scenario': dialog
    });
  }
});
