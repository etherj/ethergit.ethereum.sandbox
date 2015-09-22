define(['../validator/validators'], function(validators) {
  return function(type, defaultVal) {
    var validator = validators(type), $input, $error;
    var isNumber = /^uint\d+$/.test(type) || /^int\d+$/.test(type);
    var widget = {
      html: function() {
        var $html = $(
          '<div><input type="text" class="form-control" ' +
            (validator.length ? 'maxlength="' + validator.length + '" ' : '') +
            (defaultVal == undefined || defaultVal == null ? '' : 'value="' + defaultVal + '"') +
            '/><p class="help-block"/></div>'
        );
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
        return widget.validate() ?
          (isNumber ? parseInt($input.val()) : $input.val()) : null;
      },
      setValue: function(val) {
        $input.val(val);
      }
    };
    return widget;
  };
});
