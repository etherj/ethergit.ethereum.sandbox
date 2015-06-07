define(function(require) {
    var utils = require('./utils');
    
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
                        return utils.fillWithZeroes(parseInt(value, 10).toString(16), 64);
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
                        return utils.fillWithZeroes(utils.pad(utils.strToHex(value)), 64, true);
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
                    return utils.fillWithZeroes(value, 64);
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