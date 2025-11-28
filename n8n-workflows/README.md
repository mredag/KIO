# n8n Workflows for WhatsApp Coupon System

**Purpose:** This directory contains all n8n workflow definitions, deployment scripts, and documentation for the WhatsApp coupon automation system. It is intentionally separated from the core kiosk application to maintain clear boundaries.

---

## 📁 Directory Structure

```
n8n-workflows/
├── README.md                          # This file
├── .gitignore                         # Exclude credentials and sensitive data
├── workflows/                         # Exported workflow JSON files
│   ├── coupon-capture.json           # Workflow A: Token consumption
│   ├── claim-redemption.json         # Workflow B: Redemption claims
│   ├── balance-check.json            # Workflow C: Balance queries
│   └── opt-out.json                  # Workflow D: Marketing opt-out
├── docs/                              # Workflow documentation
│   ├── coupon-capture.md             # Workflow A documentation
│   ├── claim-redemption.md           # Workflow B documentation
│   ├── balance-check.md              # Workflow C documentation
│   ├── opt-out.md                    # Workflow D documentation
│   └── credentials-setup.md          # Credential configuration guide
├── credentials/                       # Credential templates (NO SECRETS)
│   └── credentials-template.json     # Template structure only
├── deployment/                        # Deployment configurations
│   ├── README.md                     # Deployment overview
│   ├── DEPLOYMENT.md                 # Step-by-step deployment guide
│   ├── BACKUP.md                     # Backup and restore procedures
│   ├── n8n.service                   # systemd service file
│   ├── nginx-n8n.conf                # nginx reverse proxy config
│   └── deploy-n8n.sh                 # Automated deployment script
├── scripts/                           # Utility scripts
│   ├── backup.sh                     # Backup n8n workflows and database
│   ├── deploy.sh                     # Import workflows to n8n
│   └── test-webhooks.sh              # Test webhook endpoints
└── backups/                           # Backup storage (gitignored)
    ├── workflows-YYYYMMDD/           # Workflow JSON backups
    └── database-YYYYMMDD.sqlite3     # n8n database backups
```

---

## 🚀 Quick Start

### 1. Install n8n on Raspberry Pi

```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install n8n globally
sudo npm install -g n8n

# Create n8n user and directory
sudo useradd -m -s /bin/bash n8n
sudo mkdir -p /var/lib/n8n
sudo chown n8n:n8n /var/lib/n8n
```

### 2. Run n8n Locally (Development)

```bash
# Start n8n
n8n

# Access UI at http://localhost:5678
```

### 3. Import Workflows

```bash
# In n8n UI:
# 1. Click "Import from File"
# 2. Select workflow JSON from n8n-workflows/workflows/
# 3. Configure credentials (see docs/credentials-setup.md)
# 4. Activate workflow
```

### 4. Deploy to Production

```bash
# Run deployment script
cd n8n-workflows/deployment
sudo bash deploy-n8n.sh
```

---

## 🔐 Security Notes

**CRITICAL:** This directory should NEVER contain actual credentials or secrets.

- ✅ Workflow JSON files (exported from n8n)
- ✅ Credential templates with placeholder values
- ✅ Documentation and deployment scripts
- ❌ Actual API keys, tokens, or passwords
- ❌ WhatsApp Business API credentials
- ❌ Backend API keys

All credentials are stored in n8n's credential system and never committed to git.

---

## 📋 Workflows Overview

### Workflow A: Coupon Capture
- **File:** `workflows/coupon-capture.json`
- **Trigger:** WhatsApp webhook (message starts with "KUPON")
- **Purpose:** Validate and consume coupon tokens
- **Backend API:** `POST /api/integrations/coupons/consume`

### Workflow B: Claim Redemption
- **File:** `workflows/claim-redemption.json`
- **Trigger:** WhatsApp webhook (message equals "kupon kullan")
- **Purpose:** Process redemption claims (4 coupons → free massage)
- **Backend API:** `POST /api/integrations/coupons/claim`

### Workflow C: Balance Check
- **File:** `workflows/balance-check.json`
- **Trigger:** WhatsApp webhook (message equals "durum")
- **Purpose:** Return customer's coupon balance
- **Backend API:** `GET /api/integrations/coupons/wallet/:phone`

### Workflow D: Opt-Out
- **File:** `workflows/opt-out.json`
- **Trigger:** WhatsApp webhook (message equals "iptal")
- **Purpose:** Opt customer out of marketing messages
- **Backend API:** `POST /api/integrations/coupons/opt-out`

---

## 🔗 Integration with Backend

n8n workflows communicate with the backend API at `http://localhost:3001/api/integrations/coupons/*`

**Authentication:** All integration endpoints require API key authentication:
```
Authorization: Bearer <N8N_API_KEY>
```

The API key is stored in:
- Backend: `.env` file as `N8N_API_KEY`
- n8n: Credential system as "Backend API Key"

---

## 🧪 Testing

### Local Testing
```bash
# Test webhook with curl
curl -X POST http://localhost:5678/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "from": "905551234567",
    "text": {
      "body": "KUPON ABC123DEF456"
    }
  }'
```

### Test Checklist
- [ ] Valid token consumption
- [ ] Invalid token handling
- [ ] Expired token handling
- [ ] Duplicate message deduplication
- [ ] Rate limiting (11th request)
- [ ] Network error retry
- [ ] Turkish message formatting
- [ ] Staff notifications

---

## 📊 Monitoring

### Check n8n Execution Logs
- In n8n UI: Executions tab → View execution details
- Check for errors, retries, and execution times

### Check Backend Logs
```bash
tail -f ../backend/logs/app.log | grep coupon
```

### Check n8n Service Status
```bash
sudo systemctl status n8n
```

---

## 🔄 Backup and Restore

### Backup Workflows
```bash
cd n8n-workflows
bash scripts/backup.sh
```

### Restore Workflows
```bash
# Import from backup directory
# In n8n UI: Import from File → Select from backups/workflows-YYYYMMDD/
```

---

## 📚 Documentation

- **Workflow Details:** See `docs/<workflow-name>.md` for each workflow
- **Credentials Setup:** See `docs/credentials-setup.md`
- **Deployment Guide:** See `deployment/DEPLOYMENT.md`
- **Backup Procedures:** See `deployment/BACKUP.md`
- **Steering Guide:** See `../.kiro/steering/n8n-development.md`

---

## 🎯 Why Separate from Core Kiosk?

1. **Clear Boundaries:** n8n is an external automation tool, not part of the kiosk codebase
2. **Independent Deployment:** n8n can be deployed, updated, and scaled independently
3. **Security Isolation:** Credentials and workflows are isolated from application code
4. **Version Control:** Workflow JSON files are versioned separately from application code
5. **Team Collaboration:** Different teams can work on workflows vs. application code

---

## 🚨 Important Notes

- n8n runs on port 5678 (separate from backend port 3001)
- n8n has its own systemd service (separate from backend PM2)
- n8n has its own nginx configuration (separate from kiosk nginx)
- n8n has its own backup schedule (2:30 AM vs backend 2:00 AM)
- n8n workflows are exported as JSON and version controlled
- n8n credentials are NEVER committed to git

---

## 🔗 Related Documentation

- Backend API Routes: `../backend/src/routes/`
- Coupon System Spec: `../.kiro/specs/whatsapp-coupon-system/`
- Implementation Plan: `../docs/n8n-coupon-plan.md`
- Deployment Guide: `../deployment/raspberry-pi/README.md`

---

**Last Updated:** 2025-11-28  
**Status:** ✅ Ready for implementation  
**Maintainer:** See project README for contact information
