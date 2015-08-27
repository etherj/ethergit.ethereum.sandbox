define(function() {
    return {
        length: 66,
        validate: function(value) {
            var errors = [];
            if (!value.match(/^0x[\dabcdef]{0,64}$/))
                errors.push('bytes must contain 0x and 64 hex digits.');
            return errors;
        }
    };
});
