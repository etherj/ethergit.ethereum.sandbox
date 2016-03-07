define(function(require) {
  main.consumes = ['Dialog', 'ui', 'ethergit.libs', 'ethereum-console'];
  main.provides = ['ethergit.dialog.contract.constructor'];

  return main;

  function main(options, imports, register) {
    var Dialog = imports.Dialog;
    var ui = imports.ui;
    var libs = imports['ethergit.libs'];

    var async = require('async');

    var $ = libs.jquery();
    var _ = libs.lodash();

    var widgets = require('./ui/widgets')(_);

    // Cached elements
    var $root, $name, $args;

    var dialog = new Dialog('Ethergit', main.consumes, {
      name: 'sandbox-contract-constructor',
      allowClose: true,
      title: 'Contract Constructor',
      width: 500,
      elements: [
        {
          type: 'button', id: 'submitContractConstructorDialog', color: 'green',
          caption: 'Submit', 'default': true
        }
      ]
    });

    dialog.on('draw', function(e) {
      e.html.innerHTML = require('text!./contract_constructor.html');
      $root = $(e.html);
      $name = $root.find('[data-name=name]');
      $args = $root.find('[data-name=args]');
      $args.keydown(function(e) { e.stopPropagation(); });
      $args.keyup(function(e) {
        e.stopPropagation();
        if (e.keyCode == 27) hide();
      });
    });

    function askArgs(contract, cb) {
      var args = _.findWhere(contract.abi, { type: 'constructor' }).inputs;
      dialog.show();
      $name.text(contract.name);
      $args.empty();
      var argHtml = function(name, type, widget) {
        var $html = $(
          '<div class="form-group">' +
            '<label class="col-sm-4 control-label">' + name + ' : ' + type + '</label>' +
            '<div class="col-sm-8" data-name="field"></div>' +
            '</div>'
        );
        $html.find('[data-name=field]').append(widget.html());
        return $html;
      };
      var argWidgets = {};
      _.each(args, function(arg) {
        argWidgets[arg.name] = widgets(arg.type);
        $args.append(argHtml(arg.name, arg.type, argWidgets[arg.name]));
      });

      argWidgets[args[0].name].focus();
      
      dialog.update([{
        id: 'submitContractConstructorDialog',
        onclick: send
      }]);
      
      $args.off('keypress');
      $args.keypress(function(e) {
        // Workaround to support enter key in ace editor
        if (e.target.offsetParent.className.indexOf('ace_editor') != -1) return;

        e.stopPropagation();
        if (e.keyCode == 13) {
          e.preventDefault();
          send();
        }
      });

      function send() {
        var values = _.map(args, function(arg) {
          return argWidgets[arg.name].value();
        });
        
        if (!_.some(values, _.isNull)) {
          hide();
          cb(null, values);
        }
      }
    }

    function hide() {
      dialog.hide();
    }

    dialog.freezePublicAPI({ askArgs: askArgs });

    register(null, { 'ethergit.dialog.contract.constructor': dialog });
  }
});
