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
                var errors = validator.validate(editor.getValue());
                var annotations = [], errorInfo = '';
                _.each(errors, function(error) {
                    if (typeof error === 'object') {
                        annotations.push({
                            row: error.row,
                            column: 0,
                            text: error.text,
                            type: 'error'
                        });
                    } else {
                        errorInfo += error + '<br/>';
                    }
                });
                editor.getSession().setAnnotations(annotations);
                $error.html(errorInfo);
                return errors.length === 0;
            },
            value: function() {
                return widget.validate() ? JSON.parse(editor.getValue()) : null;
            }
        };
        return widget;
    };
});
