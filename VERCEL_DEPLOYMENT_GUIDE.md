# Vercel Deployment Issues - Solutions

## Problem Summary

Your Dyad app is getting **404 errors on `/api/ipc/invoke`** when deployed to Vercel because:

1. **Missing API Handler**: Vercel doesn't automatically run `src/server/index.ts`. You need explicit serverless function handlers.
2. **WebSocket Limitation**: Vercel Serverless Functions have strict limitations that prevent long-lived WebSocket connections needed for IPC events.
3. **Cold Starts & Timeouts**: Vercel functions have a 10-60 second timeout and are stateless, making database initialization on every request problematic.

## What I've Fixed

I've created:
- **`api/ipc/invoke.ts`** - A Vercel serverless function that handles POST `/api/ipc/invoke` requests
- **Updated `vercel.json`** - Set Vercel v2 config for the web build output

This handles the initial 404 error for the invoke endpoint.

## Remaining Issues

### Issue 1: WebSocket Events Not Working

The app uses WebSocket (`/api/ipc/events`) for real-time event streaming, which **cannot work on Vercel Serverless**:

```typescript
// From src/ipc/web_ipc_renderer.ts
const wsUrl = url.toString().replace(/^http/, "ws");
const socket = new WebSocket(wsUrl);
```

**Solutions:**

#### Option A: Use Vercel + External Socket Server (Recommended for Quick Fix)
Run a separate WebSocket server (e.g., Railway, Render, or self-hosted) and configure the app to connect to it:

```typescript
// In your env or config
VITE_IPC_WS_URL=wss://your-socket-server.com/ws
```

#### Option B: Migrate to a Non-Serverless Platform
Deploy to platforms that support persistent connections:
- **Railway.app** - $10/month minimum, auto-deploys from git, supports Node.js
- **Render.com** - Supports WebSockets natively
- **Heroku** (paid plans) - Traditional Node.js hosting
- **Self-hosted VPS** - Full control

#### Option C: Rewrite to Use HTTP Polling (Not Recommended)
Replace WebSocket with polling, but this is:
- Less efficient
- More expensive (more requests)
- Slower real-time responsiveness

### Issue 2: Database Initialization on Every Request

Currently, the Vercel handler initializes SQLite on each request:

```typescript
initializeOnce() {
  initializeDatabase();
  registerIpcHandlers();
  // ...
}
```

**Problems:**
- SQLite might not have persistent storage on Vercel
- Cold starts add ~1-2 seconds per request
- Not suitable for heavy workloads

**Solutions:**

#### Use a Cloud Database Instead
Replace SQLite with a cloud database:

```typescript
// Instead of SQLite
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);
const db = drizzle(sql);
```

Recommended cloud databases:
- **Neon (PostgreSQL)** - Free tier available, serverless
- **Supabase (PostgreSQL)** - Already in your stack
- **Turso (SQLite)** - SQLite in the cloud with replication

## Recommended Deployment Strategy

### For Development/Testing:
1. **Keep current setup** - Use your local server for testing
2. **Use Railway or Render** for simple Node.js hosting
   - Deploy the entire app as a single Node.js application
   - Don't use Vercel's serverless architecture

### Step-by-Step for Railway:

```bash
# 1. Create Railway account at railway.app
# 2. Connect your GitHub repo
# 3. Add PostgreSQL or MySQL service
# 4. Set environment variables:
#    - DATABASE_URL=your_db_connection
#    - NODE_ENV=production
# 5. Deploy!

# Your app will run as: npm start
```

### Step-by-Step for Vercel + External Services:

If you want to keep using Vercel:

1. **Keep the API handler I created** - It now handles `/api/ipc/invoke`
2. **Migrate to a cloud database** - Replace SQLite
3. **Deploy WebSocket server separately** - Use Railway/Render
4. **Update environment variables** in Vercel dashboard to point to your external services

## Files I've Modified

1. **`api/ipc/invoke.ts`** (NEW)
   - Serverless function handler for POST /api/ipc/invoke
   - Initializes database and handlers on cold start
   - Currently uses SQLite (needs migration for production)

2. **`vercel.json`** (UPDATED)
   - Uses Vercel v2 config
   - Points static output to `dist/web`

## Testing Locally

Your local setup works because:
1. `npm run web:server` runs `src/server/index.ts` as a persistent Express server
2. WebSocket connections are maintained for the session
3. SQLite file is persistent on disk

This is the correct setup for development.

## Next Steps

Choose one of these approaches:

1. **Fastest Fix** (for testing): Deploy to Railway/Render instead of Vercel
2. **Keep Vercel** (advanced): Migrate to cloud database + external WebSocket server
3. **Production Ready** (long-term): Restructure as microservices with proper scaling

Need help implementing any of these? Let me know which approach you'd like to take!
