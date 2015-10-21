define(function(require) {
    var Parsers = require('./parsers');
    var utils = require('./utils');
    
    var Contract = {
        init: function(address, details) {
            this.address = address;
            this.name = details.name;
            this.abi = details.abi;
            return this;
        },
        call: function(sandbox, options, cb) {
            var method = this.findMethod(options.name);
            if (!method) return cb({ general: 'Could not find method: ' + options.name });
            
            var err = checkArgs(method, options.args);
            if (err) return cb({ general: err });

            var errors = method.inputs.reduce(function(errors, input) {
                var errs = Parsers.parser(input.type).validate(options.args[input.name]);
                if (errs.length > 0) errors[input.name] = errs;
                return errors;
            }, {});
            if (Object.keys(errors).length > 0) return cb(errors);

            var encArgs = '', dynArgs = '';
            _.each(method.inputs, function(input) {
                var val = Parsers.parser(input.type).parse(options.args[input.name]);
                if (val.length == 64) {
                    encArgs += val;
                } else {
                    encArgs += utils.fillWithZeroes(
                        (method.inputs.length * 32 + dynArgs.length / 2).toString(16),
                        64
                    );
                    dynArgs += val;
                }
            });
            encArgs += dynArgs;

            sandbox.runTx({
                to: this.address,
                data: encodeMethod(method) + encArgs,
                from: options.from,
                pkey: options.pkey,
                value: options.value,
                gasPrice: options.gasPrice,
                gasLimit: options.gasLimit
            }, function(err, results) {
                if (err) cb({ general: err });
                else cb(null, results);
            });
            
            function checkArgs(method, args) {
                var inputs = method.inputs;
                if (inputs.length !== Object.keys(args).length || 
                    !inputs.every(function(arg) { return args.hasOwnProperty(arg.name); }))
                    return 'Wrong arguments.';
            }
            function encodeMethod(method) {
                return utils.sha3(signature(method)).substr(2, 8);
            }
        },
        findMethod: function(name) {
            return _.findWhere(this.abi, { type: 'function', name: name });
        },
        findEvent: function(hash) {
            return _(this.abi).filter({ type: 'event' }).find(function(field) {
                return encodeEvent(field) === hash;
            });

            function encodeEvent(method) {
                return utils.sha3(signature(method));
            }
        }
    };

    return Contract;
    
    function signature(method) {
        var name = method.name + '(';
        var first = true;
        method.inputs.forEach(function(input) {
            if (first) first = false;
            else name += ',';
            name += input.type;
        });
        name += ')';
        return name;
    }
});
