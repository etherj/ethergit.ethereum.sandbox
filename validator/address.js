define(function() {
    return {
        length: 42,
        validate: function(value) {
            var errors = [];
            if (!value.match(/^0x[\dabcdef]{40}$/))
                errors.push('address must contain 0x and 40 hex digits.');
            return errors;
        }
    };
});
