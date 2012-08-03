var util = require("util"),
    io = require('socket.io-client');

module.exports = function(protocol, host, port) {
  var emitter = {},
      queue = [],
      url = "http:" + "//" + host + ":" + port + "/1.0/event/put",
      socket,
      timeout,
      closing;

  function close() {
    if (socket) {
      util.log("closing socket");
      socket.removeListener("error", reopen);
      socket.removeListener("close", reopen);
      socket.disconnect();
      socket = null;
    }
  }

  function open() {
    timeout = 0;
    close();
    util.log("opening socket: " + url);
    var client = io.connect(url);
    client.on("connect", function() {
      console.log("Connected.");
    });

    socket = client;
    socket.on("message", log);
    //socket.on("error", reopen);
    //socket.on("close", reopen);
    flush();
    if (closing) close();

    //client.on("connectFailed", reopen);
    //client.on("error", reopen);
  }

  function reopen() {
    if (!timeout && !closing) {
      util.log("reopening soon");
      timeout = setTimeout(open, 1000);
    }
  }

  function flush() {
    var event;
    while (event = queue.pop()) {
      try {
        socket.emit("message", event);
      } catch (e) {
        util.log(e.stack);
        reopen();
        return queue.push(event);
      }
    }
  }

  function log(message) {
    util.log(message);
  }

  emitter.send = function(event) {
    queue.push(event);
    if (socket) flush();
    return emitter;
  };

  emitter.close = function() {
    close();
    return emitter;
  };

  emitter.socket = function() {
    return socket;
  };

  open();

  return emitter;
};
