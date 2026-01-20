# Quick Start - Hosting Your Web App

Your Dyad app is now a fully functional web application with **zero Electron dependencies**. Here's how to get it running anywhere.

## Option 1: Vercel (30 seconds)

### Prerequisites
- GitHub account
- Vercel account (free at vercel.com)

### Steps
1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project"
4. Select your GitHub repository
5. Click "Deploy"

**Done!** Your app is now live at `project-name.vercel.app`

### Environment Variables
No special variables needed - the defaults work out of the box.

### Limitations
- WebSocket for events won't work (SSE fallback in place)
- File system is ephemeral (`/tmp`) - use database for persistence
- Cold starts: first request is slower (2-3 seconds)

---

## Option 2: Railway (2 minutes)

### Prerequisites
- GitHub account  
- Railway account (free at railway.app)

### Steps
1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub"
4. Choose your repository
5. Set build command: `npm run web:build`
6. Set start command: `npm run web:server`
7. Click "Deploy"

**Done!** Persistent Node.js server with WebSocket support!

### Environment Variables
```
DYAD_PUBLIC_HOST=<your-railway-domain>
DYAD_PUBLIC_PROTOCOL=https
NODE_ENV=production
```

### Advantages
- Real persistent Node.js server
- WebSocket works natively
- File system is persistent
- $5/month usage-based pricing

---

## Option 3: Linux Server (5 minutes)

### Prerequisites
- SSH access to a Linux server
- Node.js 20+ installed

### Steps

#### 1. Clone repository
```bash
git clone https://github.com/yourusername/dyad-web-fix.git
cd dyad-web-fix
npm install
```

#### 2. Build
```bash
npm run web:build
```

#### 3. Run (Development)
```bash
npm run web:server
# App runs on http://localhost:3000
```

#### 4. Run (Production with PM2)
```bash
npm install -g pm2
pm2 start "npm run web:server" --name "dyad"
pm2 save
pm2 startup
```

#### 5. Setup Reverse Proxy (NGINX)
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### 6. Enable HTTPS (Let's Encrypt)
```bash
certbot --nginx -d your-domain.com
```

**Done!** Full-featured web app with HTTPS!

---

## Option 4: Docker (Anywhere)

### Prerequisites
- Docker installed

### Build Docker image
```bash
# Create Dockerfile in project root (see template below)
docker build -t dyad-web .
```

### Run locally
```bash
docker run -p 3000:3000 dyad-web
```

### Deploy to cloud
Works with any Docker hosting:
- Railway Docker
- Render
- AWS ECS
- Google Cloud Run
- etc.

### Dockerfile Template
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Build frontend
COPY . .
RUN npm run web:build

# Expose port
EXPOSE 3000

# Start server
CMD ["npm", "run", "web:server"]
```

---

## Comparison Table

| Feature | Vercel | Railway | Linux | Docker |
|---------|--------|---------|-------|--------|
| Cost | Free | $5+/mo | $5+/mo | Varies |
| Setup Time | 1 min | 2 min | 5 min | 10 min |
| Persistent Storage | ❌ | ✅ | ✅ | ✅ |
| WebSocket Support | SSE only | ✅ | ✅ | ✅ |
| Cold Starts | ~2-3s | None | None | None |
| Scaling | Automatic | Easy | Manual | Easy |
| Downtime | Automatic | Manual | Manual | Manual |

---

## Testing Your Deployment

After deployment, test that everything works:

```bash
# Test if server is running
curl https://your-domain.com/

# Test IPC endpoint
curl -X POST https://your-domain.com/api/ipc/invoke \
  -H "Content-Type: application/json" \
  -d '{"channel":"app-version","args":[]}'

# Should return: {"ok":true,"result":"0.33.0"}
```

---

## Environment Variables Reference

### Minimal (Default)
```env
DYAD_WEB_MODE=true
```

### Recommended
```env
DYAD_WEB_MODE=true
NODE_ENV=production
DYAD_PUBLIC_HOST=your-domain.com
DYAD_PUBLIC_PROTOCOL=https
```

### Optional
```env
DYAD_PROXY_LISTEN_HOST=0.0.0.0
DYAD_USER_DATA_PATH=/tmp/dyad-data
```

---

## Troubleshooting

### "Port 3000 is already in use"
```bash
# Use different port
PORT=3001 npm run web:server

# Or kill the process
kill $(lsof -t -i:3000)
```

### "Cannot GET /"
- Make sure static files are in `dist/web/` folder
- Run `npm run web:build` first

### "IPC invoke fails with 404"
- Check that `api/ipc/invoke.ts` exists
- Verify deployment includes `api/` directory

### "WebSocket connection fails"
- Normal on Vercel (uses SSE fallback)
- Works fine on persistent platforms (Railway, self-hosted)

---

## Next Steps

1. **Domain**: Buy a custom domain and point it to your server
2. **Database**: Consider migrating to cloud database (Neon, Supabase) for persistence
3. **Monitoring**: Set up error tracking (Sentry) and analytics
4. **Backup**: Regular backups of `userData/` directory
5. **Updates**: Set up CI/CD for automatic deployments on git push

---

## Support

- **Vercel Issues**: Check [vercel.com/docs](https://vercel.com/docs)
- **Railway Issues**: Check [railway.app/docs](https://railway.app/docs)
- **Node.js Issues**: Check [nodejs.org/docs](https://nodejs.org/docs)
- **Project Issues**: Check `CONTRIBUTING.md` in repository

---

## Key Changes Made for Web Deployment

✅ Removed all Electron dependencies
✅ Created electron-stub for API compatibility
✅ Replaced electron-log with simple_logger
✅ Added Vercel API handlers
✅ Updated build configuration
✅ Enabled DYAD_WEB_MODE by default
✅ Full TypeScript support maintained
✅ All IPC communication through REST API

Your app is now **platform-agnostic** and runs on any Node.js environment!
