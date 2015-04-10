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
    var rlp = require('./rlp.js');
    
    return {
        state: 'INITIALIZING',
        defaultAccount: null,
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
            async.each(Object.getOwnPropertyNames(env), function(address, cb) {
                var options = env[address];
                
                if (that.defaultAccount == null) {
                    if (!options.hasOwnProperty('pkey'))
                        return cb('First account in sandbox.json should have a pkey.');

                    that.defaultAccount = {
                        nonce: options.hasOwnProperty('nonce') ? parseInt(options.nonce, 16) : 0,
                        pkey: options.pkey
                    };
                }
                
                options.address = new Buffer(address, 'hex');
                if (options.hasOwnProperty('code'))
                    options.code = new Buffer(options.code, 'hex');

                that.createAccount(options, cb);
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
                    if (!options.hasOwnProperty('code')) return done();
                    
                    account.storeCode(that.trie, options.code, done);
                },
                function(done) {
                    if (!options.hasOwnProperty('storage')) return done();
                    
                    function createBuffer(str) {
                        var msg = new Buffer(str, 'hex');
                        var buf = new Buffer(32);
                        buf.fill(0);
                        msg.copy(buf, 32 - msg.length);
                        return buf;
                    }

                    var strie = that.trie.copy();
                    strie.root = account.stateRoot;
                    async.eachSeries(
                        Object.getOwnPropertyNames(options.storage),
                        function(key, cb) {
                            strie.put(
                                createBuffer(key),
                                rlp.encode(new Buffer(options.storage[key], 'hex')),
                                function(err) {
                                    account.stateRoot = strie.root;
                                    cb(err);
                                }
                            );
                        },
                        done
                    );
                },
                function(done) {
                    that.trie.put(options.address, account.serialize(), done);
                }
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
            tx.sign(new Buffer(this.sha3(options.pkey), 'hex'));
            return tx;
        },
        runTx: function(options, cb) {
            var that = this;
            this.vm.runTx({
                tx: this.createTx({
                    nonce: this.defaultAccount.nonce,
                    data: options.data,
                    pkey: this.defaultAccount.pkey
                })
            }, function(err, results) {
                that.defaultAccount.nonce++;
                that.emitter.emit('stateChanged', null);
                cb(err, results);
            });
        }
    };
});