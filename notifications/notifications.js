define(function(require, exports, module) {
  main.consumes = ['Plugin', 'api', 'dialog.notification', 'login'];
  main.provides = ['ethereum.studio.notifications'];
  return main;

  function main(options, imports, register) {
    var Plugin = imports.Plugin;
    var api = imports.api;
    var notify = imports['dialog.notification'].show;
    var login = imports['login'];

    var plugin = new Plugin('ether.camp', main.consumes);

    plugin.on('load', function() {
      window.setInterval(getNotifications, 60 * 1000);
      getNotifications();
    });

    function getNotifications() {
      api.project.get('notifications', function(err, notifications) {
        if (err) {
          if (err.code == 404) login.relogin();
          return console.error(err);
        }
        notifications.forEach(function(msg) {
          notify('<div class="c9-update">' + notifications[0].text + '</div>', true);
        });
      });
    }

    plugin.freezePublicAPI({});
    register(null, { 'ethereum.studio.notifications': plugin });
  }
});
