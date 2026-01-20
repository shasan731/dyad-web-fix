import { VercelRequest, VercelResponse } from '@vercel/node';
import { registerIpcHandlers } from '@/ipc/ipc_host';
import { initializeDatabase } from '@/db';
import { VALID_INVOKE_CHANNELS } from '@/ipc/ipc_channels';
import { cleanupOldAiMessagesJson } from '@/pro/main/ipc/handlers/local_agent/ai_messages_cleanup';
import { ipcMain } from 'electron';

// Initialize on cold start
let isInitialized = false;

function initializeOnce() {
  if (isInitialized) return;
  
  // Set required environment variables for web mode
  if (!process.env.DYAD_WEB_MODE) {
    process.env.DYAD_WEB_MODE = 'true';
  }
  if (!process.env.DYAD_PROXY_LISTEN_HOST) {
    process.env.DYAD_PROXY_LISTEN_HOST = '0.0.0.0';
  }
  if (!process.env.DYAD_PUBLIC_PROTOCOL) {
    process.env.DYAD_PUBLIC_PROTOCOL = 'https';
  }
  if (!process.env.DYAD_PUBLIC_HOST) {
    process.env.DYAD_PUBLIC_HOST = 'localhost';
  }

  try {
    initializeDatabase();
    cleanupOldAiMessagesJson();
    registerIpcHandlers();
    isInitialized = true;
  } catch (error) {
    console.error('Failed to initialize Dyad:', error);
  }
}

type Sender = {
  send: (channel: string, ...args: unknown[]) => void;
  isDestroyed: () => boolean;
};

function createSender(clientId: string | null): Sender {
  return {
    send: (channel: string, ...args: unknown[]) => {
      // In serverless, we can't send to a client socket
      // This is a limitation of the web deployment
      console.debug(`[IPC Sender] Would send to ${clientId}: ${channel}`, args);
    },
    isDestroyed: () => false,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    // Initialize on first request
    initializeOnce();

    const { channel, args, clientId } = req.body || {};
    
    if (!channel || typeof channel !== 'string') {
      res.status(400).json({ ok: false, error: 'Missing channel' });
      return;
    }

    // Update host/protocol from headers
    if (process.env.DYAD_PUBLIC_HOST === 'localhost') {
      const forwardedHost = req.headers['x-forwarded-host'];
      const hostHeader = Array.isArray(forwardedHost)
        ? forwardedHost[0]
        : forwardedHost || req.headers.host;
      const hostName = typeof hostHeader === 'string' ? hostHeader : '';
      if (hostName) {
        process.env.DYAD_PUBLIC_HOST = hostName.split(':')[0];
      }
    }
    
    if (process.env.DYAD_PUBLIC_PROTOCOL === 'http') {
      const forwardedProto = req.headers['x-forwarded-proto'];
      const proto = Array.isArray(forwardedProto)
        ? forwardedProto[0]
        : forwardedProto;
      if (typeof proto === 'string' && proto.length > 0) {
        process.env.DYAD_PUBLIC_PROTOCOL = proto.split(',')[0];
      }
    }

    const invokeChannel = channel as (typeof VALID_INVOKE_CHANNELS)[number];
    if (!VALID_INVOKE_CHANNELS.includes(invokeChannel)) {
      res.status(400).json({ ok: false, error: `Invalid channel: ${channel}` });
      return;
    }

    const sender = createSender(typeof clientId === 'string' ? clientId : null);
    // @ts-ignore - used by electron stub for broadcast fallback
    globalThis.__dyad_last_sender = sender;

    const handler = (ipcMain as any)._getHandler(invokeChannel);
    if (!handler) {
      res.status(404).json({ ok: false, error: `No handler for ${channel}` });
      return;
    }

    const event = { sender } as any;
    const result = await handler(event, ...(Array.isArray(args) ? args : []));
    res.status(200).json({ ok: true, result });
  } catch (error: any) {
    console.error('IPC invoke error:', error);
    res.status(500).json({
      ok: false,
      error: error?.message || String(error),
    });
  }
}
