# SPA Digital Kiosk

A touchscreen kiosk application for spa reception areas with a web-based admin panel.

## Features

### Kiosk Modes
- **Digital Menu Mode** - Display massage services with photos/videos
- **Slideshow Mode** - Rotating promotional content
- **Survey Mode** - Customer feedback collection
- **Google QR Mode** - Review collection via QR codes

### WhatsApp Coupon System
- **Token Issuance** - Generate unique coupon tokens after each massage
- **WhatsApp Integration** - Customers collect coupons via WhatsApp messaging
- **Wallet Management** - Track customer coupon balances and redemptions
- **Automated Workflows** - n8n-powered message processing and notifications
- **Admin Tools** - Issue tokens, manage redemptions, lookup customer wallets

### Admin Panel
- Manage content, view analytics, configure settings
- Issue and track coupon tokens
- Process redemptions and customer support

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Run development servers
npm run dev

# Frontend: http://localhost:3000
# Backend: http://localhost:3001
```

### Environment Setup

**Backend (.env):**
```env
PORT=3001
NODE_ENV=development
DATABASE_PATH=./data/kiosk.db
SESSION_SECRET=your-secret-key
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# WhatsApp Coupon System
N8N_API_KEY=your-secure-api-key
WHATSAPP_NUMBER=905551234567
TZ=Europe/Istanbul
```

**n8n Setup (Optional - for WhatsApp Coupon System):**
```bash
# Install n8n globally
npm install -g n8n

# Run n8n
n8n

# Access UI at http://localhost:5678
# Import workflows from n8n-workflows/workflows/
```

See [COUPON_ENV_SETUP.md](backend/COUPON_ENV_SETUP.md) for detailed configuration.

### Production Deployment

**Windows:**
```bash
cd deployment
windows-deploy.bat
```

**Raspberry Pi:**
```bash
cd deployment
chmod +x *.sh
./deploy-pi.sh
```

See [deployment/README.md](deployment/README.md) for detailed instructions.

## Project Structure

```
spa-digital-kiosk/
├── frontend/              # React app (Kiosk + Admin)
│   ├── src/pages/admin/   # Admin pages including coupon management
│   └── src/hooks/         # API hooks with coupon endpoints
├── backend/               # Node.js API server
│   ├── src/routes/        # API routes (admin + integration)
│   ├── src/services/      # Business logic (CouponService, RateLimitService)
│   ├── src/middleware/    # Auth, rate limiting, validation
│   └── src/locales/       # Turkish translations
├── n8n-workflows/         # WhatsApp automation workflows
│   ├── workflows/         # JSON workflow exports
│   ├── docs/              # Workflow documentation
│   └── deployment/        # n8n deployment scripts
├── deployment/            # Deployment scripts and guides
├── data/                  # SQLite database and uploads
└── logs/                  # Application logs
```

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Customer Layer                           │
├─────────────────────────────────────────────────────────────────┤
│  Kiosk (Touchscreen)          WhatsApp (Mobile)                 │
│  - Digital Menu               - Coupon Collection               │
│  - Surveys                    - Balance Check                   │
│  - QR Codes                   - Redemption Claims               │
└────────────┬──────────────────────────────┬─────────────────────┘
             │                              │
             │                              │ Webhook
             ▼                              ▼
┌─────────────────────────┐    ┌──────────────────────────────────┐
│   Frontend (React)      │    │   Meta Cloud API                 │
│   Port 3000 (dev)       │    │   WhatsApp Business              │
│   Port 3001 (prod)      │    └──────────────┬───────────────────┘
└────────────┬────────────┘                   │
             │                                │
             │ HTTPS/REST                     │ Webhook
             ▼                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend API (Express)                         │
│                         Port 3001                                │
├─────────────────────────────────────────────────────────────────┤
│  Admin Routes          │  Integration Routes                    │
│  - Session Auth        │  - API Key Auth                        │
│  - Token Issuance      │  - Token Consumption                   │
│  - Redemption Mgmt     │  - Redemption Claims                   │
│  - Wallet Lookup       │  - Wallet Queries                      │
└────────────┬────────────┴──────────────┬───────────────────────┘
             │                           │
             │                           │ HTTPS + API Key
             ▼                           ▼
┌─────────────────────────┐    ┌──────────────────────────────────┐
│   SQLite Database       │    │   n8n Workflows                  │
│   - Coupons             │    │   Port 5678                      │
│   - Wallets             │    │   - Message Parsing              │
│   - Redemptions         │    │   - Deduplication                │
│   - Events              │    │   - Turkish Replies              │
│   - Rate Limits         │    │   - Staff Notifications          │
└─────────────────────────┘    └──────────────────────────────────┘
```

### Data Flow: Coupon Collection

1. **Staff Issues Token** → Admin generates QR code with WhatsApp deep link
2. **Customer Scans** → WhatsApp opens with pre-filled message "KUPON <TOKEN>"
3. **Customer Sends** → Meta delivers webhook to n8n
4. **n8n Processes** → Normalizes phone, checks deduplication, calls backend API
5. **Backend Validates** → Checks token status, expiration, rate limits
6. **Backend Updates** → Increments wallet balance, marks token as used, logs event
7. **n8n Replies** → Sends Turkish confirmation message with balance

### Technology Stack

**Frontend:** React 18, TypeScript, Vite, TanStack Query, Zustand, Tailwind CSS

**Backend:** Node.js, Express, TypeScript, SQLite, better-sqlite3

**Automation:** n8n (self-hosted), Meta Cloud API (WhatsApp Business)

**Deployment:** PM2 (backend), systemd (n8n), nginx/Caddy (reverse proxy)

## Default Credentials

- Username: `admin`
- Password: `admin123`

**⚠️ Change these immediately after first login!**

## Documentation

### General
- [Windows Deployment](deployment/WINDOWS.md)
- [Raspberry Pi Deployment](deployment/RASPBERRY_PI.md)
- [Steering Rules](.kiro/steering/README.md)

### WhatsApp Coupon System
- [Requirements](.kiro/specs/whatsapp-coupon-system/requirements.md)
- [Design Document](.kiro/specs/whatsapp-coupon-system/design.md)
- [Implementation Tasks](.kiro/specs/whatsapp-coupon-system/tasks.md)
- [Environment Setup](backend/COUPON_ENV_SETUP.md)
- [n8n Workflows](n8n-workflows/README.md)
- [n8n Deployment](n8n-workflows/deployment/README.md)
- [Admin User Guide](docs/COUPON_ADMIN_GUIDE.md)

## Support

For issues and troubleshooting, see the platform-specific deployment guides.
