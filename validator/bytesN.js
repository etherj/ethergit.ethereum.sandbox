define(function() {
    return function(type) {
        var size = parseInt(type.substr(5)) * 2;
        return {
            length: size,
            validate: function(value) {
                var errors = [];
                if (value.length > size)
                    errors.push(type + ' length must be not greater than ' + size + '.');
                return errors;
            }
        };
    };
});
