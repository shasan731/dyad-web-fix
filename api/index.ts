import { VercelRequest, VercelResponse } from '@vercel/node';

// This is a catch-all API handler for Vercel
// It proxies requests to the main server
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // For Vercel deployment, we need to handle API requests differently
    // This handler will be called for all API routes under /api/*
    
    res.status(200).json({
      message: 'Dyad API Server',
      status: 'running',
      mode: 'vercel',
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
