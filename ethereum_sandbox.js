define(function(require) {
    var Ethereum = require('./ethereumjs-lib.js');
    var Trie = Ethereum.Trie;
    var VM = Ethereum.VM;
    var Account = Ethereum.Account;
    var Transaction = Ethereum.Transaction;
    var Buffer = require('./buffer.js').Buffer;
    var Emitter = require("events").EventEmitter;
    var async = require('async');
    var SHA3Hash = require('./sha3.js').SHA3Hash;
    
    return {
        state: 'INITIALIZING',
        on: function(eventName, callback, plugin) {
            this.emitter.on(eventName, callback, plugin);
        },
        setState: function(state) {
            var prev = this.state;
            this.state = state;
            this.emitter.emit('stateChanged', {
                current: this.state, previous: prev
            });
        },
        init: function() {
            this.emitter = new Emitter();
            this.trie = new Trie();
            this.vm = new VM(this.trie);
            return this;
        },
        initEnv: function(env, cb) {
            var that = this;
            async.each(Object.getOwnPropertyNames(env), function(address, callback) {
                var options = env[address];
                options.address = new Buffer(address, 'hex');
                if (options.hasOwnProperty('code'))
                    options.code = new Buffer(options.code, 'hex');

                that.createAccount(options, callback);
            }, function(err) {
                that.setState(err === null ? 'INITIALIZED' : 'ERROR');
                cb(err);
            });
        },
        createAccount: function(options, cb) {
            var account = new Account();
            account.balance = options.balance;
            if (options.nonce) account.nonce = options.nonce;
            var that = this;
            async.series([
                function(done) {
                    if (!options.hasOwnProperty('storage')) return done();
                    
                    var strie = new Trie();
                    async.eachSeries(
                        Object.getOwnPropertyNames(options.storage),
                        function(key, cb) {
                            strie.put(new Buffer(key, 'hex'), new Buffer(options.storage[key], 'hex'), cb);
                        },
                        function(err) {
                            account.stateRoot = strie.root;
                            done(err);
                        }
                    );
                },
                function(done) {
                    if (!options.hasOwnProperty('code')) return done();
                    
                    account.storeCode(that.trie, options.code, done);
                },
                this.trie.put.bind(this.trie, options.address, account.serialize())
            ], cb);
        },
        sha3: function(str) {
            var sha = new SHA3Hash();
            sha.update(str);
            return sha.digest();
        },
        createTx: function(options) {
            var tx = new Transaction();
            tx.nonce = options.hasOwnProperty('nonce') ? options.nonce : 0;
            tx.to = options.hasOwnProperty('to') ? options.to : null;
            tx.gasPrice = 100;
            tx.gasLimit = 100000;
            tx.value = options.hasOwnProperty('value') ? options.value : 0;
            tx.data = options.data;
            tx.sign(new Buffer(this.sha3(options.seed), 'hex'));
            return tx;
        },
        runTx: function(tx, cb) {
            var that = this;
            this.vm.runTx({tx: tx}, function(err, results) {
                that.emitter.emit('stateChanged', null);
                cb(err, results);
            });
        }
    };
});