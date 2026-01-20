import "tsconfig-paths/register";

import { subscribeToClient } from "../../src/server/event_bus";

export default async function handler(req: any, res: any) {
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

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  res.write(
    `data: ${JSON.stringify({ type: "connected", clientId })}\n\n`,
  );

  const sendEvent = (payload: { channel: string; args: unknown[] }) => {
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
}
