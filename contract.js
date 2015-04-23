define(function(require) {
    var Buffer = require('./buffer').Buffer;
    var Parsers = require('./parsers');
    var utils = require('./utils');
    utils.loadPolyfills();
    
    return {
        init: function(sandbox, address, details) {
            this.address = address;
            this.sandbox = sandbox;
            this.name = details.name;
            this.abi = details.abi;
            return this;
        },
        call: function(name, args, cb) {
            var method = this.findMethod(name);
            if (!method) return cb({ general: 'Could not find method: ' + name });
            
            var err = this.checkArgs(method, args);
            if (err) return cb({ general: err });

            var errors = method.inputs.reduce(function(errors, input) {
                var errs = Parsers.parser(input.type).validate(args[input.name]);
                if (errs.length > 0) errors[input.name] = errs;
                return errors;
            }, {});
            if (Object.keys(errors).length > 0) return cb(errors);
            
            var encArgs = method.inputs.map(function(input) {
                return Parsers.parser(input.type).parse(args[input.name]);
            });
            
            this.sandbox.runTx({
                to: new Buffer(this.address, 'hex'),
                data: Buffer.concat([this.encodeMethod(method)].concat(encArgs))
            }, function(err, results) {
                if (err) cb({ general: err });
                else cb(null, results);
            });
        },
        findMethod: function(name) {
            return this.abi.find(function(method) {
                return method.name === name;
            });
        },
        checkArgs: function(method, args) {
            var inputs = method.inputs;
            
            if (inputs.length !== Object.keys(args).length || 
                !inputs.every(function(arg) { return args.hasOwnProperty(arg.name) }))
                return 'Wrong arguments.';
        },
        encodeMethod: function(method) {
            var name = method.name + '(';
            var first = true;
            method.inputs.forEach(function(input) {
                if (first) first = false;
                else name += ',';
                name += input.type;
            });
            name += ')';
            return new Buffer(utils.sha3(new Buffer(utils.strToHex(name), 'hex')).slice(0, 8), 'hex');
        }
    };
});