var configFilePath = "./collector-config";
if(process.argv[2]) {
  configFilePath = process.argv[2];
  console.log("Configuring collector with \""+configFilePath+"\"");
}

var options = require(configFilePath),
    cube = require("../"),
    server = cube.server(options);

server.register = function(db, endpoints) {
  cube.collector.register(db, endpoints);
};

server.start();
