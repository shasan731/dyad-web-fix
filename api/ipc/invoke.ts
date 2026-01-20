import "tsconfig-paths/register";

import { initializeDatabase } from "../../src/db";
import { VALID_INVOKE_CHANNELS } from "../../src/ipc/ipc_channels";
import { registerIpcHandlers } from "../../src/ipc/ipc_host";
import { ipcMain } from "../../src/platform/electron";
import { cleanupOldAiMessagesJson } from "../../src/pro/main/ipc/handlers/local_agent/ai_messages_cleanup";
import { broadcast, publishToClient } from "../../src/server/event_bus";

type InvokePayload = {
  channel?: string;
  args?: unknown[];
  clientId?: string;
};

export default async function handler(req: any, res: any) {
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
    if (!(globalThis as any).__dyad_initialized) {
      initializeDatabase();
      cleanupOldAiMessagesJson();
      registerIpcHandlers();
      (globalThis as any).__dyad_initialized = true;
    }

    if (!(globalThis as any).__dyad_broadcast) {
      (globalThis as any).__dyad_broadcast = (channel: string, ...args: unknown[]) =>
        broadcast({ channel, args });
    }

    const parsedBody =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { channel, args, clientId } = (parsedBody || {}) as InvokePayload;

    if (!channel || typeof channel !== "string") {
      res.status(400).json({ ok: false, error: "Missing channel" });
      return;
    }

    if (!VALID_INVOKE_CHANNELS.includes(channel as any)) {
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

    const handler = (ipcMain as any)._getHandler(channel);
    if (!handler) {
      res.status(404).json({ ok: false, error: `No handler for ${channel}` });
      return;
    }

    const sender = {
      send: (ch: string, ...senderArgs: unknown[]) => {
        if (typeof clientId !== "string") return;
        publishToClient(clientId, { channel: ch, args: senderArgs });
      },
      isDestroyed: () => false,
    };

    (globalThis as any).__dyad_last_sender = sender;

    const event = { sender };
    const result = await handler(event, ...(Array.isArray(args) ? args : []));

    res.status(200).json({ ok: true, result });
  } catch (error: any) {
    console.error("IPC invoke error:", error);
    res.status(500).json({
      ok: false,
      error: error?.message || String(error),
    });
  }
}
