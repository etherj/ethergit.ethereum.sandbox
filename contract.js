define(function(require) {
    var Parsers = require('./parsers');
    var utils = require('./utils');
    utils.loadPolyfills();
    
    return {
        init: function(address, details) {
            this.address = address;
            this.name = details.name;
            this.abi = details.abi;
            return this;
        },
        call: function(sandbox, from, pkey, name, args, cb) {
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

            sandbox.runTx({
                to: this.address,
                data: this.encodeMethod(method) + encArgs.join(''),
                from: from,
                pkey: pkey
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
            return utils.sha3(name).substr(0, 8);
        }
    };
});