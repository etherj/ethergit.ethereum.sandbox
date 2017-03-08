define(['./utils', './folder'], function(utils, folderFn) {
  return function(_) {
    var folder = folderFn(_);
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
          return new BigNumber(value.substr(2), 16).toFixed();
        }
      },
      int: {
        name: 'int',
        format: function(value) {
          value = value.substr(2);
          if (parseInt(value.charAt(0), 16) >= 8)
            return new BigNumber(value, 16).minus(new BigNumber(2).pow(256)).toFixed();
          else
            return new BigNumber(value, 16).toFixed();
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
        tmpl = '<span>' +
        '<span data-name="value" class="folder" data-folder=""><%= value %></span>' +
        '<a data-name="switch" href="#" class="button"><%= type %></a>' +
        '</span>';
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
        folder.init($el);
      });
      folder.init($el);
      return $el;
    }
    
    function detect(value) {
      if (value.match(/^0xffff/)) return formatters['int'];
      if (value.match(/^0x0{28}/)) return formatters['uint'];
      if (value.match(/^0x0{24}/)) return formatters['address'];
      if (isString(value.substr(2))) return formatters['string'];
      return formatters['data'];

      function isString(value) {
        if (value.length % 2 !== 0) value = '0' + value;
        var i = 0;
        for (; i < value.length; i += 2) {
          var code = parseInt(value.substr(i, 2), 16);
          if (code == 0) break;
          if (!isChar(code)) return false;
        }

        for (; i < value.lenght; i += 2) {
          if (parseInt(value.substr(i, 2), 16) != 0) return false;
        }
        
        return true;

        function isChar(code) {
          return code > 31 && code < 127;
        }
      }
    }

    function next(type) {
      var names = _.keys(formatters);
      var idx = _.findIndex(names, function(name) { return name === type; });
      var name = idx < names.length - 1 ? names[idx + 1] : names[0];
      return formatters[name];
    }
  };
});
