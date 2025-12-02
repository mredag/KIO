# Raspberry Pi Deployment Checklist

## ✅ Pre-Deployment (Completed)

- [x] WhatsApp Business API setup complete
- [x] Permanent access token generated
- [x] App Secret retrieved
- [x] Code pushed to main branch
- [x] Coupon system implemented
- [x] Admin dashboard redesigned

## 📋 Deployment Steps

### 1. Backup Current Pi Data

```bash
# SSH into Pi
ssh user@pi-ip

# Backup database
cd ~/spa-kiosk
cp data/kiosk.db data/kiosk.db.backup-$(date +%Y%m%d-%H%M%S)

# Backup .env
cp backend/.env backend/.env.backup-$(date +%Y%m%d-%H%M%S)
```

### 2. Pull Latest Code

```bash
cd ~/spa-kiosk
git pull origin main
```

### 3. Update Environment Variables

```bash
cd ~/spa-kiosk/backend
nano .env
```

**Add these WhatsApp credentials:**
```env
# WhatsApp Cloud API Credentials
WHATSAPP_ACCESS_TOKEN=EAA9xzHZBdKVUBQHDw2PZBHTV9pD6cZAZAYCiWnQXWvazBxxUdUBgi8Tqq5RZBduzKYhF9BZBixZAj5eATHrAoEZClh5jhgmYtwBQRCJUC1ayFku4Etvp9zZBiR3UtF2tToRcPYhziaoZAa7ySrDffCDskivZAkMXq3S6aAQYtMx9mDTvuuX6KvrgYg7T8aDF7XMninQKAZDZD
WHATSAPP_PHONE_NUMBER_ID=471153662739049
WHATSAPP_BUSINESS_ACCOUNT_ID=376093462264266
WHATSAPP_APP_SECRET=36e2f75cab508989d382282c71d205f0
WHATSAPP_VERIFY_TOKEN=spa_kiosk_webhook_verify_2024
```

**Verify these are set:**
```env
NODE_ENV=production
N8N_API_KEY=dwsQf8q0BpFWXPqMhwy2SGLG/wHIw1hKyjW8eI4Cgd8=
```

### 4. Install Dependencies

```bash
cd ~/spa-kiosk
npm install
cd backend && npm install
cd ../frontend && npm install
```

### 5. Run Database Migrations

```bash
cd ~/spa-kiosk/backend
npm run build
node dist/database/init.js
```

**This will create new coupon tables:**
- `coupon_tokens`
- `coupon_wallets`
- `coupon_redemptions`
- `coupon_rate_limits`
- `coupon_event_logs`

### 6. Build Application

```bash
# Build backend
cd ~/spa-kiosk/backend
npm run build

# Build frontend
cd ../frontend
npm run build

# Copy frontend to backend public
rm -rf ../backend/public
cp -r dist ../backend/public
```

### 7. Restart Backend

```bash
pm2 restart kiosk-backend
pm2 logs kiosk-backend --lines 50
```

### 8. Verify Deployment

```bash
# Check PM2 status
pm2 status

# Check health endpoint
curl http://localhost:3001/api/kiosk/health

# Check coupon API
curl -H "Authorization: Bearer dwsQf8q0BpFWXPqMhwy2SGLG/wHIw1hKyjW8eI4Cgd8=" \
  http://localhost:3001/api/integrations/coupons/health

# Check database tables
sqlite3 ~/spa-kiosk/data/kiosk.db "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'coupon%';"
```

**Expected output:**
```
coupon_tokens
coupon_wallets
coupon_redemptions
coupon_rate_limits
coupon_event_logs
```

### 9. Test Admin Dashboard

Open browser on Pi or from network:
- URL: `http://pi-ip:3001/admin`
- Login with admin credentials
- Check new pages:
  - Coupon Issue
  - Coupon Redemptions
  - Coupon Wallet Lookup

### 10. Test Coupon API

```bash
# Test token generation
curl -X POST http://localhost:3001/api/admin/coupons/tokens \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -d '{"count": 1, "expiresInDays": 30}'

# Test wallet lookup
curl -X GET "http://localhost:3001/api/admin/coupons/wallet/905067070403" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"
```

## 🔍 Verification Checklist

After deployment, verify:

- [ ] PM2 shows `kiosk-backend | online`
- [ ] Health endpoint returns `{"status":"ok"}`
- [ ] Coupon health endpoint returns success
- [ ] All 5 coupon tables exist in database
- [ ] Admin dashboard loads correctly
- [ ] New coupon pages are accessible
- [ ] Can generate coupon tokens
- [ ] Can view wallet balance
- [ ] Can view redemption history
- [ ] Kiosk mode still works
- [ ] Existing features not broken

## 🚨 Rollback Plan (If Needed)

If something goes wrong:

```bash
# Stop backend
pm2 stop kiosk-backend

# Restore database
cd ~/spa-kiosk
cp data/kiosk.db.backup-YYYYMMDD-HHMMSS data/kiosk.db

# Restore .env
cp backend/.env.backup-YYYYMMDD-HHMMSS backend/.env

# Checkout previous commit
git log --oneline -5  # Find previous commit hash
git checkout PREVIOUS_COMMIT_HASH

# Rebuild
cd backend && npm run build
cd ../frontend && npm run build
rm -rf ../backend/public && cp -r dist ../backend/public

# Restart
pm2 restart kiosk-backend
```

## 📝 Post-Deployment Tasks

After successful deployment:

1. ✅ **n8n installed** and running on Pi
2. ✅ **Cloudflare Tunnel** configured for permanent webhook URL
3. ✅ **Meta webhooks** configured with `https://webhook.eformspa.com/api/whatsapp/webhook`
4. ✅ **n8n workflows** imported and active
5. ✅ **End-to-end testing** completed

### Cloudflare Tunnel Management
```bash
# Check tunnel status
ssh eform-kio@192.168.1.5 "systemctl status cloudflared --no-pager"

# Restart tunnel
ssh eform-kio@192.168.1.5 "sudo systemctl restart cloudflared"
```

## 🔗 Important URLs

- **Pi Admin**: http://pi-ip:3001/admin
- **Pi Kiosk**: http://pi-ip:3001
- **Meta App Dashboard**: https://developers.facebook.com/apps/1311694093443416/
- **WhatsApp Manager**: https://business.facebook.com/wa/manage/phone-numbers/

## 📞 Support

If you encounter issues:
1. Check PM2 logs: `pm2 logs kiosk-backend`
2. Check database: `sqlite3 ~/spa-kiosk/data/kiosk.db`
3. Verify .env file has all required variables
4. Check network connectivity
5. Verify Node.js version: `node --version` (should be 20.x)

---

**Ready to deploy?** Follow the steps above in order!
