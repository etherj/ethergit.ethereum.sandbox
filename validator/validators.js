define(
    ['./uintN', './intN', './bytesN', './address', './string', './bool', './bytes', './array'],
    function(
        uintNValidator,
        intNValidator,
        bytesNValidator,
        addressValidator,
        stringValidator,
        boolValidator,
        bytesValidator,
        arrayValidator
    ) {
        var dummyValidator = {
            validate: function(value) {
                console.error('Using dummy validator');
                return [];
            }
        };
        
        return function(type) {
            if (type === 'address') return addressValidator;
            if (type === 'string') return stringValidator;
            if (type === 'bool') return boolValidator;
            if (type === 'bytes') return bytesValidator;
            if (/^uint\d+$/.test(type)) return uintNValidator(type);
            if (/^int\d+$/.test(type)) return intNValidator(type);
            if (/^bytes\d+$/.test(type)) return bytesNValidator(type);
            if (_.endsWith(type, ']')) return arrayValidator(type);
            return dummyValidator;
        };
    }
);
