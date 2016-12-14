define(function(require) {
  main.consumes = [
    'Dialog', 'ui', 'fs', 'vfs', 'ext', 'c9',
    'ethergit.libs', 'ethereum-console'
  ];
  main.provides = ['ethergit.dialog.upload.sources.to.harmony'];
  return main;

  function main(options, imports, register) {
    var Dialog = imports.Dialog;
    var ui = imports.ui;
    var fs = imports.fs;
    var c9 = imports.c9;
    var ext = imports.ext;
    var libs = imports['ethergit.libs'];
    var ethConsole = imports['ethereum-console'];

    var async = require('async');
    
    var $ = libs.jquery();
    var _ = libs.lodash();

    var proxy, proxyCallbacks = [];
    var $contracts;

    var requestId = 0;
    
    var dialog = new Dialog('Ethergit', main.consumes, {
      name: 'ethergit-dialog-upload-sources-to-harmony',
      title: 'Upload Sources to Harmony',
      width: 400,
      elements: [
        {
          type: 'button', id: 'upload', color: 'green',
          caption: 'Upload', 'default': true
        },
        {
          type: 'button', id: 'cancel', color: 'blue',
          caption: 'Cancel', 'default': false, onclick: hide
        }
      ]
    });

    dialog.on('draw', function(e) {
      e.html.innerHTML = require('text!./upload_sources_to_harmony_dialog.html');
      var $root = $(e.html);
      $contracts = $root.find('[data-name=contracts]');
      $root.keydown(function(e) { e.stopPropagation(); });
      $root.keyup(function(e) {
        e.stopPropagation();
        if (e.keyCode == 27) hide();
      });
    });

    function showWithContracts(url, contracts) {
      if ($contracts) $contracts.empty();
      dialog.show();
      contracts = _.map(contracts, function(contract) {
        return {
          name: contract.name,
          sources: contract.sources,
          root: contract.root,
          address: contract.address
        };
      });
      _.each(contracts, function(contract, index) {
        $contracts.append(
          '<div class="checkbox">' +
            '<label style="line-height:24px;">' +
            '<input type="checkbox" checked data-contract-index="' + index + '"> ' +
            '<strong>' + contract.name + '</strong>' +
            '</label>' +
          '</div>'
        );
      });
      dialog.update([{ id: 'upload', onclick: send.bind(null, url, contracts) }]);
    }

    function send(url, contracts) {
      _.each(contracts, function(contract, index) {
        if (!$contracts.find('input[data-contract-index=' + index + ']').is(":checked")) {
          return;
        }

        var contractUrl = url + '/contracts/' + contract.address.substr(2) + '/files';

        sendThroughClient(contractUrl, contract);
        //if (_.startsWith(url, 'https')) sendThroughClient(contractUrl, contract);
        //else sendThroughServer(contractUrl, contract);
      });
      hide();
    }

    function sendThroughClient(url, contract) {
      var data = new FormData();
      data.append('name', contract.name);
      async.reduce(contract.sources, {}, function(result, source, cb) {
        fs.readFile(contract.root + source, function(err, content) {
          result[source] = content;
          cb(err, result);
        });
      }, function(err, sources) {
        if (err) {
          return ethConsole.logger(function(error, logger) {
            if (error) return console.error(error);
            logger.error('<pre>' + err + '</pre>');
          });
        }
        
        _.each(sources, function(content, filename) {
          var contract = new Blob([content], { type: 'plain/text' });
          data.append('contracts', contract, filename);
        });

        $.ajax({
          url: url,
          data: data,
          cache: false,
          contentType: false,
          processData: false,
          type: 'POST',
          success: function(data) {
            if (!data.success) {
              ethConsole.logger(function(error, logger) {
                if (error) return console.error(error);
                logger.error('<pre>' + data.errorMessage + '</pre>');
              });
            }
          }
        });
      });
    }

    function sendThroughServer(url, contract) {
      var data = [{
        key: 'name',
        type: 'string',
        value: contract.name
      }];
      
      _.each(contract.sources, function(source) {
        data.push({
          key: 'contracts',
          type: 'file',
          value: '/root/workspace' + contract.root + source
        });
      });
      proxy.write(JSON.stringify({
        id: requestId,
        url: url,
        fields: data
      }));
      proxyCallbacks[requestId++] = function(err, body) {
        if (err) console.error(err);
        console.log(body);
      };
    }

    function receiveFromProxy(data) {
      try {
        var response = JSON.parse(data);
      } catch (e) {
        return console.error('Could not parse the proxy response', data);
      }

      if (!proxyCallbacks.hasOwnProperty(response.id)) return;
      
      if (response.error) {
        proxyCallbacks[response.id](response.error, response.body);
      } else {
        proxyCallbacks[response.id](null, response.body);
      }
      delete proxyCallbacks[response.id];
    }
    
    function hide() {
      dialog.hide();
    }

    function loadProxy() {
      var clientId = c9.id;
      ext.loadRemotePlugin("ether-camp-upload-files-proxy", {
        code: require("text!./upload_files_proxy.js")
      }, function(err, api) {
        api.connect(5600, function(err, meta) {
          if (err) return console.error(err);
          proxy = meta.stream;
          proxy.on('data', receiveFromProxy);
        });
      });
    }

//    loadProxy();

/*
    c9.on('connect', loadProxy);
    c9.on('disconnect', function() {
      console.log('disconnect c9');
      proxy = null;
    });
*/

    dialog.freezePublicAPI({
      showWithContracts: showWithContracts
    });
    
    register(null, {
      'ethergit.dialog.upload.sources.to.harmony': dialog
    });
  }
});
