define(function(require) {
  main.consumes = [
    'Dialog', 'fs', 'ui', 'ethergit.libs', 'ethergit.sandbox', 'ethereum-console'
  ];
  main.provides = ['ethergit.dialog.scenario'];
  return main;

  function main(options, imports, register) {
    var Dialog = imports.Dialog;
    var fs = imports.fs;
    var ui = imports.ui;
    var libs = imports['ethergit.libs'];
    var sandbox = imports['ethergit.sandbox'];
    var ethConsole = imports['ethereum-console'];

    var $ = libs.jquery();
    var _ = libs.lodash();
    var yaml = libs.yaml();

    var async = require('async');
    var folder = require('../folder')(_);

    var scenarioName, $error, $name, $txs;

    var txTmpl = _.template(
      '<div>' +
        '<h4>Transaction <%= num %></h4>' +
        '<ul class="list-unstyled">' +
        '<li><strong>from:</strong> <%= from %></li>' +
        '<% if (to) { %><li><strong>to:</strong> <%= to %></li><% } %>' +
        '<li><strong>value:</strong> <%= value %></li>' +
        '<% if (data) { %>' +
        '<li>' +
        '<strong>data:</strong> ' +
        '<span data-folder class="long-string folder"><%= data %></span>' +
        '</li>' +
        '<% } %>' +
        '</ul>' +
        '</div>'
    );
    
    var dialog = new Dialog('Ethergit', main.consumes, {
      name: 'ethergit-dialog-scenario',
      allowClose: true,
      title: 'Scenario',
      width: 600,
      elements: [
        {
          type: 'button', id: 'run', color: 'green',
          caption: 'Run', onclick: runScenario
        },
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
      scenarioName = name;
      
      dialog.show();
      $error.empty();
      $txs.empty();
      $name.text(name);
      
      sandbox.web3.sandbox.getProjectDir(function(err, projectDir) {
        if (err) return $error.text(err);

        var file = projectDir + 'scenarios/' + name + '.yaml';
        fs.readFile(file, function(err, content) {
          if (err) return $error.text(err);
          try {
            var txs = yaml.safeLoad(content);
            var errors = validateScenario(txs);
            if (errors.length > 0) {
              $error.html(
                _.reduce(errors, function(html, error) {
                  return html + error + '<br/>';
                }, '')
              );
            } else {
              _.each(txs, function(tx, num) {
                $txs.append(txTmpl({
                  num: num + 1,
                  from: tx.from,
                  to: tx.to,
                  value: tx.value,
                  data: tx.data
                }));
              });
              folder.init($txs);
            }
          } catch (e) {
            $error.html('<pre>' + e + '</pre>');
          }
        });
      });
    }

    function hide() {
      dialog.hide();
    }

    function runScenario() {
      $error.empty();

      sandbox.web3.sandbox.getProjectDir(function(err, projectDir) {
        if (err) return $error.text(err);

        var file = projectDir + 'scenarios/' + scenarioName + '.yaml';
        fs.readFile(file, function(err, content) {
          if (err) return $error.text(err);

          try {
            var txs = yaml.safeLoad(content);
            var errors = validateScenario(txs);
            if (errors.length > 0) {
              $error.html(
                _.reduce(errors, function(html, error) {
                  return html + error + '<br/>';
                }, '')
              );
            } else {
              ethConsole.logger(function(err, logger) {
                if (err) return console.error(err);
                logger.log('Running scenario <b>' + scenarioName + '</b>');
                async.each(txs, runTx, function(err) {
                  if (err) logger.error(err);
                  else logger.log('Scenario has been executed successfully');
                });
              });
            }
          } catch (e) {
            $error.html('<pre>' + e + '</pre>');
          }
        });
      });
    }

    function runTx(params, cb) {
      sandbox.web3.eth.sendTransaction(params, cb);
    }

    function validateScenario(scenario) {
      if (!_.isArray(scenario))
        return ['Scenario must be an array of objects with details of its transactions.'];

      return _(scenario)
        .map(function(tx, num) {
          var errors = [];
          num++;
          if (!_.has(tx, 'from')) {
            errors.push('Transaction ' + num + ' must have a field [from]');
          } else if (!isAddress(tx.from)) {
            errors.push('Transaction ' + num + ' must contain an address in the field [from]');
          }
          if (_.has(tx, 'to') && !_.isNull(tx.to) && !isAddress(tx.to)) {
            errors.push('Transaction ' + num + ' must contain an address in the field [to]');
          }
          if (_.has(tx, 'value') && !_.isNull(tx.value) && !isNumber(tx.value)) {
            errors.push('Transaction ' + num + ' must contain a number in the field [value]');
          }
          if (_.has(tx, 'data') && !_.isNull(tx.data) && !isHex(tx.data)) {
            errors.push('Transaction ' + num + ' must contain a hex-data in the field [data]');
          }
          return errors;
        })
        .flatten()
        .value();

      function isAddress(str) {
        return /^0x[\dabcdef]{40}$/.test(str.toLowerCase());
      }
      function isNumber(value) {
        return _.isNumber(value) || /^0x[\dabcdef]+$/.test(value.toLowerCase());
      }
      function isHex(value) {
        return /^0x[\dabcdef]+$/.test(value.toLowerCase());
      }
    }

    dialog.freezePublicAPI({
      'showScenario': showScenario
    });

    register(null, {
      'ethergit.dialog.scenario': dialog
    });
  }
});
