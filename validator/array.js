define(['../lib/json_parse.js', '../lib/jsen'], function(jsonParse, jsen) {
    var baseValidators = {
        address: {
            message: 'address must contain 0x and 40 hex digits.',
            validate: function(value) {
                return typeof value === 'string' && value.match(/^0x[\dabcdef]{40}$/);
            }
        },
        string: {
            message: 'Value is not a string.',
            validate: function(value) {
                return typeof value === 'string';
            }
        },
        bool: {
            message: 'Value is not a bool.',
            validate: function(value) {
                return typeof value === 'boolean';
            }
        },
        bytes: {
            message: 'bytes must contain 0x and hex digits.',
            validate: function(value) {
                return typeof value === 'string' && value.match(/^0x[\dabcdef]+$/);
            }
        },
        uintN: function(type) {
            var size = parseInt(type.substr(4));
            return {
                message: type + ' must be a positive number less than 2^' + size + '.',
                validate: function(value) {
                    if (typeof value !== 'number' || value < 0) return false;
                    var max = new BigNumber(2).pow(size),
                        val = new BigNumber(value, 10);
                    return val.lessThan(max);
                }
            };
        },
        intN: function(type) {
            var size = parseInt(type.substr(3));
            return {
                message: type + ' must be a number less than 2^' + size + '-1.',
                validate: function(value) {
                    if (typeof value !== 'number') return false;
                    var max = new BigNumber(2).pow(size).minus(1),
                        val = new BigNumber(value, 10).abs();
                    return val.lessThan(max);
                }
            };
        },
        bytesN: function(type) {
            var size = parseInt(type.substr(5));
            return {
                message: type + ' must be a string with length not greater than ' + size + '.',
                validate: function(value) {
                    return typeof value === 'string' && value.length <= size;
                }
            };
        },
        dummy: {
            message: 'Dummy message',
            validate: function(value) {
                console.error('Using dummy json validator');
                return true;
            }
        }
    };
    
    return function(type) {
        var baseValidator = getBaseValidator(type);
        var validate = jsen(generateSchema(type, baseValidator), {
            formats: { base: baseValidator.validate }
        });
        return {
            validate: function(value) {
                try {
                    var parsed = jsonParse(value);
                } catch (e) {
                    return [{
                        row: calcRow(value, e.at),
                        text: e.message
                    }];
                }
                if (validate(parsed)) {
                    return [];
                } else {
		    return _.map(validate.errors, 'message');
                }
            }
        };
    };
    function calcRow(value, at) {
        return ((value.substr(0, at).match(/\n/g) || []).length);
    }
    function getBaseValidator(type) {
        var base = type.substr(0, type.indexOf('['));
        if (base === 'address' || base === 'string' ||
            base === 'bool' || base === 'bytes') return baseValidators[base];
        if (/^uint\d+$/.test(base)) return  baseValidators['uintN'](base);
        if (/^int\d+$/.test(base)) return  baseValidators['intN'](base);
        if (/^bytes\d+$/.test(base)) return baseValidators['bytesN'](base);
        
        return baseValidators['dummy'];
    }
    function generateSchema(type, baseValidator) {
        var schema = {}, node = schema, arr, level = 0;
        while ((arr = type.indexOf('[', arr + 1)) != -1) {
            var size = type.substring(arr + 1, type.indexOf(']', arr));
            if (size.length !== 0) {
                node.minItems = node.maxItems = parseInt(size);
            }
            node.type = 'array';
            node.invalidMessage = 'Level ' + ++level + ' should be an array with ' + size + ' element(s).';
            node.items = {};
            node = node.items;
        }
        node.format = 'base';
        node.invalidMessage = baseValidator.message;
        return schema;
    }
});
