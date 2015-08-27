define(['ace/ace', '../validator/validators'], function(ace, validators) {
    return function(type) {
        var validator = validators(type), editor, $error;
        var widget = {
            html: function() {
                var $el = $('<div><div style="height:100px"></div><p class="help-block"/></div>');
                editor = ace.edit($el.children()[0]);
                editor.setTheme('ace/theme/xcode');
                editor.getSession().setMode('ace/mode/json');
                editor.getSession().setTabSize(2);
                $error = $el.find('.help-block');
                return $el;
            },
            validate: function() {
                try {
                    var value = $.parseJSON(editor.getValue());
                } catch (e) {
                    $error.text(e.message);
                    return false;
                }
                
                var errors = validator.validate(value);
                $error.html(_.map(errors, 'message').join('<br/>'));
                return errors.length === 0;
            },
            value: function() {
                return widget.validate() ? JSON.parse(editor.getValue()) : null;
            }
        };
        return widget;
    };
});
