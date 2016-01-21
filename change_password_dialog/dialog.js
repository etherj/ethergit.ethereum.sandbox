define(function(require) {
  main.consumes = ['Dialog', 'ui', 'api', 'info', 'menus', 'ethergit.libs'];
  main.provides = ['ethergit.dialog.change.password'];
  return main;

  function main(options, imports, register) {
    var Dialog = imports.Dialog;
    var ui = imports.ui;
    var api = imports.api;
    var info = imports.info;
    var menus = imports.menus;
    var libs = imports['ethergit.libs'];

    var $ = libs.jquery();

    var bcrypt = require('../lib/bcrypt');

    var salt = '$2a$10$QxS8kAC.zaO2Sover3OSvO';
    var $old, $new, $repeatNew, $message;

    var dialog = new Dialog('Ethergit', main.consumes, {
      name: 'ethergit-change-password',
      allowClose: true,
      title: 'Change Password',
      width: 500,
      elements: [
        {
          type: 'button', id: 'btnOk', color: 'green',
          caption: 'Change', 'default': true, onclick: change
        },
        {
          type: 'button', id: 'btnClose', color: 'blue',
          caption: 'Close', 'default': false, onclick: hide
        }
      ]
    });

    dialog.on('draw', function(e) {
      e.html.innerHTML = require('text!./dialog.html');
      var $root = $(e.html);
      $message = $('[data-name=message]');
      $old = $('[data-name=old]');
      $new = $('[data-name=new]');
      $repeatNew = $('[data-name=repeatNew]');
      $root.keydown(function(e) { e.stopPropagation(); });
      $root.keyup(function(e) {
        e.stopPropagation();
        if (e.keyCode == 27) hide();
      });
      $root.keypress(function(e) {
        e.stopPropagation();
        if (e.keyCode == 13) change();
      });
    });

    dialog.on('show', function() {
      $message.hide();
      $old.focus().val('');
      $new.val('');
      $repeatNew.val('');
    });

    dialog.on('load', function() {
      info.getUser(function(err, user) {
        menus.addItemByPath('user_' + user.id + '/Change Password', new ui.item({
          onclick: dialog.show.bind(dialog)
        }), 650, dialog);
      });
    });

    function change() {
      var err = validate();
      if (err) return showMessage(err, true);
      
      api.user.post('change-password', {
        contentType: 'application/json',
        body: JSON.stringify({
          oldPassword: bcrypt.hashSync($old.val(), salt),
          newPassword: bcrypt.hashSync($new.val(), salt)
        })
      }, function(err, session, res) {
        if (err) {
          showMessage('Unknown error', true);
          return console.error(err);
        }

        if (res.body.length == 0) {
          showMessage('Your password has been changed.');
        } else {
          try {
            showMessage(JSON.parse(res.body).message, true);
          } catch (e) {
            showMessage(res.body, true);
          }
        }
      });

      function showMessage(msg, error) {
        $message
          .removeClass(error ? 'alert-success' : 'alert-danger')
          .addClass(error ? 'alert-danger' : 'alert-success')
          .text(msg)
          .show();
      }

      function validate() {
        var valid = [$old, $new].every(function (field) {
          return /^\w+$/.test(field.val());
        });
        if (!valid) return 'Password can contain only letters, digits, and/or _.';
        if ($new.val() !== $repeatNew.val()) return 'New password fields does not match';
      }
    }

    function hide() {
      dialog.hide();
    }

    dialog.freezePublicAPI({});
    register(null, { 'ethergit.dialog.change.password': dialog });
  }
});
