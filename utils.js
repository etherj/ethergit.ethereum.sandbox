define(function(require) {
  var EthJS = require('./ethereumjs-tx');
  var Buffer = EthJS.Buffer.Buffer;

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
      return '0x' + EthJS.Util.sha3(str).toString('hex');
    },
    pad: function(str) {
      return str.length % 2 === 0 ? str : '0' + str;
    },
    calcNewAddress: function(from, nonce) {
      return '0x' + EthJS.Util
        .generateAddress(new Buffer(from.substr(2), 'hex'), nonce)
        .toString('hex');
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
    },
    toAddress: function(pkey) {
      return '0x' + EthJS.Util
        .privateToAddress(new Buffer(pkey.substr(2), 'hex'))
        .toString('hex');
    },
    createTx: function(options) {
      var tx = new EthJS.Tx({
        nonce: options.nonce,
        value: options.value,
        data: new Buffer(options.data.substr(2), 'hex'),
        gasLimit: options.gasLimit,
        gasPrice: options.gasPrice
      });
      tx.sign(new Buffer(options.pkey.substr(2), 'hex'));
      return '0x' + tx.serialize().toString('hex');
    }
  };
  
});
