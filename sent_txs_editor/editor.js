define(function(require) {
  main.consumes = [
    'editors', 'Editor', 'ui', 'tabManager', 'settings', 'ethergit.libs'
  ];
  main.provides = ['ethergit.sent.txs.editor'];
  return main;

  function main(options, imports, register) {
    var editors = imports.editors;
    var Editor = imports.Editor;
    var ui = imports.ui;
    var tabs = imports.tabManager;
    var settings = imports.settings;
    var libs = imports['ethergit.libs'];

    var $ = libs.jquery();
    var _ = libs.lodash();

    var folder = require('../folder')(_);
    
    var urls = {
      test: 'https://test.ether.camp',
      live: 'https://live.ether.camp',
      morden: 'https://morden.ether.camp'
    };
    
    var txs = [];

    // Cached elements
    var $txs;
    
    function TransactionsEditor() {
      var editor = new Editor('Ethergit', main.consumes, []);
      editor.load(null, 'sent-txs');

      ui.insertCss(require('text!./txs.css'), false, editor);

      editor.on('documentLoad', function(e) {
        e.doc.title = 'Transactions';
      });

      editor.on('draw', function(e) {
        e.htmlNode.innerHTML = require('text!./container.html');
        var $root = $(e.htmlNode);
        $txs = $root.find('[data-name=txs]');
        installTheme($root.find('[data-name=container]'));

        function installTheme($el) {
          $el.addClass(settings.get('user/general/@skin'));
          settings.on('user/general/@skin', function(newTheme, oldTheme) {
            $el.removeClass(oldTheme).addClass(newTheme);
          }, editor);
        }
      });

      function addTx(tx) {
        tx.counter = 0;
        tx.status = 'Pending';
        
        var $tx = $(require('text!./tx.html'));
        $tx.attr('data-tx', tx.hash);
        $tx.find('[data-name=tx]').text(tx.hash.substr(0, 8) + '...');
        $tx.find('[data-name=contract]').text(tx.contract.substr(0, 8) + '...');
        $tx.find('[data-name=status]').text(tx.status);
        $txs.append($tx);

        txs.push(tx);
      }

      setInterval(checkTxs, 5000);

      function checkTxs() {
        _(txs).where({ status: 'Pending' }).each(function(tx) {
          if (tx.counter++ > 170) { // Checking 50 blocks ~ 170 * 5 secs.
            tx.status = 'Rejected';
            tx.web3.currentProvider.destroy();
            tx.web3 = null;
            updateTx(tx);
          } else {
            tx.web3.eth.getTransactionReceipt(tx.hash, function(err, receipt) {
              if (err) return console.error(err);
              if (receipt) {
                tx.status = 'Mined';
                tx.web3.currentProvider.destroy();
                tx.web3 = null;
                updateTx(tx);
                if (tx.onMined) tx.onMined(tx.hash);
              }
            });
          }
        }).value();
      }

      function updateTx(tx) {
        var $tx = $txs.find('[data-tx=' + tx.hash + ']');
        $tx.find('[data-name=status]').text(tx.status)
          .removeClass('Pending Rejected Mined').addClass(tx.status);
        if (tx.net) {
          var url = urls[tx.net];
          $tx.find('[data-name=tx]').html(
            '<a target="_blank" href="' + url + '/transaction/' +
              tx.hash.substr(2) + '">' + tx.hash.substr(0, 8) + '...</a>'
          );
          $tx.find('[data-name=contract]').html(
            '<a target="_blank" href="' + url + '/account/' +
              tx.contract.substr(2) + '">' + tx.contract.substr(0, 8) + '...</a>'
          );
        } else {
          $tx.click(folder.handler);
          $tx.find('[data-name=tx]').html(
            '<span data-folder class="folder">' + tx.hash + '</span>'
          );
          $tx.find('[data-name=contract]').html(
            '<span data-folder class="folder">' + tx.contract + '</span>'
          );
          folder.init($tx);
        }
      }
      
      editor.freezePublicAPI({
        addTx: addTx
      });

      return editor;
    }

    var handle = editors.register('sent-tx', 'Transactions', TransactionsEditor, []);

    function show(cb) {
      var pane = tabs.getPanes().length > 1 ?
          tabs.getPanes()[1] :
          tabs.getPanes()[0].vsplit(true);
      
      tabs.open({
        editorType: 'sent-tx',
        title: 'Transactions',
        active: true,
        pane: pane,
        demandExisting: true
      }, function(err, tab) {
        if (err) return cb(err);
        if (!tab.classList.names.contains('dark')) tab.classList.add('dark');
        cb(null, tab.editor);
      });
    }

    function addTx(tx, web3) {
      show(function(err, editor) {
        if (err) console.error(err);
        else editor.addTx(tx);
      });
    }

    handle.freezePublicAPI({ addTx: addTx });
    register(null, { 'ethergit.sent.txs.editor': handle });
  }
});
