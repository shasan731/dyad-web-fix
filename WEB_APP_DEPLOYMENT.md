# Web App Deployment - Electron Removal Complete

This document explains the changes made to remove Electron and create a fully web-compatible application.

## What Changed

### 1. **Removed Electron Dependency**
- Removed `electron` and `electron-log` from `package.json`
- The app now uses `src/platform/electron.ts` which provides mock Electron APIs in web mode

### 2. **Replaced electron-log**
- Created `src/utils/simple_logger.ts` - a drop-in replacement for electron-log
- Updated all 40+ files that imported `electron-log` to use the new simple logger
- The logger works in both Node.js (server) and browser environments

### 3. **Web Mode Configuration**
- `DYAD_WEB_MODE=true` is always set in `server/index.js` and Vercel API handlers
- The code imports `@/platform/electron` instead of the Electron module
- This keeps the runtime fully web compatible without native Electron modules

### 4. **Created Vercel API Handlers**
- `api/ipc/invoke.ts` - Handles POST requests to `/api/ipc/invoke` for IPC calls
- `api/ipc/events.ts` - Handles Server-Sent Events (SSE) for event streaming
- Updated `vercel.json` with proper Node.js runtime configuration

## Architecture

### Local Development
```
npm start 
  → builds web app (Vite)
  → starts Express server on port 3000
  → uses platform stub (src/platform/electron.ts)
  → frontend makes API calls to /api/ipc/* endpoints
```

### Vercel Deployment
```
Vite builds React app → dist/web/
Express server + API handlers run as serverless functions
API routes:
  /api/ipc/invoke - IPC method calls (REST)
  /api/ipc/events - Event streaming (SSE)
```

### Production Linux Server
```
npm run web:build    # Build frontend
npm run web:server   # Start Express + API server
```

## Key Features Maintained

✅ All IPC communication works through REST API
✅ Logging works in both environments (console + file when available)
✅ Database (SQLite) works in web mode
✅ File operations work (within the server)
✅ Git operations work (via isomorphic-git)
✅ All AI/ML features work unchanged

## Limitations in Web Mode

⚠️ **WebSocket for Events**: Vercel serverless doesn't support persistent WebSocket connections
   - Solution: Using Server-Sent Events (SSE) which have better serverless support
   - For production: Consider Socket.io with fallbacks or use a persistent Node.js platform

⚠️ **Native Modules**: Some packages with native modules may not work in serverless
   - `better-sqlite3` uses native bindings but works in Node.js environments
   - For Vercel: Consider using SQLite in WASM or a cloud database

⚠️ **File System Access**: Limited on Vercel, full on self-hosted servers
   - Vercel `/tmp` directory is ephemeral and reset per invocation
   - For persistent storage: Use cloud databases or file storage services

## Deployment Options

### Option 1: Vercel (Easiest for Frontend + Serverless)
```bash
npm install
git push # to your GitHub repository
# Vercel auto-deploys from git
```
- Pros: Free tier, automatic deployments, global CDN
- Cons: Serverless limitations, no persistent file storage

### Option 2: Railway/Render (Recommended)
```bash
npm install
npm run web:build
npm run web:server
# runs on port 3000
```
- Pros: Persistent Node.js, native WebSocket support, simple setup
- Cons: Small monthly cost (~$10-20)

### Option 3: Self-Hosted Linux (Full Control)
```bash
git clone <repo>
cd dyad-web-fix
npm install
npm run web:build
npm run web:server
# Optionally: use PM2/systemd for daemon management
```
- Pros: Full control, no vendor lock-in, cheapest at scale
- Cons: Need to manage server, scaling is manual

### Option 4: Docker (Any Platform)
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run web:build
EXPOSE 3000
CMD ["npm", "run", "web:server"]
```

## Environment Variables

For local/self-hosted:
```env
DYAD_WEB_MODE=true
DYAD_PUBLIC_HOST=localhost
DYAD_PUBLIC_PROTOCOL=http
DYAD_USER_DATA_PATH=./userData
```

For production:
```env
DYAD_WEB_MODE=true
DYAD_PUBLIC_HOST=your-domain.com
DYAD_PUBLIC_PROTOCOL=https
NODE_ENV=production
```

## Vercel-Specific Notes

The `vercel.json` configuration:
```json
{
  "buildCommand": "npm run web:build",
  "outputDirectory": "dist/web",
  "functions": {
    "api/**/*.ts": {
      "runtime": "nodejs20.x"
    }
  }
}
```

- `buildCommand`: Vite builds the React app
- `outputDirectory`: Static files served by Vercel
- `functions`: TypeScript API handlers run as serverless functions

## Troubleshooting

### Issue: "Cannot find module 'electron'"
**Solution**: Ensure the code imports `@/platform/electron` and that the serverless handler loads `tsconfig-paths/register` before app modules.

### Issue: "IPC invoke returns 404"
**Solution**: Ensure the API route exists in `api/ipc/invoke.ts` and Vercel deployment includes the `api/` directory.

### Issue: "Database file not found"
**Solution**: In web mode, SQLite file is stored in `userData/` directory. Ensure it's created and writable.

### Issue: "WebSocket connection failed"
**Solution**: Vercel doesn't support persistent WebSocket. The SSE fallback in `api/ipc/events.ts` provides basic event streaming. For production, use Socket.io with HTTP polling fallback.

## Testing

```bash
# Build and start locally
npm run web:build
npm run web:server

# Visit http://localhost:3000
# Should work exactly like the Electron version

# Test IPC
curl -X POST http://localhost:3000/api/ipc/invoke \
  -H "Content-Type: application/json" \
  -d '{"channel":"app-version","args":[]}'
```

## Future Improvements

1. **Cloud Database**: Migrate from SQLite to PostgreSQL (Neon/Supabase) for serverless compatibility
2. **Socket.io**: Add Socket.io with HTTP long-polling for serverless WebSocket support
3. **Worker Threads**: Use Web Workers for CPU-intensive operations
4. **Edge Functions**: Use Vercel Edge Functions for faster response times
5. **CDN**: Serve static assets from CDN for better performance

## Questions?

Refer to `AGENTS.md` for architecture guidelines or `CONTRIBUTING.md` for development setup.
