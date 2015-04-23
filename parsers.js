define(function(require) {
    var Buffer = require('./buffer').Buffer;
    var utils = require('./utils');
    
    function createBufferFromBeginning(str) {
        var msg = new Buffer(str, 'hex');
        var buf = new Buffer(32);
        buf.fill(0);
        msg.copy(buf);
        return buf;
    }
    
    var parser = {
        parsers: {
            uint: function(size) {
                return {
                    validate: function(value) {
                        var errors = [];
                        if (!value.match(/^\d+$/))
                            errors.push('Value must contain only digits.');
                        if (value >= Math.pow(2, size))
                            errors.push('Value must be less than ' + Math.pow(2, size) + '.');
                        return errors;
                    },
                    parse: function(value) {
                        return utils.createBuffer(utils.pad(parseInt(value, 10).toString(16)));
                    }
                };
            },
            bytes: function(size) {
                return {
                    validate: function(value) {
                        var errors = [];
                        if (utils.strToHex(value).length / 2 > size)
                            errors.push('String length must be not greater than ' + size + ' symbols.');
                        return errors;
                    },
                    parse: function(value) {
                        return createBufferFromBeginning(utils.strToHex(value));
                    }
                };
            },
            address: {
                validate: function(value) {
                    var errors = [];
                    if (!value.match(/^[\dabcdef]*$/))
                        errors.push('Address must contain only hex digits.');
                    if (value.length != 40)
                        errors.push('Address must contain 40 symbols.');
                    return errors;
                },
                parse: function(value) {
                    return utils.createBuffer(value);
                }
            }
        },
        parser: function(type) {
            if (type.indexOf('uint') === 0) {
                return parser.parsers['uint'](parseInt(type.substr(4), 10));
            } else if (type.indexOf('bytes') === 0) {
                return parser.parsers['bytes'](parseInt(type.substr(5), 10));
            } else if (type === 'address') {
                return parser.parsers['address'];
            } else
                console.error('Could not find validator for type ' + type);
        }
    };
    return parser;
});