define(function(require) {
    var utils = require('./utils');
    
    var parser = {
        parsers: {
            uintN: function(size) {
                return {
                    validate: function(value) {
                        var errors = [];
                        if (!value.match(/^\d+$/))
                            errors.push('Value must contain only digits.');
                        var max = new BigNumber(2).pow(size),
                            val = new BigNumber(value, 10);
                        if (!val.lessThan(max))
                            errors.push('Value must be less than 10^' + size + '.');
                        return errors;
                    },
                    parse: function(value) {
                        return utils.fillWithZeroes(new BigNumber(value, 10).toString(16), 64);
                    }
                };
            },
            intN: function(size) {
                return {
                    validate: function(value) {
                        var errors = [];
                        if (!value.match(/^-?\d+$/))
                            errors.push('Value must contain only sign and digits.');
                        var max = new BigNumber(2).pow(size),
                            val = new BigNumber(value, 10);
                        if (!val.lessThan(max))
                            errors.push('Value must be less than 10^' + size + '.');
                        return errors;
                    },
                    parse: function(value) {
                        var val = new BigNumber(value, 10);
                        return utils.fillWithZeroes(
                            val.isNegative() && !val.isZero() ?
                                new BigNumber(2).pow(size).plus(val).toString(16) :
                                val.toString(16),
                            64
                        );
                    }
                };
            },
            bytesN: function(size) {
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
            string: {
                validate: function(value) {
                    return [];
                },
                parse: function(value) {
                    return utils.fillWithZeroes(value.length.toString(16), 64) +
                        utils.fillWithZeroes(utils.pad(utils.strToHex(value)), 64, true);
                }
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
            },
            bool: {
                validate: function(value) {
                    var errors = [];
                    if (value !== 'true' && value !== 'false')
                        errors.push('Boolean must be true or false.');
                    return errors;
                },
                parse: function(value) {
                    return utils.fillWithZeroes(value === 'true' ? '1' : '0', 64);
                }
            }
        },
        parser: function(type) {
            if (type.indexOf('uint') === 0) {
                return parser.parsers['uintN'](parseInt(type.substr(4), 10));
            } else if (type.indexOf('int') === 0) {
                return parser.parsers['intN'](parseInt(type.substr(3), 10));
            } else if (type === 'bytes') {
                console.error('Type bytes is not supported yet.');
            } else if (type.indexOf('bytesN') === 0) {
                return parser.parsers['bytesN'](parseInt(type.substr(5), 10));
            } else if (type === 'string') {
                return parser.parsers['string'];
            } else if (type === 'address') {
                return parser.parsers['address'];
            } else if (type === 'bool') {
                return parser.parsers['bool'];
            } else
                console.error('Could not find validator for type ' + type);
        }
    };
    return parser;
});
