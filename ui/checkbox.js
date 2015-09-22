define(function() {
  return function(defaultVal) {
    var $input;
    return {
      html: function() {
        $input = $('<input type="checkbox" ' + (defaultVal ? 'checked' : '') + '>');
        return $input;
      },
      validate: function() { return true; },
      value: function() {
        return $input.is(':checked');
      }
    };
  };
});
