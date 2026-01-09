# n8n Deployment Scripts

This directory contains scripts for deploying, backing up, and testing n8n workflows.

## Scripts

### 1. deploy.sh
Imports workflows from JSON files to production n8n instance.

**Usage**:
```bash
# Set environment variables
export N8N_URL="http://localhost:5678"
export N8N_USER="admin"
export N8N_PASSWORD="your_password"

# Run deployment
./deploy.sh
```

**What it does**:
- Checks n8n availability
- Lists workflows to import
- Provides manual import instructions

**Note**: n8n doesn't have a direct API for workflow import, so manual steps are required. For automated deployment, consider using n8n API or CLI tools.

---

### 2. backup.sh
Exports workflows and database from n8n instance.

**Usage**:
```bash
# Use default n8n data directory (~/.n8n)
./backup.sh

# Or specify custom directory
N8N_DATA_DIR=/var/lib/n8n ./backup.sh
```

**What it does**:
- Backs up SQLite database
- Backs up workflow JSON files
- Backs up credentials template (no secrets)
- Compresses backup as tar.gz
- Cleans up backups older than 30 days

**Backup location**: `../backups/n8n-backup-YYYYMMDD-HHMMSS.tar.gz`

**Restore**:
```bash
# Extract backup
tar -xzf n8n-backup-YYYYMMDD-HHMMSS.tar.gz

# Follow instructions in backup-info.txt
```

---

### 3. test-webhooks.sh
Tests all webhook endpoints with sample payloads.

**Usage**:
```bash
# Use defaults
./test-webhooks.sh

# Or customize
N8N_URL="http://localhost:5678" \
WEBHOOK_SECRET="your_secret" \
TEST_PHONE="905551234567" \
./test-webhooks.sh
```

**What it does**:
- Tests coupon capture workflow (valid and invalid tokens)
- Tests claim redemption workflow
- Tests balance check workflow
- Tests opt-out workflow
- Tests webhook signature verification

**Tests**:
1. ✅ Coupon Capture - Valid Token
2. ✅ Coupon Capture - Invalid Format
3. ✅ Claim Redemption
4. ✅ Balance Check
5. ✅ Opt-Out
6. ✅ Invalid Signature (should be rejected)

---

## Environment Variables

### deploy.sh
- `N8N_URL`: n8n instance URL (default: http://localhost:5678)
- `N8N_USER`: n8n username (default: admin)
- `N8N_PASSWORD`: n8n password (required)

### backup.sh
- `N8N_DATA_DIR`: n8n data directory (default: ~/.n8n)

### test-webhooks.sh
- `N8N_URL`: n8n instance URL (default: http://localhost:5678)
- `WEBHOOK_SECRET`: WhatsApp app secret for signature calculation
- `TEST_PHONE`: Test phone number (default: 905551234567)

---

## Deployment Workflow

### Initial Setup

1. **Install n8n**:
   ```bash
   npm install -g n8n
   ```

2. **Start n8n**:
   ```bash
   n8n
   # Access at http://localhost:5678
   ```

3. **Import workflows**:
   ```bash
   ./deploy.sh
   # Follow manual import instructions
   ```

4. **Configure credentials**:
   - See `../docs/credentials-setup.md`
   - Add Backend API Key
   - Add WhatsApp Business API credentials

5. **Test workflows**:
   ```bash
   ./test-webhooks.sh
   ```

6. **Activate workflows**:
   - In n8n UI, activate each workflow
   - Verify webhook URLs are accessible

### Production Deployment

1. **Setup systemd service**:
   ```bash
   # Create n8n user
   sudo useradd -m -s /bin/bash n8n
   sudo mkdir -p /var/lib/n8n/logs
   sudo chown -R n8n:n8n /var/lib/n8n
   
   # Install n8n globally
   sudo npm install -g n8n
   
   # Copy service file
   sudo cp n8n.service /etc/systemd/system/
   
   # Edit service file to set production credentials
   sudo nano /etc/systemd/system/n8n.service
   # Change N8N_BASIC_AUTH_PASSWORD
   # Change WEBHOOK_URL to your public domain
   
   # Enable and start service
   sudo systemctl daemon-reload
   sudo systemctl enable n8n
   sudo systemctl start n8n
   
   # Check status
   sudo systemctl status n8n
   
   # View logs
   sudo journalctl -u n8n -f
   ```
   
   **Service Configuration**:
   - User: `n8n` (dedicated service user)
   - Working Directory: `/var/lib/n8n`
   - Port: `5678` (HTTP, behind reverse proxy)
   - Timezone: `Europe/Istanbul`
   - Auto-restart: Enabled (10 second delay)
   - Logs: `/var/lib/n8n/logs/`
   
   **Important**: Change default credentials in `/etc/systemd/system/n8n.service` before starting:
   - `N8N_BASIC_AUTH_PASSWORD`: Set strong password
   - `WEBHOOK_URL`: Set to your public HTTPS domain

3. **Configure email alerts** (optional but recommended):
   
   See `EMAIL_ALERTS_SETUP.md` for detailed instructions.
   
   **Quick setup**:
   ```bash
   # Install mail utilities
   sudo apt-get install mailutils postfix
   
   # Copy alert script
   sudo cp n8n-failure-alert.sh /usr/local/bin/
   sudo chmod +x /usr/local/bin/n8n-failure-alert.sh
   
   # Edit to set your email
   sudo nano /usr/local/bin/n8n-failure-alert.sh
   # Change: ALERT_EMAIL="your-email@example.com"
   
   # Install alert service
   sudo cp n8n-failure-alert.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable n8n-failure-alert.service
   
   # Test alert
   sudo /usr/local/bin/n8n-failure-alert.sh
   ```
   
   The n8n.service file already includes `OnFailure=n8n-failure-alert.service` to trigger alerts on failures.

2. **Import workflows**:
   ```bash
   N8N_URL="https://n8n.yourdomain.com" \
   N8N_PASSWORD="prod_password" \
   ./deploy.sh
   ```

3. **Configure reverse proxy**:
   
   **Option A: nginx**
   ```bash
   # Install nginx
   sudo apt-get install nginx certbot python3-certbot-nginx
   
   # Copy nginx config
   sudo cp nginx-n8n.conf /etc/nginx/sites-available/n8n
   
   # Edit config to set your domain
   sudo nano /etc/nginx/sites-available/n8n
   # Change n8n.yourdomain.com to your actual domain
   
   # Enable site
   sudo ln -s /etc/nginx/sites-available/n8n /etc/nginx/sites-enabled/
   
   # Test configuration
   sudo nginx -t
   
   # Obtain SSL certificate
   sudo certbot --nginx -d n8n.yourdomain.com
   
   # Reload nginx
   sudo systemctl reload nginx
   ```
   
   **Option B: Caddy (simpler, automatic HTTPS)**
   ```bash
   # Install Caddy
   sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
   sudo apt update
   sudo apt install caddy
   
   # Copy Caddy config
   sudo cp Caddyfile-n8n /etc/caddy/Caddyfile
   
   # Edit config to set your domain
   sudo nano /etc/caddy/Caddyfile
   # Change n8n.yourdomain.com to your actual domain
   
   # Reload Caddy (automatically obtains SSL certificate)
   sudo systemctl reload caddy
   ```
   
   **Reverse Proxy Features**:
   - ✅ HTTPS termination with automatic certificate management
   - ✅ Rate limiting (100 req/min for webhooks, 30 req/min for UI)
   - ✅ WebSocket support for n8n UI
   - ✅ Security headers (HSTS, X-Frame-Options, etc.)
   - ✅ Separate from main kiosk nginx/Caddy config
   - ✅ Health check endpoint at `/healthz`
   
   **DNS Configuration**:
   Before running certbot/Caddy, ensure DNS A record points to your server:
   ```
   n8n.yourdomain.com -> YOUR_SERVER_IP
   ```

4. **Configure webhooks in Meta**:
   - Set webhook URL to public HTTPS endpoint
   - Subscribe to `messages` field
   - Verify webhook

5. **Test end-to-end**:
   - Send test WhatsApp message
   - Verify workflow executes
   - Check backend API calls
   - Verify database updates

### Backup Schedule

Setup automated backups with cron:

```bash
# Edit crontab
crontab -e

# Add daily backup at 2:30 AM
30 2 * * * /path/to/n8n-workflows/deployment/backup.sh >> /var/log/n8n-backup.log 2>&1
```

---

## Troubleshooting

### deploy.sh fails to connect

**Issue**: Cannot connect to n8n

**Solutions**:
- Verify n8n is running: `curl http://localhost:5678`
- Check N8N_URL is correct
- Verify firewall allows connection
- Check n8n logs: `journalctl -u n8n -f`

### backup.sh can't find database

**Issue**: SQLite database not found

**Solutions**:
- Check n8n data directory: `ls ~/.n8n`
- Set N8N_DATA_DIR if using custom location
- Verify n8n is using SQLite (not PostgreSQL)

### test-webhooks.sh all tests fail

**Issue**: All webhook tests return errors

**Solutions**:
- Verify n8n is running
- Check workflows are imported and activated
- Verify webhook paths match workflow configuration
- Check backend API is running
- Review n8n execution history for errors

### Signature verification fails

**Issue**: Webhooks rejected with invalid signature

**Solutions**:
- Verify WEBHOOK_SECRET matches Meta app secret
- Check signature calculation algorithm
- Ensure payload isn't modified
- Test with Meta webhook test tool

---

## Security Notes

- ✅ Never commit actual credentials
- ✅ Use environment variables for secrets
- ✅ Restrict script permissions (chmod 700)
- ✅ Backup to secure location
- ✅ Encrypt backups if storing remotely
- ✅ Rotate credentials regularly
- ✅ Monitor backup logs for failures

---

## Related Documentation

- Workflow Documentation: `../docs/`
- Credentials Setup: `../docs/credentials-setup.md`
- n8n Development Guide: `../../.kiro/steering/n8n-development.md`
- Backend API: `../../backend/src/routes/integrationCouponRoutes.ts`

---

## Status

✅ Scripts created  
✅ Documentation complete  
⏳ Production deployment pending

Last Updated: 2025-11-28
