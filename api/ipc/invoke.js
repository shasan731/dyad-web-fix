// This is a Vercel serverless function handler
// It handles POST requests to /api/ipc/invoke
// Note: This file is in JavaScript to avoid TypeScript path alias issues in Vercel

module.exports = async (req, res) => {
  // Set up electron stub before any src imports
  const Module = require('module');
  const path = require('path');
  const originalLoad = Module._load;
  const stubPath = path.join(__dirname, '../../server/electron_stub.js');

  Module._load = function (request, parent, isMain) {
    if (request === 'electron') {
      return originalLoad(stubPath, parent, isMain);
    }
    return originalLoad(request, parent, isMain);
  };

  // Set environment for web mode
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

  // Only accept POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    // Dynamically require the modules (so electron stub is loaded first)
    const { registerIpcHandlers } = await import('../../../src/ipc/ipc_host.js');
    const { initializeDatabase } = await import('../../../src/db/index.js');
    const { VALID_INVOKE_CHANNELS } = await import('../../../src/ipc/ipc_channels.js');
    const { cleanupOldAiMessagesJson } = await import('../../../src/pro/main/ipc/handlers/local_agent/ai_messages_cleanup.js');
    const { ipcMain } = await import('electron');

    // Initialize database and handlers (only once)
    if (!process.env.DYAD_INITIALIZED) {
      try {
        initializeDatabase();
        cleanupOldAiMessagesJson();
        registerIpcHandlers();
        process.env.DYAD_INITIALIZED = 'true';
      } catch (error) {
        console.error('Failed to initialize Dyad:', error);
      }
    }

    const { channel, args, clientId } = req.body || {};

    if (!channel || typeof channel !== 'string') {
      res.status(400).json({ ok: false, error: 'Missing channel' });
      return;
    }

    if (!VALID_INVOKE_CHANNELS.includes(channel)) {
      res.status(400).json({ ok: false, error: `Invalid channel: ${channel}` });
      return;
    }

    // Update host/protocol from headers if needed
    if (process.env.DYAD_PUBLIC_HOST === 'localhost') {
      const forwardedHost = req.headers['x-forwarded-host'];
      const hostHeader = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost || req.headers.host;
      const hostName = typeof hostHeader === 'string' ? hostHeader : '';
      if (hostName) {
        process.env.DYAD_PUBLIC_HOST = hostName.split(':')[0];
      }
    }

    if (process.env.DYAD_PUBLIC_PROTOCOL === 'http') {
      const forwardedProto = req.headers['x-forwarded-proto'];
      const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
      if (typeof proto === 'string' && proto.length > 0) {
        process.env.DYAD_PUBLIC_PROTOCOL = proto.split(',')[0];
      }
    }

    // Get the handler for this channel
    const handler = ipcMain._getHandler(channel);
    if (!handler) {
      res.status(404).json({ ok: false, error: `No handler for ${channel}` });
      return;
    }

    // Create a sender object
    const sender = {
      send: (ch, ...args) => {
        console.debug(`[IPC Sender] Would send to ${clientId}: ${ch}`, args);
      },
      isDestroyed: () => false,
    };

    // Set global sender for broadcast fallback
    globalThis.__dyad_last_sender = sender;

    // Call the handler
    const event = { sender };
    const result = await handler(event, ...(Array.isArray(args) ? args : []));
    
    res.status(200).json({ ok: true, result });
  } catch (error) {
    console.error('IPC invoke error:', error);
    res.status(500).json({
      ok: false,
      error: error?.message || String(error),
    });
  }
};
