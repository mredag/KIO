# SPA Digital Kiosk & Customer Engagement Platform

A comprehensive touchscreen kiosk application with WhatsApp/Instagram automation, AI-powered customer service, and dynamic content management for spa reception areas.

## 🌟 Features

### 🖥️ Digital Kiosk
- **Digital Menu Mode** - Display massage services with photos/videos
- **Slideshow Mode** - Rotating promotional content
- **Survey Mode** - Customer feedback collection with dynamic questions
- **Google QR Mode** - Review collection via QR codes

### 💬 WhatsApp Coupon System
- **Token Issuance** - Generate unique coupon tokens after each massage
- **WhatsApp Integration** - Customers collect coupons via WhatsApp messaging
- **Wallet Management** - Track customer coupon balances (4 coupons = 1 free massage)
- **Automated Workflows** - n8n-powered message processing with signature verification
- **Interaction Logging** - Track all customer messages for analytics
- **Admin Tools** - Issue tokens, manage redemptions, lookup customer wallets

### 📸 Instagram DM Integration
- **AI-Powered Assistant** - Natural conversation using Google Gemini
- **Dynamic Knowledge Base** - Business info (prices, hours, policies) from database
- **Customer Enrichment** - Fetches customer history before responding
- **Intent Detection** - Classifies messages (pricing, hours, booking, coupon)
- **Interaction Logging** - Track all conversations for marketing analytics
- **Response Time Tracking** - Measure AI performance

### 🤖 Dynamic AI System
- **Database-Driven Prompts** - Edit AI system messages from admin panel
- **Version Control** - Track prompt changes with auto-incrementing versions
- **A/B Testing** - Easy to test different prompts without redeploying
- **Multi-Platform** - Separate prompts for WhatsApp, Instagram, general use
- **No Redeploy** - Changes apply immediately to n8n workflows

### 📊 Admin Panel
- **Content Management** - Manage massages, surveys, settings
- **Coupon System** - Issue tokens, process redemptions, customer support
- **AI Prompts** - Edit system messages for Instagram/WhatsApp bots
- **Knowledge Base** - Update business info (prices, hours, policies)
- **Interactions** - View WhatsApp/Instagram message logs
- **Analytics** - Customer engagement metrics and export to CSV

## 🚀 Quick Start

### Development

```bash
# Install dependencies
npm install

# Run development servers (both frontend + backend)
npm run dev

# Or run separately
npm run dev --workspace=backend   # Backend: http://localhost:3001
npm run dev --workspace=frontend  # Frontend: http://localhost:3000
```

### Environment Setup

**Backend (.env):**
```env
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_PATH=./data/kiosk.db

# Session
SESSION_SECRET=your-secret-key-here

# Admin Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# n8n Integration
N8N_API_KEY=your-secure-api-key

# WhatsApp Business API
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_ACCESS_TOKEN=your-access-token
WHATSAPP_VERIFY_TOKEN=your-verify-token
WHATSAPP_APP_SECRET=your-app-secret

# Instagram Business API
INSTAGRAM_PAGE_ID=your-page-id
INSTAGRAM_ACCESS_TOKEN=your-access-token

# Timezone
TZ=Europe/Istanbul
```

**Frontend (.env):**
```env
VITE_API_URL=http://localhost:3001
```

### Database Initialization

The database automatically seeds on first run with:
- ✅ 26 Turkish knowledge base entries (services, pricing, hours, policies, contact)
- ✅ 3 AI system prompts (WhatsApp, Instagram, General)
- ✅ Service settings (WhatsApp and Instagram enabled)
- ✅ Default admin user

No manual seeding required!

### n8n Setup (Required for WhatsApp/Instagram)

```bash
# Install n8n globally
npm install -g n8n

# Run n8n
n8n

# Access UI at http://localhost:5678
# Import workflows from n8n-workflows/workflows-v2/
```

**Production Workflows:**
- `whatsapp-dynamic-automation.json` - WhatsApp coupon system with security
- `instagram-dynamic-automation.json` - Instagram DM with AI + knowledge base

See [n8n-workflows/README.md](n8n-workflows/README.md) for setup instructions.

## 📦 Production Deployment

### Raspberry Pi (Recommended)

```bash
# 1. Transfer files to Pi
scp -r . pi-user@pi-hostname:~/spa-kiosk/

# 2. SSH to Pi
ssh pi-user@pi-hostname

# 3. Install dependencies
cd ~/spa-kiosk
npm install
cd backend && npm install
cd ../frontend && npm install

# 4. Build
cd ~/spa-kiosk/backend
npm run build

cd ../frontend
npm run build
cp -r dist ../backend/public

# 5. Start with PM2
cd ~/spa-kiosk/backend
pm2 start npm --name kiosk-backend -- run start
pm2 save
pm2 startup
```

See [deployment/raspberry-pi/README.md](deployment/raspberry-pi/README.md) for detailed instructions.

### Windows

```bash
cd deployment
windows-deploy.bat
```

See [deployment/WINDOWS.md](deployment/WINDOWS.md) for detailed instructions.

## 🏗️ Project Structure

```
spa-digital-kiosk/
├── frontend/                      # React app (Vite + TypeScript)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── admin/            # Admin panel pages
│   │   │   │   ├── AIPromptsPage.tsx        # Edit AI system messages
│   │   │   │   ├── KnowledgeBasePage.tsx    # Edit business info
│   │   │   │   ├── InteractionsPage.tsx     # View message logs
│   │   │   │   ├── CouponIssuePage.tsx      # Issue coupon tokens
│   │   │   │   └── CouponRedemptionsPage.tsx # Manage redemptions
│   │   │   └── kiosk/            # Kiosk mode pages
│   │   ├── hooks/                # API hooks (React Query)
│   │   │   ├── useAIPromptsApi.ts
│   │   │   ├── useKnowledgeBaseApi.ts
│   │   │   └── useInteractionsApi.ts
│   │   └── components/           # Reusable components
│   └── .env                      # Frontend config
│
├── backend/                       # Express API (TypeScript)
│   ├── src/
│   │   ├── routes/
│   │   │   ├── adminRoutes.ts               # Admin endpoints
│   │   │   ├── kioskRoutes.ts               # Kiosk endpoints
│   │   │   ├── aiPromptsRoutes.ts           # AI prompts CRUD
│   │   │   ├── knowledgeBaseRoutes.ts       # Knowledge base CRUD
│   │   │   ├── integrationCouponRoutes.ts   # WhatsApp coupon API
│   │   │   ├── integrationAIPromptsRoutes.ts # AI prompts for n8n
│   │   │   ├── integrationKnowledgeRoutes.ts # Knowledge for n8n
│   │   │   └── instagramIntegrationRoutes.ts # Instagram API
│   │   ├── services/
│   │   │   ├── CouponService.ts             # Coupon business logic
│   │   │   ├── RateLimitService.ts          # Rate limiting
│   │   │   └── EventLogService.ts           # Event logging
│   │   ├── middleware/
│   │   │   ├── apiKeyAuth.ts                # API key authentication
│   │   │   └── couponRateLimit.ts           # Rate limit middleware
│   │   └── database/
│   │       ├── schema.sql                   # Database schema
│   │       └── seed.ts                      # Auto-seeding
│   └── .env                      # Backend config (secrets)
│
├── n8n-workflows/                 # WhatsApp/Instagram automation
│   ├── workflows-v2/
│   │   ├── whatsapp-dynamic-automation.json    # WhatsApp production
│   │   └── instagram-dynamic-automation.json   # Instagram production
│   ├── docs/                      # Workflow documentation
│   │   ├── DYNAMIC_AUTOMATION_INTEGRATION.md
│   │   ├── AI_PROMPTS_SYSTEM.md
│   │   └── WHATSAPP_SECURITY_HARDENING.md
│   └── CREDENTIALS.template.md    # Credential setup guide
│
├── deployment/                    # Deployment scripts
│   ├── raspberry-pi/             # Pi deployment
│   └── windows/                  # Windows deployment
│
├── .kiro/steering/               # Development guides
│   ├── ULTIMATE_GUIDE.md         # ⭐ START HERE
│   ├── n8n-development.md        # n8n workflow development
│   └── deployment-raspberry-pi.md # Pi deployment guide
│
├── data/                         # SQLite database (gitignored)
│   └── kiosk.db
│
└── logs/                         # Application logs (gitignored)
```

## 🔧 Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Customer Layer                           │
├─────────────────────────────────────────────────────────────────┤
│  Kiosk (Touchscreen)    WhatsApp (Mobile)    Instagram (Mobile) │
│  - Digital Menu         - Coupon Collection  - AI Assistant     │
│  - Surveys              - Balance Check      - Business Info    │
│  - QR Codes             - Redemption         - Booking Inquiries│
└────────────┬────────────────────┬────────────────────┬──────────┘
             │                    │                    │
             │                    │ Webhook            │ Webhook
             ▼                    ▼                    ▼
┌─────────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Frontend (React)   │  │  Meta Cloud API  │  │  Meta Cloud API  │
│  Port 3000 (dev)    │  │  WhatsApp        │  │  Instagram       │
│  Port 3001 (prod)   │  └────────┬─────────┘  └────────┬─────────┘
└──────────┬──────────┘           │                     │
           │                      │                     │
           │ HTTPS/REST           │ Webhook             │ Webhook
           ▼                      ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend API (Express)                         │
│                         Port 3001                                │
├─────────────────────────────────────────────────────────────────┤
│  Admin Routes              │  Integration Routes                │
│  - Session Auth            │  - API Key Auth                    │
│  - AI Prompts CRUD         │  - AI Prompts (for n8n)           │
│  - Knowledge Base CRUD     │  - Knowledge Base (for n8n)       │
│  - Coupon Token Issuance   │  - Coupon Consumption             │
│  - Redemption Management   │  - Redemption Claims              │
│  - Interaction Logs        │  - Customer Data                  │
└────────────┬───────────────────────────────┬───────────────────┘
             │                               │
             │                               │ HTTPS + API Key
             ▼                               ▼
┌─────────────────────────┐    ┌──────────────────────────────────┐
│   SQLite Database       │    │   n8n Workflows (Port 5678)      │
│   - ai_system_prompts   │    │   ┌────────────────────────────┐ │
│   - knowledge_base      │    │   │ WhatsApp Workflow          │ │
│   - coupons             │    │   │ - Signature Verification   │ │
│   - coupon_wallets      │    │   │ - Keyword Routing          │ │
│   - redemptions         │    │   │ - Interaction Logging      │ │
│   - whatsapp_interact.  │    │   └────────────────────────────┘ │
│   - instagram_customers │    │   ┌────────────────────────────┐ │
│   - instagram_interact. │    │   │ Instagram Workflow         │ │
│   - massages            │    │   │ - Fetch AI Prompt (DB)     │ │
│   - surveys             │    │   │ - Fetch Knowledge (DB)     │ │
│   - settings            │    │   │ - Fetch Customer Data      │ │
└─────────────────────────┘    │   │ - AI Agent (Gemini)        │ │
                               │   │ - Interaction Logging      │ │
                               │   └────────────────────────────┘ │
                               └──────────────────────────────────┘
```

### Key Innovations

#### 1. Dynamic AI Prompts
- AI system messages stored in database (`ai_system_prompts` table)
- Edit prompts from admin panel (`/admin/ai-prompts`)
- n8n workflows fetch prompts via API (`/api/integrations/ai/prompt/:name`)
- **No workflow redeployment needed** - changes apply immediately!

#### 2. Dynamic Knowledge Base
- Business info stored in database (`knowledge_base` table)
- Edit from admin panel (`/admin/knowledge-base`)
- n8n workflows fetch knowledge via API (`/api/integrations/knowledge/context`)
- AI responses automatically use latest business info

#### 3. Customer Data Enrichment
- Instagram workflow fetches customer history before AI responds
- Personalized responses based on interaction count
- Tracks intent, sentiment, response time for analytics

#### 4. Security Hardening
- WhatsApp signature verification (`x-hub-signature-256`)
- API key authentication for n8n integration
- Rate limiting (10 requests per phone per day)
- PII masking in logs

### Technology Stack

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- TanStack Query (data fetching)
- Zustand (state management)
- Tailwind CSS (styling)

**Backend:**
- Node.js 20 + Express
- TypeScript
- SQLite (better-sqlite3)
- PM2 (process manager)

**Automation:**
- n8n (self-hosted workflow automation)
- Meta Cloud API (WhatsApp Business + Instagram)
- Google Gemini API (AI responses)

**Deployment:**
- Raspberry Pi 5 (Debian 13)
- systemd (n8n service)
- PM2 (backend service)
- Cloudflare Tunnel (webhook ingress)

## 📚 Documentation

### Getting Started
- [ULTIMATE_GUIDE.md](.kiro/steering/ULTIMATE_GUIDE.md) - ⭐ **START HERE** - Top 3 bug patterns, quick fixes, checklists
- [AGENTS.md](AGENTS.md) - Repository guidelines and coding standards

### n8n Workflows
- [n8n Development Guide](.kiro/steering/n8n-development.md) - Workflow development best practices
- [Dynamic Automation](n8n-workflows/DYNAMIC_AUTOMATION_INTEGRATION.md) - Instagram workflow with AI + knowledge base
- [AI Prompts System](n8n-workflows/AI_PROMPTS_SYSTEM.md) - Database-driven AI prompts
- [WhatsApp Security](n8n-workflows/WHATSAPP_SECURITY_HARDENING.md) - Signature verification
- [Credentials Setup](n8n-workflows/CREDENTIALS.template.md) - API keys and tokens

### Deployment
- [Raspberry Pi Deployment](.kiro/steering/deployment-raspberry-pi.md) - Complete Pi setup guide
- [Windows Deployment](deployment/WINDOWS.md) - Windows deployment guide
- [UI/UX Testing](.kiro/steering/ui-ux-testing.md) - Puppeteer testing workflow

### API Documentation
- Admin API: `http://localhost:3001/api/admin/*`
- Integration API: `http://localhost:3001/api/integrations/*`
- Kiosk API: `http://localhost:3001/api/kiosk/*`

## 🔐 Default Credentials

**Admin Panel:**
- URL: `http://localhost:3001/admin/login`
- Username: `admin`
- Password: `admin123`

**n8n (if deployed):**
- URL: `http://your-pi-ip:5678`
- Email: `admin@spa-kiosk.local`
- Password: (set during installation)

**⚠️ IMPORTANT:** Change these immediately after first login!

## 🧪 Testing

```bash
# Backend unit tests
npm run test --workspace=backend

# Backend E2E tests
npm run test:e2e --workspace=backend

# UI tests (Puppeteer)
node test-my-app-now.js

# Lint all
npm run lint

# Format all
npm run format
```

## 🐛 Troubleshooting

### Common Issues

**Port 3001 already in use:**
```bash
# Kill all node processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
```

**Empty data in database:**
- Cause: Using state immediately after setState (async)
- Fix: Use new value directly, not state variable

**Content not updating:**
- Cause: Hardcoded content instead of database
- Fix: Render from database, not i18n files

**Property undefined:**
- Cause: snake_case vs camelCase mismatch
- Fix: Add transform function in API hooks

See [ULTIMATE_GUIDE.md](.kiro/steering/ULTIMATE_GUIDE.md) for complete troubleshooting guide.

## 📊 Database Schema

### Core Tables
- `massages` - Massage services
- `surveys` - Survey templates
- `survey_responses` - Customer feedback
- `settings` - System settings

### Coupon System
- `coupons` - Coupon tokens
- `coupon_wallets` - Customer balances
- `redemptions` - Free massage claims
- `coupon_events` - Audit log

### AI & Knowledge
- `ai_system_prompts` - AI system messages (editable in admin)
- `knowledge_base` - Business info (editable in admin)
- `service_settings` - WhatsApp/Instagram enable flags

### Interactions
- `whatsapp_interactions` - WhatsApp message logs
- `instagram_customers` - Instagram customer data
- `instagram_interactions` - Instagram message logs

## 🚀 Recent Updates (2025-12-07)

- ✅ Dynamic AI prompts system (edit from admin panel)
- ✅ Dynamic knowledge base (business info from database)
- ✅ Instagram workflow with customer enrichment
- ✅ WhatsApp signature verification (security)
- ✅ Interaction logging for both platforms
- ✅ Admin panel for AI prompts and knowledge base
- ✅ Updated steering files with latest architecture

## 📝 License

Proprietary - All rights reserved

## 🤝 Support

For issues and questions:
1. Check [ULTIMATE_GUIDE.md](.kiro/steering/ULTIMATE_GUIDE.md) for common solutions
2. Review platform-specific deployment guides
3. Check n8n workflow documentation

---

**Last Updated:** 2025-12-07  
**Version:** 2.0.0  
**Status:** ✅ Production Ready
