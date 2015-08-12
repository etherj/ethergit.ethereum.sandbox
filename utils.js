define(function(require) {
    var SHA3Hash = require('./sha3').SHA3Hash;
    var ethereumjsUtil = require('./ethereumjs-util');
    
    return {
        strToHex: function(str) {
            var hex = "";
            for (var i = 0; i < str.length; i++) {
                var n = str.charCodeAt(i).toString(16);
                hex += n.length < 2 ? '0' + n : n;
            }
            return hex;
        },
        fillWithZeroes: function(str, length, right) {
            if (str.length >= length) return str;
            var zeroes = _.repeat('0', length - str.length);
            return right ? str + zeroes : zeroes + str;
        },
        sha3: function(str) {
            var sha = new SHA3Hash();
            sha.update(str);
            return sha.digest();
        },
        pad: function(str) {
            return str.length % 2 === 0 ? str : '0' + str;
        },
        calcNewAddress: function(from, nonce) {
            return ethereumjsUtil.generateAddress(from, nonce + 1);
        },
        // Workaround for https://github.com/c9/core/issues/71
        removeMetaInfo: function(text) {
            var jsonAtTheEnd = text.indexOf('{"changed"');
            if (jsonAtTheEnd === -1) jsonAtTheEnd = text.indexOf('{"filter"');
            return jsonAtTheEnd !== -1 ? text.substr(0, jsonAtTheEnd) : text;
        },
        removeTrailingZeroes: function(str) {
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
    };
});
