module.exports = function(vfs, options, register) {
  var Stream = require('stream');
  var net = require('net');
  var http = require('http');
  var https = require('https');
  var url = require('url');
  var FormData = require('form-data');
  var fs = require('fs');
  var stream;
  
  function connect(port, cb) {
    stream = new Stream();
    stream.readable = true;
    stream.writable = true;
    stream.write = function(data) {
      send(JSON.parse(data));
    };
    cb(null, { stream: stream });
  }

  function send(request) {
    console.log('sending');
    var httpOrHttps = request.url.indexOf('https') == 0 ? https : http;

    var form = new FormData();
    request.fields.forEach(function(field) {
      if (field.type == 'string') {
        form.append(field.key, field.value);
      } else if (field.type == 'file') {
        form.append(field.key, fs.createReadStream(field.value));
      }
    });
    
    var opts = url.parse(request.url);
    opts.method = 'POST';
    opts.headers = form.getHeaders();

    var req = httpOrHttps.request(opts);
    form.pipe(req);

    req.on('response', function(res) {
      var body = '';
      res.on('data', function(chunk) {
        body += chunk.toString();
      });
      res.on('end', function() {
        console.log('got response with status ' + res.statusCode);
        var status = parseInt(res.statusCode);
        if (status < 200 || status >= 300) {
          stream.emit('data', JSON.stringify({
            id: request.id,
            error: {
              status: res.statusCode,
              message: res.statusCode + ' ' + res.statusMessage
            },
            body: body
          }));
        } else {
          stream.emit('data', JSON.stringify({
            id: request.id,
            body: body
          }));
        }
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
  }

  register(null, {
    connect: connect
  });
};
