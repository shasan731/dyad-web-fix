const path = require("path");

process.env.DYAD_WEB_MODE = process.env.DYAD_WEB_MODE || "true";
process.env.TS_NODE_PROJECT =
  process.env.TS_NODE_PROJECT ||
  path.resolve(__dirname, "..", "tsconfig.server.json");

require("./register-electron-stub");
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

require("../src/server/index.ts");
