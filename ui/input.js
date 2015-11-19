define(['../validator/validators', '../utils'], function(validators, utils) {
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
        if (widget.validate()) {
          if (/^bytes\d+$/.test(type))
            return parseBytesN($input.val(), type);
          else
            return isNumber ? parseInt($input.val()) : $input.val();
        } else {
          return null;
        }
      },
      setValue: function(val) {
        $input.val(val);
      },
      focus: function() {
        $input.focus();
      }
    };
    return widget;
  };

  function parseBytesN(val, type) {
    if (!_.startsWith(val, '0x')) {
      return val;
    } else {
      var size = parseInt(type.substr(5));
      return '0x' + utils.fillWithZeroes(val.substr(2), size * 2);
    }
  }
});
