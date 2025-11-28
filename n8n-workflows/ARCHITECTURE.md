# n8n Workflows Architecture

**Purpose:** Document the architectural separation between n8n workflows and the core kiosk application.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Raspberry Pi Server                          │
│                                                                   │
│  ┌────────────────────────┐    ┌──────────────────────────┐    │
│  │   Core Kiosk System    │    │   n8n Automation         │    │
│  │   (Port 3001)          │    │   (Port 5678)            │    │
│  │                        │    │                          │    │
│  │  - Backend (Express)   │◄───┤  - Workflow Engine       │    │
│  │  - Frontend (React)    │    │  - WhatsApp Integration  │    │
│  │  - SQLite Database     │    │  - Message Processing    │    │
│  │  - PM2 Process Mgr     │    │  - systemd Service       │    │
│  └────────────────────────┘    └──────────────────────────┘    │
│           │                              │                       │
│           │                              │                       │
│  ┌────────▼──────────────────────────────▼──────────────┐      │
│  │              nginx Reverse Proxy                      │      │
│  │  - /          → Kiosk (3001)                         │      │
│  │  - /api       → Kiosk Backend (3001)                 │      │
│  │  - /webhook   → n8n (5678)                           │      │
│  └───────────────────────────────────────────────────────┘      │
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
                               │ HTTPS
                               ▼
                    ┌──────────────────────┐
                    │  WhatsApp Cloud API  │
                    │  (Meta)              │
                    └──────────────────────┘
```

---

## 📂 Directory Separation

### Core Kiosk System
```
project-root/
├── backend/                    # Express.js backend
│   ├── src/
│   │   ├── routes/
│   │   │   ├── adminRoutes.ts         # Admin endpoints
│   │   │   └── kioskRoutes.ts         # Kiosk endpoints
│   │   ├── services/
│   │   │   ├── CouponService.ts       # Coupon business logic
│   │   │   ├── RateLimitService.ts    # Rate limiting
│   │   │   └── EventLogService.ts     # Event logging
│   │   ├── middleware/
│   │   │   ├── apiKeyAuth.ts          # API key authentication
│   │   │   └── couponRateLimit.ts     # Rate limit middleware
│   │   └── database/
│   │       ├── schema.sql             # Includes coupon tables
│   │       └── DatabaseService.ts     # Database operations
│   └── .env                            # Backend config (includes N8N_API_KEY)
├── frontend/                   # React frontend
│   └── src/
│       └── pages/admin/
│           ├── CouponIssuePage.tsx    # Token issuance UI
│           ├── CouponRedemptionsPage.tsx  # Redemption management
│           └── CouponWalletLookupPage.tsx # Customer support
└── data/
    └── kiosk.db                # SQLite database (includes coupon tables)
```

### n8n Workflows (Separate)
```
n8n-workflows/                  # Completely separate directory
├── README.md                   # This directory's documentation
├── ARCHITECTURE.md             # This file
├── .gitignore                  # Exclude credentials and backups
├── workflows/                  # Exported workflow JSON files
│   ├── coupon-capture.json
│   ├── claim-redemption.json
│   ├── balance-check.json
│   └── opt-out.json
├── docs/                       # Workflow documentation
│   ├── coupon-capture.md
│   ├── claim-redemption.md
│   ├── balance-check.md
│   ├── opt-out.md
│   └── credentials-setup.md
├── credentials/                # Templates only (NO SECRETS)
│   └── credentials-template.json
├── deployment/                 # n8n-specific deployment
│   ├── README.md
│   ├── DEPLOYMENT.md
│   ├── BACKUP.md
│   ├── n8n.service            # systemd service (separate from kiosk)
│   ├── nginx-n8n.conf         # nginx config (separate from kiosk)
│   └── deploy-n8n.sh          # Deployment script
├── scripts/                    # Utility scripts
│   ├── backup.sh              # Backup n8n workflows
│   ├── deploy.sh              # Import workflows
│   └── test-webhooks.sh       # Test webhooks
└── backups/                    # n8n backups (gitignored)
    ├── workflows-YYYYMMDD/
    └── database-YYYYMMDD.sqlite3
```

---

## 🔌 Integration Points

### 1. API Communication
- **Direction:** n8n → Backend
- **Protocol:** HTTP/HTTPS
- **Authentication:** API Key (Bearer token)
- **Endpoints:**
  - `POST /api/integrations/coupons/consume`
  - `POST /api/integrations/coupons/claim`
  - `GET /api/integrations/coupons/wallet/:phone`
  - `POST /api/integrations/coupons/opt-out`

### 2. Shared Configuration
- **API Key:** Stored in both backend `.env` and n8n credentials
- **WhatsApp Number:** Used in backend for QR generation, in n8n for messaging
- **Timezone:** Both use Europe/Istanbul

### 3. Shared Database
- **Database:** SQLite at `data/kiosk.db`
- **Tables:** Coupon tables are part of main database
- **Access:** Backend writes/reads, n8n only triggers backend API (no direct DB access)

---

## 🚀 Deployment Separation

### Core Kiosk Deployment
```bash
# Deploy kiosk application
cd deployment/raspberry-pi
bash deploy-pi.sh

# Kiosk runs on:
# - Backend: PM2 process on port 3001
# - Frontend: Served by backend in production
# - Database: SQLite at data/kiosk.db
```

### n8n Deployment (Separate)
```bash
# Deploy n8n workflows
cd n8n-workflows/deployment
bash deploy-n8n.sh

# n8n runs on:
# - Service: systemd service on port 5678
# - Database: SQLite at /var/lib/n8n/.n8n/database.sqlite3
# - Workflows: Imported from n8n-workflows/workflows/
```

---

## 🔄 Backup Separation

### Core Kiosk Backup
- **Schedule:** 2:00 AM Istanbul time
- **Location:** `data/backups/`
- **Contents:** SQLite database (includes coupon tables)
- **Script:** `backend/src/services/BackupService.ts`

### n8n Backup (Separate)
- **Schedule:** 2:30 AM Istanbul time
- **Location:** `n8n-workflows/backups/`
- **Contents:** 
  - Workflow JSON files
  - n8n database (workflow definitions, executions)
- **Script:** `n8n-workflows/scripts/backup.sh`

---

## 🔐 Security Separation

### Core Kiosk Security
- **Authentication:** Session-based for admin, API key for integrations
- **Secrets:** Stored in `backend/.env`
- **Rate Limiting:** Backend middleware
- **PII Masking:** Backend logging

### n8n Security (Separate)
- **Authentication:** Basic auth for n8n UI, webhook signature verification
- **Secrets:** Stored in n8n credential system (never in git)
- **Rate Limiting:** nginx reverse proxy
- **PII Masking:** Function nodes in workflows

---

## 📊 Monitoring Separation

### Core Kiosk Monitoring
- **Logs:** `backend/logs/app.log`
- **Metrics:** Backend API response times, database queries
- **Alerts:** Backend errors, database size, TLS expiry

### n8n Monitoring (Separate)
- **Logs:** `/var/lib/n8n/logs/` and n8n UI execution logs
- **Metrics:** Workflow execution times, success/failure rates
- **Alerts:** n8n service down, webhook failures, rate limit abuse

---

## 🎯 Benefits of Separation

### 1. Clear Boundaries
- n8n is an external automation tool, not part of kiosk codebase
- Easier to understand system architecture
- Clearer responsibility boundaries

### 2. Independent Scaling
- n8n can be scaled independently (e.g., move to separate server)
- Kiosk can be updated without affecting n8n
- n8n can be updated without affecting kiosk

### 3. Security Isolation
- n8n credentials isolated from application code
- Separate backup schedules reduce risk
- Separate monitoring reduces noise

### 4. Team Collaboration
- Different teams can work on workflows vs. application
- Workflow changes don't require code review
- Easier to onboard new team members

### 5. Version Control
- Workflow JSON files versioned separately
- Clear history of workflow changes
- Easy to rollback workflow changes

---

## 🔗 Communication Flow

### Token Issuance Flow
```
Admin UI → Backend API → Database → QR Code → Customer
```

### Token Consumption Flow
```
Customer → WhatsApp → n8n Workflow → Backend API → Database → n8n → WhatsApp → Customer
```

### Redemption Flow
```
Customer → WhatsApp → n8n Workflow → Backend API → Database → n8n → WhatsApp → Customer + Staff
```

---

## 📝 Development Workflow

### Working on Core Kiosk
```bash
# Start backend
cd backend
npm run dev

# Start frontend
cd frontend
npm run dev

# No need to start n8n for kiosk development
```

### Working on n8n Workflows
```bash
# Start n8n
n8n

# Access UI at http://localhost:5678
# Build/test workflows in UI
# Export to n8n-workflows/workflows/
# Document in n8n-workflows/docs/
```

### Integration Testing
```bash
# Start both systems
cd backend && npm run dev &
n8n &

# Test webhook endpoints
cd n8n-workflows/scripts
bash test-webhooks.sh
```

---

## 🚨 Important Reminders

1. **Never commit n8n credentials to git**
2. **Keep n8n workflows exported as JSON in version control**
3. **Document all workflow changes in n8n-workflows/docs/**
4. **Test workflows locally before deploying to production**
5. **Backup both systems separately (different schedules)**
6. **Monitor both systems independently**
7. **Update both systems independently**

---

**Last Updated:** 2025-11-28  
**Status:** ✅ Architecture defined and documented  
**Next Steps:** Implement according to tasks.md
