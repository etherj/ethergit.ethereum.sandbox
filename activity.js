define(function(require, exports, module) {
  main.consumes = [
    'Plugin', 'save', 'api', 'ethergit.libs', 'login'
  ];
  main.provides = ['ethergit.activity'];
  return main;

  function main(options, imports, register) {
    var Plugin = imports.Plugin;
    var save = imports.save;
    var api = imports.api;
    var libs = imports['ethergit.libs'];
    var login = imports.login;

    var DiffMatchPatch = require('./lib/diff_match_patch.js');
    
    var activity = new Plugin('Ethergit', main.consumes);

    var _ = libs.lodash();
    var diff = new DiffMatchPatch();

    save.on('beforeSave', function(e) {
      var d = diff.diff_main(e.value, e.document.recentValue);
      _.defer(function() {
        var changes = { additionCount: 0, deletionCount: 0 };
        _.each(d, function(c) {
          if (c[0] == 1) changes.deletionCount += numberOfNonEmptyLines(c[1]);
          else if (c[0] == -1) changes.additionCount += numberOfNonEmptyLines(c[1]);
        });
        api.project.post('activity', {
          contentType: 'application/json',
          body: JSON.stringify(changes)
        }, function(err) {
          if (err) {
            if (err.code == 404) login.relogin();
            console.error(err);
          }
        });
      });
    }, activity);

    function numberOfNonEmptyLines(str) {
      return _(str.split("\n")).reject(_.isEmpty).size();
    }
    
    register(null, { 'ethergit.activity': activity });
  }
});
