define(function(require) {
  main.consumes = [
    'editors', 'Editor', 'ui', 'tabManager'
  ];
  main.provides = ['ethergit.sent.txs.editor'];
  return main;

  function main(options, imports, register) {
    var editors = imports.editors;
    var Editor = imports.Editor;
    var ui = imports.ui;
    var tabs = imports.tabManager;

    function TransactionsEditor() {
      var txs = new Editor('Ethergit', main.consumes, []);
      txs.load(null, 'sent-txs');

      tsx.freezPublicAPI({});

      return txs;
    }

    var handle = editors.register('sent-tx', 'Transactions', TransactionsEditor, []);

    function show(cb) {
      var pane = tabs.getPanes().length > 1 ?
          tabs.getPanes()[1] :
          tabs.getPanes()[0].vsplit(true);
      
      tabs.open({
        editorType: 'send-tx',
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
        if (err) return console.error(err);
      });
    }

    handle.freezePublicAPI({ addTx: addTx });
    register(null, { 'ethergit.sent.txs.editor': handle });
  }
});
