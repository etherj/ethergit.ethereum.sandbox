define(function(require, exports, module) {
  main.consumes = [
    'Plugin', 'ui', 'menus', 'info', 'layout', 'http', 'util',
    'vfs.endpoint', 'auth', 'dialog.alert', 'c9', 'commands',
    'ethergit.dialog.login'
  ];
  main.provides = ['login'];
  return main;

  function main(options, imports, register) {
    var Plugin = imports.Plugin;
    var ui = imports.ui;
    var c9 = imports.c9;
    var menus = imports.menus;
    var layout = imports.layout;
    var http = imports.http;
    var util = imports.util;
    var info = imports.info;
    var auth = imports.auth;
    var commands = imports.commands;
    var alert = imports['dialog.alert'].show;
    var loginDialog = imports['ethergit.dialog.login'];

    var vfsEndpoint = imports['vfs.endpoint'];

    /***** Initialization *****/

    var ideBaseUrl = options.ideBaseUrl;
    var dashboardUrl = options.dashboardUrl;
    var accountUrl = options.accountUrl;
    var lastUser, mnuUser;

    var plugin = new Plugin('Ethergit', main.consumes);
    var emit = plugin.getEmitter();

    var loaded = false;
    function load() {
      if (loaded) return false;
      loaded = true;

      info.getUser(function(err, user) {
        updateButton({user: user});
      });

      auth.on('relogin', onReLogin);
    }

    /***** Methods *****/
    
    function updateButton(e) {
      var user = e.user;
      if (lastUser && lastUser.id == user.id)
        return;
      plugin.cleanUp();
      info.on('change', updateButton, plugin);
      createButton(user);
      lastUser = user;
      
      emit.sticky('ready', { name: user.fullname, id: user.id }, plugin);
    }

    function createButton(user) {
      var name = 'user_' + user.id;
      
      // todo cleanup seems to not work well
      // without this menu is empty after logging out and back in
      if (lastUser)
        menus.remove('user_' + lastUser.id);
      menus.remove(name);
      
      var parent = layout.findParent(plugin);
      
      // Insert CSS
      ui.insertCss(require('text!./login.css'), plugin);
      
      // Create Menu
      mnuUser = new ui.menu();
      plugin.addElement(mnuUser);
      
      // Add named button
      var icon = util.getGravatarUrl(user.email, 32, '');
      menus.addItemByPath(name + '/', mnuUser, 110000, plugin);
      
      // Add Divider
      ui.insertByIndex(parent, new ui.divider({ 
        skin: 'c9-divider-double', 
        'class' : 'extrasdivider' 
      }), 870, plugin);
      
      // Add sub menu items
      var c = 500;
      menus.addItemByPath(name + '/Dashboard', new ui.item({
        onclick: function() { window.open(dashboardUrl); }
      }), c += 100, plugin);

      if (!menus.get('User').menu) {
        menus.setRootMenu('User', 1000, plugin);
      }
      
      menus.addItemByPath('User/Dashboard', new ui.item({
        onclick: function() { window.open(dashboardUrl); }
      }), 100, plugin);
      
      menus.addItemByPath(name + '/~', new ui.divider(), c += 100, plugin);
      if (isGuest(user)) {
        menus.addItemByPath(name + '/Log in', new ui.item({
          onclick: function() {
            loginDialog.show();
          }
        }), c += 100, plugin);

        menus.addItemByPath('User/Log in', new ui.item({
          command: 'openLoginDialog'
        }), 300, plugin);
        
        var btn = new ui.button({
          skin: "c9-menu-btn",
          caption: "Log In",
          tooltip: "Log in to the IDE",
          command: "openLoginDialog"
        });

        commands.addCommand({
          name: "openLoginDialog",
          exec: function() {
            loginDialog.show();
          }
        }, plugin);
        
        ui.insertByIndex(parent, btn, 620, plugin);
      } else {
        menus.addItemByPath(name + '/Log out', new ui.item({
          onclick: function() {
            if (!c9.local) return signout();
            auth.logout(function() {
              info.login(true);
            });
          }
        }), c += 100, plugin);
        menus.addItemByPath('User/Log out', new ui.item({
          onclick: function() {
            if (!c9.local) return signout();
            auth.logout(function() {
              info.login(true);
            });
          }
        }), 300, plugin);
      }

      var button = menus.get(name).item;
      button.setAttribute('class', 'btnName');
      button.setAttribute('icon', icon);
      button.setAttribute('iconsize', '16px 16px');
      button.setAttribute('tooltip', user.fullname);
      button.setAttribute('caption', user.fullname);
      ui.insertByIndex(parent, button, 600, plugin);

      function minimize(){
        apf.document.documentElement.appendChild(button);
        ui.setStyleClass(button.$ext, 'titlebar');
      }
      function restore(){
        ui.insertByIndex(parent, button, 870, plugin);
        ui.setStyleClass(button.$ext, '', ['titlebar']);
      }
      
      menus.on('minimize', minimize, plugin);
      menus.on('restore', restore, plugin);
      
      if (menus.minimized)
        minimize();

      function isGuest(user) {
        return user.id >= 1000000;
      }
    }

    function signout() {
      vfsEndpoint.clearCache();
      auth.logout(function() { location.href = dashboardUrl; });
    }

    function onReLogin() {
      if (!c9.local) {
        alert('Logged out',
              'You have been logged in as a different user',
              'Please hit OK to reload the IDE.',
              function() {
                vfsEndpoint.clearCache();
                auth.logout(function() {
                  document.location.reload();
                });
              });
      }
    }

    function relogin() {
      loginDialog.showWithMessage('The IDE was updated. Please, sign in again.');
    }
    
    /***** Lifecycle *****/

    plugin.on('load', function() {
      load();
    });
    plugin.on('enable', function() {

    });
    plugin.on('disable', function() {

    });
    plugin.on('unload', function() {
      loaded = false;
    });

    /***** Register and define API *****/

    /**
     *
     **/
    plugin.freezePublicAPI({
      get menu(){ return mnuUser; },
      
      _events: [
        /**
         * @event ready
         */
        'ready'
      ],
      createButton: createButton,
      updateButton: updateButton,
      relogin: relogin
    });

    register(null, {
      login: plugin
    });
  }
});
