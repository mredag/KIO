# n8n Deployment Guide for Raspberry Pi

Complete guide for deploying n8n workflow automation for the WhatsApp coupon system on Raspberry Pi.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Manual Installation](#manual-installation)
4. [Configuration](#configuration)
5. [Workflow Import](#workflow-import)
6. [Testing](#testing)
7. [Monitoring](#monitoring)
8. [Troubleshooting](#troubleshooting)
9. [Maintenance](#maintenance)

---

## Prerequisites

### Hardware
- Raspberry Pi 4 or 5 (2GB+ RAM recommended)
- 16GB+ SD card
- Stable internet connection
- Static IP or DDNS (for webhook access)

### Software
- Raspberry Pi OS (Bookworm or later)
- Node.js 18+ (20.x recommended)
- npm 9+
- sudo access

### Network
- Port 5678 accessible (for n8n)
- Port 80/443 accessible (for webhooks via reverse proxy)
- Domain name with DNS A record pointing to your server

### External Services
- WhatsApp Business API account (Meta Cloud API)
- Backend API running and accessible
- Valid SSL certificate (Let's Encrypt recommended)

---

## Quick Start

### Automated Deployment

The fastest way to deploy n8n:

```bash
# Navigate to deployment directory
cd n8n-workflows/deployment

# Run deployment script
sudo ./deploy-n8n.sh
```

The script will:
1. ✅ Create n8n user and directories
2. ✅ Install n8n globally
3. ✅ Configure systemd service
4. ✅ Setup reverse proxy (nginx or Caddy)
5. ✅ Start and enable service
6. ✅ Test webhook endpoint

**Follow the prompts** to configure:
- n8n admin password
- Public webhook URL
- Reverse proxy choice (nginx/Caddy)
- Domain name

---

## Manual Installation

If you prefer manual installation or the script fails:

### Step 1: Install Node.js

```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node -v  # Should be v20.x.x
npm -v   # Should be 9.x.x or higher
```

### Step 2: Create n8n User

```bash
# Create dedicated user for n8n
sudo useradd -m -s /bin/bash n8n

# Create directories
sudo mkdir -p /var/lib/n8n/logs
sudo chown -R n8n:n8n /var/lib/n8n
```

### Step 3: Install n8n

```bash
# Install n8n globally
sudo npm install -g n8n

# Verify installation
n8n --version
```

### Step 4: Configure systemd Service

```bash
# Copy service file
sudo cp n8n.service /etc/systemd/system/

# Edit service file
sudo nano /etc/systemd/system/n8n.service
```

**Important**: Change these values in the service file:
- `N8N_BASIC_AUTH_PASSWORD`: Set a strong password
- `WEBHOOK_URL`: Set to your public HTTPS domain

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service
sudo systemctl enable n8n

# Start service
sudo systemctl start n8n

# Check status
sudo systemctl status n8n
```

### Step 5: Configure Reverse Proxy

Choose either nginx or Caddy:

#### Option A: nginx

```bash
# Install nginx and certbot
sudo apt-get install -y nginx certbot python3-certbot-nginx

# Copy nginx config
sudo cp nginx-n8n.conf /etc/nginx/sites-available/n8n

# Edit config to set your domain
sudo nano /etc/nginx/sites-available/n8n
# Replace n8n.yourdomain.com with your actual domain

# Enable site
sudo ln -s /etc/nginx/sites-available/n8n /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx

# Obtain SSL certificate
sudo certbot --nginx -d n8n.yourdomain.com

# Verify auto-renewal
sudo certbot renew --dry-run
```

#### Option B: Caddy (Simpler, Automatic HTTPS)

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy

# Copy Caddy config
sudo cp Caddyfile-n8n /etc/caddy/Caddyfile

# Edit config to set your domain
sudo nano /etc/caddy/Caddyfile
# Replace n8n.yourdomain.com with your actual domain

# Reload Caddy (automatically obtains SSL certificate)
sudo systemctl reload caddy

# Check status
sudo systemctl status caddy
```

---

## Configuration

### Environment Variables

The systemd service file configures n8n with these environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | production | Node environment |
| `N8N_PORT` | 5678 | n8n HTTP port |
| `N8N_PROTOCOL` | http | Protocol (http behind reverse proxy) |
| `N8N_HOST` | localhost | Bind address |
| `WEBHOOK_URL` | https://yourdomain.com | Public webhook URL |
| `GENERIC_TIMEZONE` | Europe/Istanbul | Timezone for workflows |
| `TZ` | Europe/Istanbul | System timezone |
| `N8N_BASIC_AUTH_ACTIVE` | true | Enable basic auth |
| `N8N_BASIC_AUTH_USER` | admin | Admin username |
| `N8N_BASIC_AUTH_PASSWORD` | changeme | Admin password (CHANGE THIS!) |
| `N8N_LOG_LEVEL` | info | Log level (error, warn, info, debug) |
| `N8N_LOG_OUTPUT` | file | Log output (console, file) |
| `N8N_LOG_FILE_LOCATION` | /var/lib/n8n/logs/ | Log directory |
| `N8N_USER_FOLDER` | /var/lib/n8n | n8n data directory |

### Security Hardening

The systemd service includes security features:

- ✅ Runs as dedicated `n8n` user (not root)
- ✅ `NoNewPrivileges=true` - Prevents privilege escalation
- ✅ `PrivateTmp=true` - Isolated /tmp directory
- ✅ `ProtectSystem=strict` - Read-only system directories
- ✅ `ProtectHome=true` - No access to home directories
- ✅ `ReadWritePaths=/var/lib/n8n` - Only n8n directory is writable

### Firewall Configuration

```bash
# Allow HTTP/HTTPS for webhooks
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# n8n port should NOT be exposed directly
# Access only via reverse proxy

# Enable firewall
sudo ufw enable
```

---

## Workflow Import

### Step 1: Access n8n UI

```bash
# Local access (from Pi)
http://localhost:5678

# Remote access (from network)
https://n8n.yourdomain.com
```

Login with credentials from systemd service file.

### Step 2: Import Workflows

1. In n8n UI, click **Import from File**
2. Import each workflow JSON file:
   - `../workflows/coupon-capture.json`
   - `../workflows/claim-redemption.json`
   - `../workflows/balance-check.json`
   - `../workflows/opt-out.json`

### Step 3: Configure Credentials

See `../docs/credentials-setup.md` for detailed instructions.

**Required credentials**:

1. **Backend API Key**
   - Type: Header Auth
   - Name: `Backend API Key`
   - Header Name: `Authorization`
   - Header Value: `Bearer <YOUR_API_KEY>`

2. **WhatsApp Business API**
   - Type: Generic Credential Type
   - Name: `WhatsApp Business API`
   - Fields:
     - `whatsappAccessToken`: Your Meta access token
     - `whatsappPhoneId`: Your phone number ID
     - `whatsappSecret`: Your app secret (for signature verification)

### Step 4: Activate Workflows

1. Open each workflow
2. Click **Active** toggle in top right
3. Verify webhook URLs are displayed
4. Copy webhook URLs for Meta configuration

---

## Testing

### Local Testing

```bash
# Test n8n health
curl http://localhost:5678/healthz

# Test webhook endpoint (replace with actual webhook path)
./test-webhooks.sh
```

### WhatsApp Integration Testing

1. **Configure Meta Webhook**:
   - Go to Meta Developer Console
   - Navigate to WhatsApp > Configuration
   - Set Webhook URL: `https://n8n.yourdomain.com/webhook/whatsapp`
   - Set Verify Token: (from n8n workflow)
   - Subscribe to `messages` field
   - Click **Verify and Save**

2. **Send Test Messages**:
   ```
   KUPON ABC123DEF456  # Test coupon capture
   durum               # Test balance check
   kupon kullan        # Test redemption claim
   iptal               # Test opt-out
   ```

3. **Verify in n8n**:
   - Check **Executions** tab
   - Verify workflows executed successfully
   - Check for errors in execution logs

4. **Verify in Backend**:
   ```bash
   # Check backend logs
   tail -f ~/spa-kiosk/backend/logs/app.log | grep coupon
   
   # Check database
   sqlite3 ~/spa-kiosk/data/kiosk.db "SELECT * FROM coupon_events ORDER BY created_at DESC LIMIT 10;"
   ```

---

## Monitoring

### Service Status

```bash
# Check n8n service status
sudo systemctl status n8n

# View recent logs
sudo journalctl -u n8n -n 100

# Follow logs in real-time
sudo journalctl -u n8n -f

# Check n8n application logs
sudo tail -f /var/lib/n8n/logs/n8n.log
```

### Reverse Proxy Logs

**nginx**:
```bash
# Access logs
sudo tail -f /var/log/nginx/n8n-access.log

# Error logs
sudo tail -f /var/log/nginx/n8n-error.log
```

**Caddy**:
```bash
# Caddy logs
sudo journalctl -u caddy -f

# Access logs
sudo tail -f /var/log/caddy/n8n-access.log
```

### Workflow Execution Monitoring

1. **n8n UI**:
   - Navigate to **Executions** tab
   - Filter by workflow, status, date
   - View execution details and errors

2. **Execution Statistics**:
   - Total executions
   - Success rate
   - Average execution time
   - Error patterns

### Alerts

Setup email alerts for service failures:

```bash
# Edit systemd service
sudo systemctl edit n8n

# Add override:
[Service]
OnFailure=failure-notification@%n.service
```

---

## Troubleshooting

### Service Won't Start

**Symptom**: `sudo systemctl start n8n` fails

**Solutions**:
```bash
# Check logs
sudo journalctl -u n8n -n 50

# Common issues:
# 1. Port 5678 already in use
sudo lsof -i :5678
sudo kill -9 <PID>

# 2. Permission issues
sudo chown -R n8n:n8n /var/lib/n8n

# 3. Node.js not found
which node
# If not found, reinstall Node.js

# 4. Invalid environment variables
sudo nano /etc/systemd/system/n8n.service
# Check for syntax errors
```

### Webhooks Not Receiving Messages

**Symptom**: WhatsApp messages don't trigger workflows

**Solutions**:
```bash
# 1. Check n8n is running
curl http://localhost:5678/healthz

# 2. Check reverse proxy
curl https://n8n.yourdomain.com/healthz

# 3. Check webhook URL in Meta
# Verify it matches: https://n8n.yourdomain.com/webhook/whatsapp

# 4. Check webhook signature verification
# View execution logs in n8n UI for signature errors

# 5. Test webhook manually
./test-webhooks.sh

# 6. Check firewall
sudo ufw status
# Ensure ports 80 and 443 are open
```

### Workflows Fail with Backend API Errors

**Symptom**: Workflows execute but backend API calls fail

**Solutions**:
```bash
# 1. Verify backend is running
curl http://localhost:3001/api/kiosk/health

# 2. Check API key in n8n credentials
# In n8n UI: Credentials > Backend API Key
# Verify it matches backend .env N8N_API_KEY

# 3. Check backend logs
tail -f ~/spa-kiosk/backend/logs/app.log

# 4. Test API endpoint directly
curl -H "Authorization: Bearer <API_KEY>" \
  http://localhost:3001/api/integrations/coupons/wallet/905551234567
```

### SSL Certificate Issues

**nginx**:
```bash
# Check certificate expiration
sudo certbot certificates

# Renew certificate
sudo certbot renew

# Test auto-renewal
sudo certbot renew --dry-run
```

**Caddy**:
```bash
# Caddy handles certificates automatically
# Check Caddy logs for certificate errors
sudo journalctl -u caddy -n 100 | grep -i cert

# Force certificate renewal
sudo systemctl restart caddy
```

### High Memory Usage

**Symptom**: n8n consuming too much RAM

**Solutions**:
```bash
# Check memory usage
free -h
ps aux | grep n8n

# Restart service
sudo systemctl restart n8n

# Reduce execution data retention
sudo nano /etc/systemd/system/n8n.service
# Change: EXECUTIONS_DATA_SAVE_ON_SUCCESS=none

# Clear old executions in n8n UI
# Settings > Executions > Clear all
```

---

## Maintenance

### Updates

```bash
# Update n8n
sudo npm update -g n8n

# Restart service
sudo systemctl restart n8n

# Verify version
n8n --version
```

### Backups

```bash
# Manual backup
./backup.sh

# Automated daily backup (2:30 AM)
sudo crontab -e
# Add:
30 2 * * * /path/to/n8n-workflows/deployment/backup.sh >> /var/log/n8n-backup.log 2>&1
```

**Backup includes**:
- SQLite database (`/var/lib/n8n/.n8n/database.sqlite3`)
- Workflow JSON files
- Credentials template (no secrets)
- Configuration files

**Restore from backup**:
```bash
# Extract backup
tar -xzf n8n-backup-YYYYMMDD-HHMMSS.tar.gz

# Stop n8n
sudo systemctl stop n8n

# Restore database
sudo cp database.sqlite3 /var/lib/n8n/.n8n/

# Restore workflows (import via UI)

# Start n8n
sudo systemctl start n8n
```

### Log Rotation

n8n automatically rotates logs based on:
- `N8N_LOG_FILE_COUNT_MAX=10` (keep 10 files)
- `N8N_LOG_FILE_SIZE_MAX=16` (16MB per file)

Manual log cleanup:
```bash
# Clean old logs
sudo find /var/lib/n8n/logs -name "*.log.*" -mtime +30 -delete

# Clean old executions in database
# In n8n UI: Settings > Executions > Clear old executions
```

### Performance Tuning

```bash
# Increase file descriptor limit
sudo nano /etc/systemd/system/n8n.service
# Add under [Service]:
LimitNOFILE=65536

# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart n8n
```

---

## Verification Checklist

After deployment, verify:

- [ ] n8n service is running: `sudo systemctl status n8n`
- [ ] n8n UI accessible: `https://n8n.yourdomain.com`
- [ ] Reverse proxy working: `curl https://n8n.yourdomain.com/healthz`
- [ ] SSL certificate valid: Check in browser
- [ ] Workflows imported and activated
- [ ] Credentials configured
- [ ] Webhook URL configured in Meta
- [ ] Test messages trigger workflows
- [ ] Backend API calls succeed
- [ ] Database updates correctly
- [ ] Logs are being written
- [ ] Backups scheduled

---

## Security Checklist

- [ ] Changed default n8n password
- [ ] n8n runs as dedicated user (not root)
- [ ] Firewall configured (ports 80, 443 only)
- [ ] SSL certificate valid and auto-renewing
- [ ] Webhook signature verification enabled
- [ ] Backend API key rotated from default
- [ ] Logs don't contain sensitive data
- [ ] Backups stored securely
- [ ] systemd security hardening enabled

---

## Related Documentation

- **Workflow Documentation**: `../docs/`
- **Credentials Setup**: `../docs/credentials-setup.md`
- **n8n Development Guide**: `../../.kiro/steering/n8n-development.md`
- **Backend API**: `../../backend/src/routes/integrationCouponRoutes.ts`
- **Requirements**: `../../.kiro/specs/whatsapp-coupon-system/requirements.md`
- **Design**: `../../.kiro/specs/whatsapp-coupon-system/design.md`

---

## Support

For issues:
1. Check troubleshooting section above
2. Review n8n logs: `sudo journalctl -u n8n -n 100`
3. Check n8n documentation: https://docs.n8n.io
4. Review workflow execution logs in n8n UI

---

**Status**: ✅ Ready for production deployment  
**Last Updated**: 2025-11-28  
**Tested on**: Raspberry Pi 5, Debian 13 (Trixie), Node.js 20.19.6
