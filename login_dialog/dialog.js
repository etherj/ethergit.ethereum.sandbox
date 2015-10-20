define(function(require) {
  main.consumes = [
    'Dialog', 'ui', 'http',
    'ethergit.libs'
  ];
  main.provides = ['ethergit.dialog.login'];

  return main;

  function main(options, imports, register) {
    var Dialog = imports.Dialog;
    var ui = imports.ui;
    var http = imports.http;
    var libs = imports['ethergit.libs'];

    var $ = libs.jquery();

    var $name, $password, $error;

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
      $name = $root.find('[data-name=name]');
      $password = $root.find('[data-name=password]');
      $error = $root.find('[data-name=error]');
    });

    function send() {
      http.request(options.apiUrl + '/ide/login', {
        method: 'POST',
        contentType: 'application/json',
        body: JSON.stringify({
          name: $name.val(),
          password: $password.val()
        })
      }, function(err, session, res) {
        if (err) {
          try {
            var error = JSON.parse(res.body);
            $error.text(error.message);
          } catch (e) {
            $error.text(err);
          }
        } else {
          document.cookie = 'sessionId=' + session.id +
            '; path=/; domain=' + base(window.location.hostname);
          window.location.reload();
        }

        function base(host) {
          // ip address
          var match = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.exec(host);
          if (match) return match[0];
          else {
            // domain name like someide.ether.camp
            match = /\.[\w\-]+\.[\w\-]+$/.exec(host);
            return match ? match[0] : host;
          }
        }
      });
    }

    function hide() {
      dialog.hide();
    }

    dialog.freezePublicAPI({});
    register(null, { 'ethergit.dialog.login': dialog });
  }
});
