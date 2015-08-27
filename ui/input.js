define(['../validator/validators'], function(validators) {
    return function(type) {
        var validator = validators(type), $input, $error;
        var widget = {
            html: function() {
                var $html = $('<div><input type="text" class="form-control" ' +
                    (validator.length ? 'maxlength="' + validator.length + '"' : '') +
                    '/><p class="help-block"/></div>');
                $input = $html.find('.form-control');
                $error = $html.find('.help-block');
                return $html;
            },
            validate: function() {
                var errors = validator.validate($input.val());
                $error.html(errors.join('<br/>'));
                return errors.length === 0;
            },
            value: function() {
                return widget.validate() ? $input.val() : null;
            }
        };
        return widget;
    };
});
