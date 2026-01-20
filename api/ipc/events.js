const path = require("path");

module.exports = async (req, res) => {
  // Enable TS + path aliases for server-side imports.
  require("esbuild-register/dist/node").register({ target: "es2022" });
  if (!process.env.TS_NODE_PROJECT) {
    process.env.TS_NODE_PROJECT = path.resolve(
      __dirname,
      "../../tsconfig.server.json",
    );
  }
  require("tsconfig-paths/register");

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const clientId =
    typeof req.query?.clientId === "string" ? req.query.clientId : null;

  if (!clientId) {
    res.status(400).json({ error: "Missing clientId" });
    return;
  }

  const { subscribeToClient } = require("../../src/server/event_bus");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  res.write(`data: ${JSON.stringify({ type: "connected", clientId })}\n\n`);

  const sendEvent = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const unsubscribe = subscribeToClient(clientId, sendEvent);

  const heartbeatInterval = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 30000);

  req.on("close", () => {
    clearInterval(heartbeatInterval);
    unsubscribe();
    res.end();
  });
};
