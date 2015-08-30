define(['../lib/json_parse.js', '../lib/jsen'], function(jsonParse, jsen) {
    var baseValidators = {
        address: {
            message: 'address must contain 0x and 40 hex digits.',
            validate: function(value) {
                return !value.match(/^0x[\dabcdef]{40}$/);
            }
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
        return baseValidators[baseValidators.hasOwnProperty(base) ? base : 'dummy'];
    }
    function generateSchema(type, baseValidator) {
        return {
            type: 'array',
            invalidMessage: 'Root element should be an array',
            items: {
                format: 'base',
                invalidMessage: 'Should be string'//baseValidator.message
            }
        };
    }
});
