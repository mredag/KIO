# SPA Digital Kiosk & Customer Engagement Platform

Touchscreen kiosk application with Instagram/WhatsApp AI automation, OpenClaw-powered customer service, Mission Control dashboard, and dynamic content management for spa reception areas.

## Features

### Digital Kiosk
- Digital Menu — massage services with photos/videos
- Slideshow — rotating promotional content
- Survey — customer feedback with dynamic questions
- Google QR — review collection via QR codes

### Instagram DM AI (OpenClaw)
- AI-powered Turkish assistant via OpenClaw gateway + OpenRouter
- Dynamic model routing (light/standard/advanced tiers)
- Intent detection with category-filtered knowledge base
- Conversation history tracking
- DM Simulator for testing without Meta webhook

### WhatsApp Coupon System
- Token issuance after each massage
- Coupon collection via WhatsApp messaging
- Wallet management (4 coupons = 1 free massage)
- Rate-limited redemption claims

### Mission Control
- Dashboard with system overview, costs, events timeline
- Workshop — Kanban job board with momentum sorting
- Intelligence — skill board with neural momentum gauge
- Agent management with per-agent cost tracking
- Vector document search (Vectra)
- Policy management (guardrails, routing)

### Admin Panel
- Content management (massages, surveys, settings)
- AI prompts — edit system messages (changes apply immediately)
- Knowledge base — business info (prices, hours, policies)
- Interaction logs with CSV export
- Coupon system management

## Quick Start

```bash
# Install dependencies
npm install

# Run development servers (frontend :3000 + backend :3001)
npm run dev

# Or run separately
npm run dev --workspace=backend   # Backend: http://localhost:3001
npm run dev --workspace=frontend  # Frontend: http://localhost:3000
```

### Environment Setup

Copy `backend/.env.example` to `backend/.env` and fill in your keys.

### OpenClaw Gateway (for Instagram AI)

```bash
openclaw gateway --port 18789
```

## Architecture

```
Dev Machine (Windows)
├── Frontend (port 3000) — Vite + React + TypeScript
├── Backend (port 3001) — Express + SQLite (WAL mode)
│   ├── /api/admin/*          — Session auth (admin panel)
│   ├── /api/kiosk/*          — Public (kiosk UI)
│   ├── /api/integrations/*   — API key auth (OpenClaw/external)
│   ├── /api/mc/*             — Mission Control (session auth)
│   ├── /webhook/instagram    — Meta webhook → OpenClaw pipeline
│   └── /webhook/whatsapp     — Meta webhook verification
└── OpenClaw (port 18789) — AI agent gateway
    └── Instagram hook        — Multi-model routing via OpenRouter

Raspberry Pi (192.168.1.7)
├── Backend (PM2, port 3001) — serves frontend in prod
└── OpenClaw (planned)
```

## Technology Stack

- Frontend: React 18, TypeScript, Vite, TanStack Query, Zustand, Tailwind CSS
- Backend: Node.js 18, Express, TypeScript, SQLite (better-sqlite3)
- AI: OpenClaw gateway, OpenRouter (Kimi K2, Gemini Flash, GPT-4o-mini)
- Deployment: Raspberry Pi 5, PM2, Cloudflare Tunnel

## Testing

```bash
npm run test --workspace=backend      # Unit tests
npm run test:e2e --workspace=backend  # E2E tests
npm run lint                          # Lint all
npm run format                        # Format all
```

## Documentation

- [ULTIMATE_GUIDE.md](.kiro/steering/ULTIMATE_GUIDE.md) — Start here (architecture, bug patterns, API reference)
- [openclaw-development.md](.kiro/steering/openclaw-development.md) — OpenClaw/Instagram AI pipeline
- [deployment-raspberry-pi.md](.kiro/steering/deployment-raspberry-pi.md) — Pi deployment
- [ui-ux-testing.md](.kiro/steering/ui-ux-testing.md) — Puppeteer UI testing

## Default Credentials

- Admin: `http://localhost:3001/admin/login` — admin / admin123
- Change immediately after first login.

---

**Last Updated:** 2026-02-22
**Status:** Production on Pi, OpenClaw Instagram pipeline active (dev)
