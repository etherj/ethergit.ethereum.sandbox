define(function(require) {
    var Buffer = require('./buffer').Buffer;
    var SHA3Hash = require('./sha3').SHA3Hash;
    
    function arrayFindPolyfill() {
        if (!Array.prototype.find) {
            Array.prototype.find = function(predicate) {
                if (this == null) {
                    throw new TypeError('Array.prototype.find called on null or undefined');
                }
                if (typeof predicate !== 'function') {
                    throw new TypeError('predicate must be a function');
                }
                var list = Object(this);
                var length = list.length >>> 0;
                var thisArg = arguments[1];
                var value;
                
                for (var i = 0; i < length; i++) {
                    value = list[i];
                    if (predicate.call(thisArg, value, i, list)) {
                        return value;
                    }
                }
                return undefined;
            };
        }
    }
    
    return {
        loadPolyfills: function() {
            arrayFindPolyfill();
        },
        strToHex: function(str) {
            var hex = "";
            for (var i = 0; i < str.length; i++) {
                var n = str.charCodeAt(i).toString(16);
                hex += n.length < 2 ? '0' + n : n;
            }
            return hex;
        },
        createBuffer: function(str) {
            var msg = new Buffer(str, 'hex');
            var buf = new Buffer(32);
            buf.fill(0);
            msg.copy(buf, 32 - msg.length);
            return buf;
        },
        sha3: function(str) {
            var sha = new SHA3Hash();
            sha.update(str);
            return sha.digest();
        },
        pad: function(str) {
            return str.length % 2 === 0 ? str : '0' + str;
        }
    };
});