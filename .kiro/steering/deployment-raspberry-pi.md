# Raspberry Pi Deployment Best Practices

## Critical Lessons Learned

### Issue 1: TypeScript Build Errors with Test Files

**Problem:** Test files cause TypeScript compilation errors on Raspberry Pi because they use DOM types and have type mismatches.

**Solution:**
- Remove test files before building: `find src -name "*.test.ts" -type f -delete`
- Remove e2e directory: `find src -type d -name "e2e" -exec rm -rf {} +`
- Or use `npx vite build` directly (skips tsc for frontend)

**Why it happened:** Test files were included in the production build on Pi but excluded on Windows during development.

---

### Issue 2: NODE_ENV Must Be Set to Production

**Problem:** Backend serves frontend files only when `NODE_ENV=production`.

**Solution:**
- Always set `NODE_ENV=production` in `.env` file
- Verify with: `grep NODE_ENV ~/spa-kiosk/backend/.env`

**Why it happened:** Development used separate frontend server (port 3000), production serves from backend (port 3001).

---

### Issue 3: Port Configuration Changed

**Problem:** Frontend moved from port 3000 to 3001 (served by backend in production).

**Solution:**
- Kiosk script must use `http://localhost:3001` not `http://localhost:3000`
- Backend serves frontend on same port (3001)
- No CORS issues because same-origin

**Why it happened:** Production architecture differs from development (single server vs two servers).

---

### Issue 4: Permission Issues with node_modules

**Problem:** Copied node_modules from Windows had permission issues on Linux.

**Solution:**
- Never copy node_modules - always run `npm install` on target system
- If permission errors occur: `sudo rm -rf node_modules && npm install`
- Set proper ownership: `sudo chown -R $USER:$USER ~/spa-kiosk`

**Why it happened:** Windows and Linux have different file permission systems.

---

### Issue 5: FRONTEND_URL Hardcoded

**Problem:** `.env` had hardcoded IP address that wouldn't work on other networks.

**Solution:**
- Remove `FRONTEND_URL` from production `.env` (not needed for same-origin)
- CORS automatically allows requests with no origin header (same-origin)
- Use relative URLs in frontend (`/api` not `http://...`)

**Why it happened:** Development needed explicit CORS configuration, production doesn't.

---

## Correct Deployment Process

### 1. Prepare Files
```bash
# On development machine
# Exclude: node_modules, dist, .git, logs, test files
tar -czf spa-kiosk.tar.gz \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.git' \
  --exclude='logs' \
  --exclude='*.log' \
  backend/ frontend/ package.json deployment/ data/ public/
```

### 2. Transfer to Pi
```bash
scp spa-kiosk.tar.gz user@pi-ip:~/
ssh user@pi-ip "cd ~ && tar -xzf spa-kiosk.tar.gz"
```

### 3. Install Dependencies
```bash
ssh user@pi-ip << 'EOF'
cd ~/spa-kiosk

# Install Node.js 20 if needed
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install project dependencies
npm install
cd backend && npm install
cd ../frontend && npm install
EOF
```

### 4. Build Application
```bash
ssh user@pi-ip << 'EOF'
cd ~/spa-kiosk/backend

# Remove test files
find src -name "*.test.ts" -delete
find src -type d -name "e2e" -exec rm -rf {} + 2>/dev/null || true

# Create production .env
cat > .env << 'ENVEOF'
PORT=3001
NODE_ENV=production
DATABASE_PATH=./data/kiosk.db
SESSION_SECRET=$(openssl rand -base64 32)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
MAX_VIDEO_SIZE=52428800
MAX_IMAGE_SIZE=5242880
ENVEOF

# Build backend
npm run build

# Build frontend
cd ../frontend
npx vite build

# Copy to backend public
rm -rf ../backend/public
cp -r dist ../backend/public
EOF
```

### 5. Start Services
```bash
ssh user@pi-ip << 'EOF'
cd ~/spa-kiosk/backend

# Start with PM2
pm2 start npm --name kiosk-backend -- run start
pm2 save
pm2 startup systemd -u $USER --hp $HOME
EOF
```

### 6. Setup Kiosk Autostart
```bash
ssh user@pi-ip << 'EOF'
# Create kiosk script
cat > ~/start-kiosk.sh << 'KIOSK'
#!/bin/bash
sleep 10
xset s off -dpms s noblank
unclutter -idle 0.1 -root &
while ! curl -s http://localhost:3001/api/kiosk/health > /dev/null; do
    sleep 2
done
chromium --kiosk --noerrdialogs --no-first-run http://localhost:3001
KIOSK
chmod +x ~/start-kiosk.sh

# Create autostart
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/kiosk.desktop << 'DESKTOP'
[Desktop Entry]
Type=Application
Name=Kiosk
Exec=/home/$USER/start-kiosk.sh
X-GNOME-Autostart-enabled=true
DESKTOP
EOF
```

---

## Environment Configuration

### Production .env Template
```env
# Server Configuration
PORT=3001
NODE_ENV=production

# Database
DATABASE_PATH=./data/kiosk.db

# Session (generate with: openssl rand -base64 32)
SESSION_SECRET=<random-secret-here>

# Admin Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<change-this>

# File Upload
MAX_VIDEO_SIZE=52428800
MAX_IMAGE_SIZE=5242880
```

### What NOT to include:
- ❌ `FRONTEND_URL` - Not needed in production (same-origin)
- ❌ Hardcoded IP addresses
- ❌ Development-specific settings

---

## Verification Checklist

After deployment, verify:

```bash
# 1. Check PM2 status
pm2 status
# Should show: kiosk-backend | online

# 2. Check backend health
curl http://localhost:3001/api/kiosk/health
# Should return: {"status":"ok","timestamp":"..."}

# 3. Check frontend is served
curl -I http://localhost:3001
# Should return: 200 OK

# 4. Check .env settings
grep NODE_ENV ~/spa-kiosk/backend/.env
# Should show: NODE_ENV=production

# 5. Check kiosk script
grep localhost:3001 ~/start-kiosk.sh
# Should show: http://localhost:3001 (not 3000)

# 6. Test from network
# From another device: http://<pi-ip>:3001
```

---

## Common Errors and Solutions

### Error: "routeNotFound"
**Cause:** `NODE_ENV` not set to production  
**Fix:** Set `NODE_ENV=production` in `.env` and restart PM2

### Error: "Cannot find module"
**Cause:** Dependencies not installed or build failed  
**Fix:** Run `npm install` and `npm run build` again

### Error: "EACCES: permission denied"
**Cause:** File permission issues  
**Fix:** `sudo chown -R $USER:$USER ~/spa-kiosk`

### Error: "Port 3001 already in use"
**Cause:** Another process using the port  
**Fix:** `sudo lsof -ti:3001 | xargs kill -9`

### Error: TypeScript compilation errors
**Cause:** Test files included in build  
**Fix:** Remove test files before building

### Error: White screen in browser
**Cause:** Multiple possible causes  
**Fix:** Check browser console (F12), verify NODE_ENV=production, check PM2 logs

---

## Update Process

To update the application:

```bash
# 1. Stop backend
pm2 stop kiosk-backend

# 2. Backup database
cp ~/spa-kiosk/data/kiosk.db ~/spa-kiosk/data/kiosk.db.backup

# 3. Transfer new files (excluding node_modules)
# ... transfer process ...

# 4. Rebuild
cd ~/spa-kiosk/backend
find src -name "*.test.ts" -delete
npm run build

cd ../frontend
npx vite build
rm -rf ../backend/public
cp -r dist ../backend/public

# 5. Restart
pm2 restart kiosk-backend
```

---

## Network Portability

The application is network-independent:
- ✅ Uses relative URLs (`/api`)
- ✅ No hardcoded IPs
- ✅ Same-origin serving (no CORS issues)
- ✅ Kiosk uses `localhost`

Works on any network without changes!

---

## Status: ✅ Tested and Working

## Database Seeding

The database automatically seeds initial data on first run:
- Survey templates (Turkish)
- System settings
- Service settings (WhatsApp, Instagram)
- **26 Knowledge base entries** (Turkish content for AI workflows)

No manual seeding required. The seed script is idempotent.

---

Last deployment: 2025-12-05  
Platform: Raspberry Pi 5, Debian 13 (Trixie)  
Node.js: 20.19.6  
Status: Production-ready
