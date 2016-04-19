define(function() {
  var requestId = 0;
  
  function ProxyProvider(proxy, url) {
    this.url = url;
    this.proxy = proxy;
    this.callbacks = {};
    this.receive = (function(data) {
      try {
        var response = JSON.parse(data);
      } catch (e) {
        return console.error('Could not parse the proxy response', data);
      }

      if (!this.callbacks.hasOwnProperty(response.id)) return;
      
      if (response.error) {
        this.callbacks[response.id](response.error);
      } else {
        this.callbacks[response.id](null, response.payload);
      }
      delete this.callbacks[response.id];
    }).bind(this);
    this.proxy.on('data', this.receive);
  };
  
  ProxyProvider.prototype.sendAsync = function(payload, cb) {
    this.proxy.write(JSON.stringify({
      id: requestId,
      url: this.url,
      payload: payload
    }));
    this.callbacks[requestId++] = cb;
  };

  ProxyProvider.prototype.destroy = function() {
    this.proxy.removeListener('data', this.receive);
  };

  return ProxyProvider;
});
