define(function() {
  return function(type) {
    var strSize = parseInt(type.substr(5));
    var hexSize = parseInt(type.substr(5)) * 2 + 2;
    return {
      length: hexSize,
      validate: function(value) {
        var errors = [];
        if (value.match(/^0x[\dabcdef]+$/)) {
          if (value.length > hexSize)
            errors.push(type + ' size of hex data must be not greater than ' + strSize + ' bytes.');
        } else {
          if (value.length > strSize)
            errors.push(type + ' length of string must be not greater than ' + strSize + ' chars.');
        }
        return errors;
      }
    };
  };
});
