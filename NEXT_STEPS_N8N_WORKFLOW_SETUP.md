# Next Steps: n8n Workflow Setup & Coupon System Testing

**Date:** 2025-11-29  
**Status:** Ready for workflow configuration

---

## 🔌 Pi Connection Info

### SSH Access
```bash
ssh eform-kio@192.168.1.5
```

### Service URLs (from your network)
| Service | URL |
|---------|-----|
| Kiosk | http://192.168.1.5:3001 |
| Admin Panel | http://192.168.1.5:3001/admin |
| n8n Dashboard | http://192.168.1.5:5678 |

### Service Management
```bash
# Check all services
ssh eform-kio@192.168.1.5 "pm2 status && sudo systemctl status n8n | head -5"

# Restart kiosk backend
ssh eform-kio@192.168.1.5 "pm2 restart kiosk-backend"

# Restart n8n
ssh eform-kio@192.168.1.5 "sudo systemctl restart n8n"

# View logs
ssh eform-kio@192.168.1.5 "pm2 logs kiosk-backend --lines 20"
ssh eform-kio@192.168.1.5 "sudo journalctl -u n8n -f"
```

---

## ✅ Completed

- [x] WhatsApp Business API setup (permanent token)
- [x] Backend coupon system deployed on Pi
- [x] Database tables created (5 coupon tables)
- [x] n8n installed on Pi (v1.121.3)
- [x] n8n service running on port 5678

---

## 🎯 Current Status

| Component | Status | URL |
|-----------|--------|-----|
| Kiosk Backend | ✅ Running | http://192.168.1.5:3001 |
| Admin Panel | ✅ Running | http://192.168.1.5:3001/admin |
| Coupon API | ✅ Running | http://192.168.1.5:3001/api/integrations/coupons |
| n8n | ✅ Running | http://192.168.1.5:5678 |
| WhatsApp API | ✅ Configured | Meta Cloud API |

---

## 📋 Step 1: Configure n8n Credentials

### 1.1 Access n8n
- URL: http://192.168.1.5:5678
- Username: `admin`
- Password: `admin123`

### 1.2 Create Backend API Credential
1. Go to **Settings** → **Credentials** → **Add Credential**
2. Select **Header Auth**
3. Configure:
   - Name: `Backend API Key`
   - Header Name: `Authorization`
   - Header Value: `Bearer dwsQf8q0BpFWXPqMhwy2SGLG/wHIw1hKyjW8eI4Cgd8=`

### 1.3 Create WhatsApp API Credential
1. Add another **Header Auth** credential
2. Configure:
   - Name: `WhatsApp API`
   - Header Name: `Authorization`
   - Header Value: `Bearer EAA9xzHZBdKVUBQHDw2PZBHTV9pD6cZAZAYCiWnQXWvazBxxUdUBgi8Tqq5RZBduzKYhF9BZBixZAj5eATHrAoEZClh5jhgmYtwBQRCJUC1ayFku4Etvp9zZBiR3UtF2tToRcPYhziaoZAa7ySrDffCDskivZAkMXq3S6aAQYtMx9mDTvuuX6KvrgYg7T8aDF7XMninQKAZDZD`

---

## 📋 Step 2: Import Workflows

### 2.1 Import Workflow Files
Import these workflows from `n8n-workflows/workflows/`:

| Workflow | Purpose | File |
|----------|---------|------|
| Coupon Capture | Process incoming coupon tokens | `coupon-capture.json` |
| Balance Check | Check wallet balance | `balance-check.json` |
| Claim Redemption | Redeem 4 coupons for free massage | `claim-redemption.json` |
| Opt-Out | Handle unsubscribe requests | `opt-out.json` |

### 2.2 Import Steps
1. In n8n, click **Add Workflow** → **Import from File**
2. Select each JSON file
3. After import, update credentials in each workflow
4. Activate each workflow

---

## 📋 Step 3: Configure Webhook URLs

### 3.1 Get Webhook URLs from n8n
After importing workflows, note the webhook URLs:
- Coupon Capture: `http://192.168.1.5:5678/webhook/coupon-capture`
- Balance Check: `http://192.168.1.5:5678/webhook/balance-check`
- Claim Redemption: `http://192.168.1.5:5678/webhook/claim-redemption`

### 3.2 Configure Meta Webhook (for production)
For local testing, we'll simulate WhatsApp messages directly.

---

## 📋 Step 4: Test Coupon System

### 4.1 Generate Test Tokens (Admin Panel)
1. Go to http://192.168.1.5:3001/admin
2. Login: admin / admin123
3. Navigate to **Kupon Oluştur** (Coupon Issue)
4. Generate 5 test tokens with 30-day expiry
5. Note the generated token codes

### 4.2 Test via API (Direct Backend Test)

```bash
# Test 1: Consume a coupon token
curl -X POST http://192.168.1.5:3001/api/integrations/coupons/consume \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dwsQf8q0BpFWXPqMhwy2SGLG/wHIw1hKyjW8eI4Cgd8=" \
  -d '{"phone": "+905551234567", "token": "YOUR_TOKEN_HERE"}'

# Test 2: Check wallet balance
curl -X POST http://192.168.1.5:3001/api/integrations/coupons/balance \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dwsQf8q0BpFWXPqMhwy2SGLG/wHIw1hKyjW8eI4Cgd8=" \
  -d '{"phone": "+905551234567"}'

# Test 3: Claim redemption (after 4 coupons)
curl -X POST http://192.168.1.5:3001/api/integrations/coupons/claim \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dwsQf8q0BpFWXPqMhwy2SGLG/wHIw1hKyjW8eI4Cgd8=" \
  -d '{"phone": "+905551234567"}'
```

### 4.3 Test n8n Webhook (Simulate WhatsApp Message)

```bash
# Simulate coupon capture message
curl -X POST http://192.168.1.5:5678/webhook/coupon-capture \
  -H "Content-Type: application/json" \
  -d '{
    "from": "905551234567",
    "text": {"body": "KUPON ABC12345"}
  }'

# Simulate balance check
curl -X POST http://192.168.1.5:5678/webhook/balance-check \
  -H "Content-Type: application/json" \
  -d '{
    "from": "905551234567",
    "text": {"body": "bakiye"}
  }'
```

---

## 📋 Step 5: Verify Results

### 5.1 Check Admin Dashboard
- Go to **Kupon Kullanımları** (Coupon Redemptions)
- Verify coupon consumption is logged
- Check **Cüzdan Sorgula** (Wallet Lookup) for balance

### 5.2 Check Database
```bash
ssh eform-kio@192.168.1.5

# Check wallets
cd ~/spa-kiosk
node -e "
const db = require('better-sqlite3')('./data/kiosk.db');
console.log('Wallets:', db.prepare('SELECT * FROM coupon_wallets').all());
db.close();
"

# Check events
node -e "
const db = require('better-sqlite3')('./data/kiosk.db');
console.log('Events:', db.prepare('SELECT * FROM coupon_events ORDER BY created_at DESC LIMIT 10').all());
db.close();
"
```

### 5.3 Check n8n Execution Logs
- In n8n UI, go to **Executions**
- Verify workflows executed successfully
- Check for any errors

---

## 🔧 Troubleshooting

### n8n Workflow Not Triggering
- Ensure workflow is **activated** (toggle on)
- Check webhook URL is correct
- Verify credentials are configured

### Backend API Returns 401
- Check API key matches: `dwsQf8q0BpFWXPqMhwy2SGLG/wHIw1hKyjW8eI4Cgd8=`
- Ensure `Authorization: Bearer` prefix is included

### Token Invalid Error
- Generate fresh tokens from admin panel
- Check token hasn't expired
- Verify token format (12 characters)

### WhatsApp Message Not Sending
- Check WhatsApp access token is valid
- Verify phone number format (+90...)
- Check Meta API rate limits

---

## 📱 Full End-to-End Test Flow

1. **Generate Token** → Admin panel creates token
2. **Print QR/Card** → Token given to customer
3. **Customer Sends WhatsApp** → "KUPON ABC12345"
4. **n8n Receives** → Webhook triggers workflow
5. **Backend Processes** → Token consumed, wallet updated
6. **WhatsApp Reply** → Customer gets confirmation
7. **Repeat 4x** → Customer collects 4 coupons
8. **Customer Claims** → Sends "kupon kullan"
9. **Redemption Created** → Staff notified
10. **Free Massage** → Customer redeems at spa

---

## 🔗 Quick Links

| Resource | URL |
|----------|-----|
| n8n Dashboard | http://192.168.1.5:5678 |
| Admin Panel | http://192.168.1.5:3001/admin |
| Kiosk | http://192.168.1.5:3001 |
| Coupon API Health | http://192.168.1.5:3001/api/integrations/coupons/health |
| Meta App Dashboard | https://developers.facebook.com/apps/1311694093443416/ |

---

## 📝 Credentials Reference

| Service | Credential |
|---------|------------|
| n8n Login | admin / admin123 |
| Admin Panel | admin / admin123 |
| Backend API Key | `dwsQf8q0BpFWXPqMhwy2SGLG/wHIw1hKyjW8eI4Cgd8=` |
| WhatsApp Phone ID | `471153662739049` |
| WhatsApp Business ID | `376093462264266` |

---

---

## 🤖 Automated n8n Setup with Puppeteer

You can automate the n8n credential and workflow setup using Puppeteer.

### Available Scripts

| Script | Purpose |
|--------|---------|
| `setup-n8n-workflows.js` | Automated n8n setup with Puppeteer |
| `test-coupon-api.js` | Test coupon API endpoints |

### Run Setup Script
```bash
# Automated n8n setup (opens browser)
node setup-n8n-workflows.js

# Test coupon API endpoints
node test-coupon-api.js
```

### What the Setup Script Does
1. Opens n8n at http://192.168.1.5:5678
2. Logs in with admin/admin123
3. Creates Backend API credential
4. Creates WhatsApp API credential
5. Imports all 4 workflows
6. Activates workflows
7. Takes screenshots for verification

### Manual Alternative
If Puppeteer doesn't work, follow Steps 1-2 manually in the browser.

---

**Ready to configure n8n workflows!** Start with Step 1 above or run the Puppeteer script.
