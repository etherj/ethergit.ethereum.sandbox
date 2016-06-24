define(function(require, exports, module) {
  main.consumes = ['Plugin', 'ui', 'api', 'info', 'menus', 'dialog.confirm'];
  main.provides = ['ethereum.studio.publish'];
  return main;

  function main(options, imports, register) {
    var Plugin = imports.Plugin;
    var ui = imports.ui;
    var api = imports.api;
    var info = imports.info;
    var menus = imports.menus;
    var confirm = imports['dialog.confirm'].show;

    var plugin = new Plugin('ether.camp', main.consumes);

    var menuItem, userMenuItem;

    plugin.on('load', function() {
      info.getWorkspace(function(err, project) {
        info.getUser(function(err, user) {
          if (user.access != 'ADMIN') return;
          menuItem = new ui.item({ onclick: publishOrProtect });
          menus.addItemByPath(
            'user_' + user.id + '/' + getLabel(project.nonpublic),
            menuItem,
            675,
            plugin
          );

          if (!menus.get('User').menu) {
            menus.setRootMenu('User', 1000, plugin);
          }

          userMenuItem = new ui.item({ onclick: publishOrProtect });
          menus.addItemByPath(
            'User/' + getLabel(project.nonpublic),
            userMenuItem,
            200,
            plugin
          );
        });
      });
    });

    function getLabel(nonpublic) {
      return nonpublic ? 'Publish project' : 'Protect project';
    }

    function publishOrProtect() {
      info.getWorkspace(function(err, project) {
        var title, head, msg;
        
        if (project.nonpublic) {
          title = 'Publish project?';
          head = 'Do you want to publish the project?';
          msg = 'Anyone will be able to see your project in readonly mode.';
        } else {
          title = 'Protect project?';
          head = 'Do you want to protect the project?';
          msg = 'Only project members will be able to see your project.';
        }
        
        confirm(title, head, msg, function() {
          api.project.post('/publish', {
            contentType: 'application/json',
            body: JSON.stringify({
              nonpublic: !project.nonpublic
            })
          }, function(err, session, res) {
            if (err) return console.error(err);

            project.nonpublic = JSON.parse(res.body).nonpublic;
            menuItem.setAttribute('caption', getLabel(project.nonpublic));
            userMenuItem.setAttribute('caption', getLabel(project.nonpublic));
          });
        });
      });
    }
    
    plugin.freezePublicAPI({});
    register(null, { 'ethereum.studio.publish': plugin });
  }
});
