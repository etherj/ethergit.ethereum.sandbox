define(function() {
    return function(type) {
        var size = parseInt(type.substr(3));
        return {
            validate: function(value) {
                var errors = [];
                if (!value.match(/^-?\d+$/))
                    errors.push('int must contain only sign and digits.');
                else {
                    var max = new BigNumber(2).pow(size).minus(1),
                        val = new BigNumber(value, 10);
                    if (!val.lessThan(max))
                        errors.push(type + ' must be less than 2^' + size + '.');
                }
                return errors;
            }
        };
    };
});
