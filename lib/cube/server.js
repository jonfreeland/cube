// Rewrite of Cube's server.js to support socket.io
var util = require("util"),
    url = require("url"),
    http = require("http"),
    dgram = require("dgram"),
    websocket = require("websocket"),
    websprocket = require("websocket-server"),
    static = require("node-static"),
    mongodb = require("mongodb"),
    io = require('socket.io');

// MongoDB driver configuration.
var server_options = {auto_reconnect: true},
    db_options = {};

module.exports = function(options) {
  var server = {},
      primary = http.createServer(),
      secondary = io.listen(primary),
      file = new static.Server("static"),
      meta,
      endpoints = {ws: [], http: []},
      mongo = new mongodb.Server(options["mongo-host"], options["mongo-port"], server_options),
      db = new mongodb.Db(options["mongo-database"], mongo, db_options),
      id = 0;

  var connectionHandler = function(endpoint) {
    return function(socket) {
      socket.on("message", function(message) {

        meta({
          type: "cube_request",
          time: Date.now(),
          data: {
            ip: socket.handshake.address,
            path: endpoint.path,
            method: "WebSocket"
          }
        });

        endpoint.dispatch(message, function(response) {
          socket.emit("message", response);
        });
      });
    }
  };

  var disconnectionHandler = function(endpoint) {
    return function() {
      if (endpoint.dispatch.close) {
        endpoint.dispatch.close();
      }
    };
  };

  var bindToEndpoints = function() {
    for (var i = 0; i < endpoints.ws.length; i++) {
      secondary.of(endpoints.ws[i].path)
        .on("connection", connectionHandler(endpoints.ws[i]))
        .on("disconnect", disconnectionHandler(endpoints.ws[i]));
    }
  }

  // Register HTTP listener.
  primary.on("request", function(request, response) {
    var u = url.parse(request.url);

    // Forward messages to the appropriate endpoint, or 404.
    for (var i = -1, n = endpoints.http.length, e; ++i < n;) {
      if ((e = endpoints.http[i]).match(u.pathname, request.method)) {
        e.dispatch(request, response);

        meta({
          type: "cube_request",
          time: Date.now(),
          data: {
            ip: request.connection.remoteAddress,
            path: u.pathname,
            method: request.method
          }
        });

        return;
      }
    }

    // If this request wasn't matched, see if there's a static file to serve.
    request.on("end", function() {
      file.serve(request, response, function(error) {
        if (error) {
          response.writeHead(error.status, {"Content-Type": "text/plain"});
          response.end(error.status + "");
        }
      });
    });
  });

  server.start = function() {
    // Connect to mongodb.
    util.log("starting mongodb client");
    db.open(function(error) {
      if (error) throw error;
      if (options["mongo-username"] == null) return ready();
      db.authenticate(options["mongo-username"], options["mongo-password"], function(error, success) {
        if (error) throw error;
        if (!success) throw new Error("authentication failed");
        ready();
      });
    });

    // Start the server!
    function ready() {
      server.register(db, endpoints);
      meta = require("./event").putter(db);
      bindToEndpoints();
      util.log("starting http server on port " + options["http-port"]);
      primary.listen(options["http-port"]);
    }
  };

  return server;
};

function ignore() {
  // Responses for UDP are ignored; there's nowhere for them to go!
}
