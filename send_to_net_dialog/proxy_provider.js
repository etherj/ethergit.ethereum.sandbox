define(function() {
  function ProxyProvider(proxy, url) {
    this.reqId = 0;
    this.url = url;
    this.proxy = proxy;
    this.callbacks = {};
    this.receive = (function(data) {
      try {
        var response = JSON.parse(data);
        if (response.error) {
          this.callbacks[response.id](response.error);
        } else {
          this.callbacks[response.id](null, response.payload);
        }
      } catch (e) {
        this.callbacks[response.id]('Could not parse the response');
      }  
      delete this.callbacks[response.id];
    }).bind(this);
    this.proxy.on('data', this.receive);
  };
  
  ProxyProvider.prototype.sendAsync = function(payload, cb) {
    this.proxy.write(JSON.stringify({
      id: this.reqId,
      url: this.url,
      payload: payload
    }));
    this.callbacks[this.reqId++] = cb;
  };

  ProxyProvider.prototype.destroy = function() {
    this.proxy.removeListener('data', this.receive);
  };

  return ProxyProvider;
});
