module.exports = function (vfs, options, register) {
  var Stream = require('stream');
  var net = require('net');
  var http = require('http');
  var https = require('https');
  var url = require('url');
  var stream, server;
  
  function connect(port, callback) {
    stream = new Stream();
    stream.readable = true;
    stream.writable = true;
    stream.write = function(data) {
      send(JSON.parse(data));
    };

    callback(null, { stream: stream });
  }

  function send(request) {
    request.payload = JSON.stringify(request.payload);

    var httpOrHttps = request.url.indexOf('https') == 0 ? https : http;
    var opts = url.parse(request.url);
    opts.method = 'POST';
    opts.headers = {
      'Content-Type': 'application/json',
      'Content-Lenght': request.payload.length
    };
    
    var req = httpOrHttps.request(opts, function(res) {
      var body = '';
      res.on('data', function(chunk) {
        body += chunk.toString();
      });
      res.on('end', function() {
        var payload = JSON.parse(body);
        stream.emit('data', JSON.stringify({
          id: request.id,
          payload: payload
        }));
      });
    });
    
    req.on('error', function(e) {
      stream.emit('data', JSON.stringify({
        id: request.id,
        error: {
          message: e.message
        }
      }));
    });
    
    req.end(request.payload);
  }
  
  register(null, {
    connect: connect
  });
};

