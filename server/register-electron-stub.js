const Module = require("module");
const path = require("path");

const originalLoad = Module._load;
const stubPath = path.join(__dirname, "electron_stub.js");

Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return originalLoad(stubPath, parent, isMain);
  }
  return originalLoad(request, parent, isMain);
};
