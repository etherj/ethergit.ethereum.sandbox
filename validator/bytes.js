define(function() {
    return {
        validate: function(value) {
            var errors = [];
            if (!value.match(/^0x[\dabcdef]+$/))
                errors.push('bytes must contain 0x and hex digits.');
            return errors;
        }
    };
});
