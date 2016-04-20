define(function(require) {
  main.consumes = [
    'Dialog', 'ui', 'http', 'ethergit.libs'
  ];
  main.provides = ['ethergit.dialog.login'];

  return main;

  function main(options, imports, register) {
    var Dialog = imports.Dialog;
    var ui = imports.ui;
    var http = imports.http;
    var libs = imports['ethergit.libs'];

    var $ = libs.jquery();

    var $nameOrEmail, $password, $error;

    var dialog = new Dialog('Ethergit', main.consumes, {
      name: 'ethergit-login',
      allowClose: true,
      title: 'Log In',
      width: 500,
      elements: [
        {
          type: 'button', id: 'btnOk', color: 'green',
          caption: 'OK', 'default': true, onclick: send
        },
        {
          type: 'button', id: 'btnCancel', color: 'blue',
          caption: 'Cancel', 'default': false, onclick: hide
        }
      ]
    });

    dialog.on('draw', function(e) {
      e.html.innerHTML = require('text!./dialog.html');
      var $root = $(e.html);
      $nameOrEmail = $root.find('[data-name=nameOrEmail]');
      $password = $root.find('[data-name=password]');
      $error = $root.find('[data-name=error]');
      $root.keydown(function(e) { e.stopPropagation(); });
      $root.keyup(function(e) {
        e.stopPropagation();
        if (e.keyCode == 27) hide();
      });
      $root.keypress(function(e) {
        e.stopPropagation();
        if (e.keyCode == 13) send();
      });
    });

    dialog.on('show', function() {
      $nameOrEmail.focus();
    });

    function send() {
      $.ajax({
        type: 'POST',
        url: options.apiUrl + '/login',
        data: JSON.stringify({
          nameOrEmail: $nameOrEmail.val(),
          password: $password.val()
        }),
        dataType: 'json',
        contentType: 'application/json'
      })
        .done(function(session) {
          document.cookie = 'sessionId=' + session.id + '; path=/; domain=' + base(window.location.hostname);
          window.location.reload();
        })
        .fail(function(xhr) {
          if (xhr.readyState == 4) $error.text('Name or password is incorrect');
          else $error.text('Connection refused');
        });

      function base(host) {
        // ip address
        var match = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.exec(host);
        if (match) return match[0];
        else {
          // domain name like someide.ether.camp
          match = /^[\w\-\.]+(\.[\w\-\.]+\.\w+)$/.exec(host);
          return match ? match[1] : host;
        }
      }
    }

    function hide() {
      dialog.hide();
    }

    dialog.freezePublicAPI({});
    register(null, { 'ethergit.dialog.login': dialog });
  }
});
