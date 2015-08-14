define(function() {
    return {
        formatters: [
            {
                type: 'data',
                format: function(val) {
                    return val;
                }
            },
            {
                type: 'number',
                format: function(val) {
                    return val.length == 0 ? 0 : parseInt(removeLeadingZeroBytes(val), 16);
                    
                    function removeLeadingZeroBytes(str) {
                        if (str.length % 2 !== 0)
                            console.error('Wrong hex str: ' + str);
                            
                        var firstNonZeroByte = str.length - 2;
                        for (var i = 0; i < str.length; i += 2) {
                            if (str.charAt(i) !== '0' || str.charAt(i + 1) !== '0') {
                                firstNonZeroByte = i;
                                break;
                            }
                        }
                        
                        return str.substring(firstNonZeroByte);
                    }
                }
            },
            {
                type: 'bool',
                format: function(val) {
                    val = parseInt(val);
                    return val === 1 ? 'true' : 'false';
                }
            },
            {
                type: 'string',
                format: function(val) {
                    return String.fromCharCode.apply(null, toArray(removeTrailingZeroBytes(val)));
                    
                    function removeTrailingZeroBytes(str) {
                        if (str.length % 2 !== 0)
                            console.error('Wrong hex str: ' + str);
                            
                        var lastNonZeroByte = 0;
                        for (var i = str.length - 2; i >= 2; i -= 2) {
                            if (str.charAt(i) !== '0' || str.charAt(i + 1) !== '0') {
                                lastNonZeroByte = i;
                                break;
                            }
                        }
                        
                        return str.substr(0, lastNonZeroByte + 2);
                    }
                    
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
            {
                type: 'address',
                format: function(val) {
                    return val.substr(24);
                }
            }
        ],
        init: function ($container) {
            var that = this;
            $container.find('[data-formatter]').each(function() {
                var $el = $(this);
                var $target = $el.parent().parent().find('[data-name=' + $el.data('formatter') + ']');
                var value = $target.text();
                var type = that.detectType(value);
                $el.data('formatter-type', type.type);
                $el.text(type.type);
                $el.data('formatter-value', value);
                $target.text(type.format(value));
            });
        },
        detectType: function(value) {
            return this.getFormatter(getType(value));

            function getType(data) {
                // 24 leading zeroes -> address
                if (/^0{24}[^0]{2}/.test(data)) {
                    return 'address';
                }
                // 7-31 trailing zeroes -> string
                if (/[^0]0{14,62}0?$/.test(data)) {
                    return 'string';
                }
                if (/^0{48}/.test(data)) {
                    return 'number';
                }
                return 'data';
            }
        },
        format: function(e) {
            var $el = $(e.target);
            var target = $el.data('formatter');
            if (!target) return;
            
            e.preventDefault();
            var formatter = nextFormatter(this.formatters, $el.data('formatter-type'));
            $el.data('formatter-type', formatter.type);
            $el.text(formatter.type);
            var $target = $el.parent().parent().find('[data-name=' + $el.data('formatter') + ']');
            $target.text(formatter.format($el.data('formatter-value'))); 
            
            function nextFormatter(formatters, type) {
                var idx = 0;
                for (var i = 0; i < formatters.length; i++) {
                    if (formatters[i].type === type) {
                        idx = i;
                        break;
                    }
                }
                return formatters[idx === formatters.length - 1 ? 0 : idx + 1];
            }
        },
        findFormatter: function(realType) {
            if (realType === 'address') return this.getFormatter('address');
            if (realType.indexOf('bytes') > -1) return this.getFormatter('string');
            if (realType.indexOf('int') > -1) return this.getFormatter('number');
            if (realType === 'bool') return this.getFormatter('bool');
            else return this.getFormatter('data');
        },
        getFormatter: function(type) {
            for (var i = 0; i < this.formatters.length; i++) {
                if (this.formatters[i].type === type) return this.formatters[i];
            }
        }
    };
});
