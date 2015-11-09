define(['./utils'], function(utils) {
  var formatters = {
    data: {
      name: 'data',
      format: function(value) {
        return value;
      }
    },
    uint: {
      name: 'uint',
      format: function(value) {
        return new BigNumber(value.substr(2), 16).toString();
      }
    },
    int: {
      name: 'int',
      format: function(value) {
        value = value.substr(2);
        if (parseInt(value.charAt(0), 16).toString(2).charAt(0) === '1')
          return new BigNumber(value, 16).minus(new BigNumber(2).pow(256)).toString();
        else
          return new BigNumber(value, 16).toString();
      }
    },
    string: {
      name: 'string',
      format: function(value) {
        return String.fromCharCode.apply(
          null,
          toArray(utils.removeTrailingZeroes(value.substr(2)))
        );

        function toArray(str) {
          if (str.length % 2 !== 0)
            console.error('Wrong hex str: ' + str);
          
          var arr = [];
          for (var i = 0; i < str.length; i += 2) {
            var code = parseInt(str.charAt(i) + str.charAt(i + 1), 16);
            // Ignore non-printable characters
            if (code > 9) arr.push(code);
          }
          
          return arr;
        }
      }
    },
    address: {
      name: 'address',
      format: function(value) {
        value = value.substr(2);
        if (value.length == 40) return '0x' + value;
        else if (value.length > 40) return '0x' + value.substr(value.length - 40);
        else return '0x' + utils.fillWithZeroes(value, 40);
      }
    },
    bool: {
      name: 'bool',
      format: function(value) {
        var val = parseInt(value.substr(2), 16);
        return val === 1 ? 'true' : 'false';
      }
    }
  };

  return formatter;

  function formatter(value, tmpl) {
    if (!tmpl)
      tmpl = '<span><span data-name="value"><%= value %></span><a data-name="switch" href="#" class="button"><%= type %></a>';
    tmpl = _.template(tmpl);

    var formatter = detect(value);
    var type = formatter.name;
    var $el = $(tmpl({
      value: formatter.format(value),
      type: formatter.name
    }));
    var $value = $el.find('[data-name=value]');
    var $switch = $el.find('[data-name=switch]');
    $switch.click(function(e) {
      e.preventDefault();
      var nextFormatter = next(type);
      type = nextFormatter.name;
      $switch.text(type);
      $value.text(nextFormatter.format(value));
    });
    return $el;
  };
  
  function detect() {
    return formatters['data'];
  }

  function next(type) {
    var names = _.keys(formatters);
    var idx = _.findIndex(names, function(name) { return name === type; });
    var name = idx < names.length - 1 ? names[idx + 1] : names[0];
    return formatters[name];
  }
});
