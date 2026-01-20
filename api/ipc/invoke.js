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

  if (!process.env.DYAD_WEB_MODE) {
    process.env.DYAD_WEB_MODE = "true";
  }
  if (!process.env.DYAD_PROXY_LISTEN_HOST) {
    process.env.DYAD_PROXY_LISTEN_HOST = "0.0.0.0";
  }
  if (!process.env.DYAD_PUBLIC_PROTOCOL) {
    process.env.DYAD_PUBLIC_PROTOCOL = "https";
  }
  if (!process.env.DYAD_PUBLIC_HOST) {
    process.env.DYAD_PUBLIC_HOST = "localhost";
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  try {
    if (!globalThis.__dyad_initialized) {
      const { initializeDatabase } = require("../../src/db");
      const { registerIpcHandlers } = require("../../src/ipc/ipc_host");
      const { cleanupOldAiMessagesJson } = require("../../src/pro/main/ipc/handlers/local_agent/ai_messages_cleanup");
      initializeDatabase();
      cleanupOldAiMessagesJson();
      registerIpcHandlers();
      globalThis.__dyad_initialized = true;
    }

    if (!globalThis.__dyad_broadcast) {
      const { broadcast } = require("../../src/server/event_bus");
      globalThis.__dyad_broadcast = (channel, ...args) =>
        broadcast({ channel, args });
    }

    const { VALID_INVOKE_CHANNELS } = require("../../src/ipc/ipc_channels");
    const { ipcMain } = require("../../src/platform/electron");
    const { publishToClient } = require("../../src/server/event_bus");

    const parsedBody =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { channel, args, clientId } = parsedBody || {};

    if (!channel || typeof channel !== "string") {
      res.status(400).json({ ok: false, error: "Missing channel" });
      return;
    }

    if (!VALID_INVOKE_CHANNELS.includes(channel)) {
      res.status(400).json({ ok: false, error: `Invalid channel: ${channel}` });
      return;
    }

    if (process.env.DYAD_PUBLIC_HOST === "localhost") {
      const forwardedHost = req.headers["x-forwarded-host"];
      const hostHeader = Array.isArray(forwardedHost)
        ? forwardedHost[0]
        : forwardedHost || req.headers.host;
      const hostName = typeof hostHeader === "string" ? hostHeader : "";
      if (hostName) {
        process.env.DYAD_PUBLIC_HOST = hostName.split(":")[0];
      }
    }

    if (process.env.DYAD_PUBLIC_PROTOCOL === "http") {
      const forwardedProto = req.headers["x-forwarded-proto"];
      const proto = Array.isArray(forwardedProto)
        ? forwardedProto[0]
        : forwardedProto;
      if (typeof proto === "string" && proto.length > 0) {
        process.env.DYAD_PUBLIC_PROTOCOL = proto.split(",")[0];
      }
    }

    const handler = ipcMain._getHandler(channel);
    if (!handler) {
      res.status(404).json({ ok: false, error: `No handler for ${channel}` });
      return;
    }

    const sender = {
      send: (ch, ...senderArgs) => {
        if (typeof clientId !== "string") return;
        publishToClient(clientId, { channel: ch, args: senderArgs });
      },
      isDestroyed: () => false,
    };

    globalThis.__dyad_last_sender = sender;

    const event = { sender };
    const result = await handler(event, ...(Array.isArray(args) ? args : []));

    res.status(200).json({ ok: true, result });
  } catch (error) {
    console.error("IPC invoke error:", error);
    res.status(500).json({
      ok: false,
      error: error?.message || String(error),
    });
  }
};
