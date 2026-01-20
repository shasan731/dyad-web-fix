import { VercelRequest, VercelResponse } from '@vercel/node';

// This handler is for the root /api/ endpoint
// Specific routes like /api/ipc/invoke are handled by their respective files in the api/ directory
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.status(404).json({
    error: 'Not Found',
    message: 'API endpoint not found. Use /api/ipc/invoke for IPC requests.',
  });
}
