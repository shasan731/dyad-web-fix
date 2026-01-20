import express from "express";
import http from "node:http";
import path from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import { registerIpcHandlers } from "@/ipc/ipc_host";
import { initializeDatabase } from "@/db";
import { VALID_INVOKE_CHANNELS } from "@/ipc/ipc_channels";
import { cleanupOldAiMessagesJson } from "@/pro/main/ipc/handlers/local_agent/ai_messages_cleanup";
import { ipcMain } from "electron";

type Sender = {
  send: (channel: string, ...args: unknown[]) => void;
  isDestroyed: () => boolean;
};

if (!process.env.DYAD_PROXY_LISTEN_HOST) {
  process.env.DYAD_PROXY_LISTEN_HOST = "0.0.0.0";
}
if (!process.env.DYAD_PUBLIC_PROTOCOL) {
  process.env.DYAD_PUBLIC_PROTOCOL = "http";
}
if (!process.env.DYAD_PUBLIC_HOST) {
  process.env.DYAD_PUBLIC_HOST = "localhost";
}

if (process.env.DYAD_DOCKER_HOST) {
  process.env.DOCKER_HOST = process.env.DYAD_DOCKER_HOST;
}

if (
  process.platform !== "win32" &&
  process.env.DOCKER_HOST &&
  process.env.DOCKER_HOST.includes("pipe")
) {
  delete process.env.DOCKER_HOST;
}

const clientSockets = new Map<string, WebSocket>();

function getClientId(requestUrl: string | undefined): string | null {
  if (!requestUrl) return null;
  try {
    const url = new URL(requestUrl, "http://localhost");
    return url.searchParams.get("clientId");
  } catch {
    return null;
  }
}

function createSender(clientId: string | null): Sender {
  if (!clientId) {
    return {
      send: () => {},
      isDestroyed: () => true,
    };
  }
  const socket = clientSockets.get(clientId);
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return {
      send: () => {},
      isDestroyed: () => true,
    };
  }
  return {
    send: (channel, ...args) => {
      if (socket.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify({ channel, args }));
    },
    isDestroyed: () => socket.readyState !== WebSocket.OPEN,
  };
}

function broadcast(channel: string, ...args: unknown[]) {
  const payload = JSON.stringify({ channel, args });
  for (const socket of clientSockets.values()) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    }
  }
}

// Provide a broadcast hook for telemetry and other main-process events.
// @ts-ignore - global injection for electron stub
globalThis.__dyad_broadcast = broadcast;

async function main() {
  initializeDatabase();
  cleanupOldAiMessagesJson();
  registerIpcHandlers();

  const app = express();
  app.use(express.json({ limit: "200mb" }));

  app.post("/api/ipc/invoke", async (req, res) => {
    const { channel, args, clientId } = req.body || {};
    if (!channel || typeof channel !== "string") {
      res.status(400).json({ ok: false, error: "Missing channel" });
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
    const invokeChannel = channel as (typeof VALID_INVOKE_CHANNELS)[number];
    if (!VALID_INVOKE_CHANNELS.includes(invokeChannel)) {
      res.status(400).json({ ok: false, error: `Invalid channel: ${channel}` });
      return;
    }

    const sender = createSender(typeof clientId === "string" ? clientId : null);
    // @ts-ignore - used by electron stub for broadcast fallback
    globalThis.__dyad_last_sender = sender;

    try {
      const handler = (ipcMain as any)._getHandler(invokeChannel);
      if (!handler) {
        res
          .status(404)
          .json({ ok: false, error: `No handler for ${channel}` });
        return;
      }
      const event = { sender } as any;
      const result = await handler(event, ...(Array.isArray(args) ? args : []));
      res.json({ ok: true, result });
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: error?.message || String(error),
      });
    }
  });

  const distDir =
    process.env.DYAD_WEB_DIST || path.join(process.cwd(), "dist", "web");
  const indexPath = path.join(distDir, "index.html");
  app.use(express.static(distDir));
  app.get("*", (_req, res) => {
    res.sendFile(indexPath);
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: "/api/ipc/events" });
  wss.on("connection", (socket, request) => {
    const clientId = getClientId(request.url || undefined);
    if (clientId) {
      clientSockets.set(clientId, socket);
    }
    socket.on("close", () => {
      if (clientId) {
        clientSockets.delete(clientId);
      }
    });
  });

  const port = Number(process.env.DYAD_WEB_PORT || 4000);
  const host = process.env.DYAD_WEB_HOST || "0.0.0.0";
  server.listen(port, host, () => {
    console.log(`[dyad-web] server listening on http://${host}:${port}`);
  });
}

main().catch((error) => {
  console.error("Failed to start Dyad web server:", error);
  process.exit(1);
});
