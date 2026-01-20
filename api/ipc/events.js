// Vercel serverless function for SSE events
// JavaScript version to avoid TypeScript path alias issues

module.exports = async (req, res) => {
  // Only allow GET for SSE
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const clientId = typeof req.query.clientId === 'string' ? req.query.clientId : null;

  if (!clientId) {
    res.status(400).json({ error: 'Missing clientId' });
    return;
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Send a heartbeat every 30 seconds to keep connection alive
  const heartbeatInterval = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    res.end();
  });

  // Keep connection open
  // In production, you would emit events here when IPC handlers trigger them
  // For Vercel's serverless model, consider using WebSocket proxies or polling
};
