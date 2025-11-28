# n8n WhatsApp coupon automation

Plan to add the WhatsApp + n8n coupon flow to the kiosk system with minimal backend changes and clear operations steps.

## Goals (your request + upgrades)
- Reception issues coupons after each massage; kiosk shows a QR that opens WhatsApp to n8n with the coupon code.
- Customers send the coupon; when they reach 4, they can send “kupon kullan” to claim a free massage.
- Notify reception/admin when a customer qualifies or redeems.
- Simplify ops: single kiosk QR with dynamic token text; no reprints.
- Extend with engagement features (referrals, off-peak boosters, opt-in marketing) and keep everything auditable and rate limited.

## Data model (SQLite)
New tables alongside existing schema:

```sql
CREATE TABLE IF NOT EXISTS coupon_tokens (
  token TEXT PRIMARY KEY,
  status TEXT CHECK(status IN ('issued','used','expired')) DEFAULT 'issued',
  issued_for TEXT,              -- massage/session or campaign id
  kiosk_id TEXT,                -- which kiosk issued it
  phone TEXT,                   -- filled when used
  expires_at DATETIME,
  used_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coupon_wallets (
  phone TEXT PRIMARY KEY,       -- E.164 normalized
  coupon_count INTEGER DEFAULT 0,
  total_earned INTEGER DEFAULT 0,
  total_redeemed INTEGER DEFAULT 0,
  opted_in_marketing INTEGER DEFAULT 0,
  last_message_at DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  coupons_used INTEGER DEFAULT 4,
  status TEXT CHECK(status IN ('pending','notified','completed','rejected')) DEFAULT 'pending',
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  notified_at DATETIME,
  completed_at DATETIME
);

CREATE TABLE IF NOT EXISTS coupon_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT,
  event TEXT,                   -- issued | coupon_awarded | redemption_attempt | redemption_granted | redemption_blocked
  token TEXT,
  details TEXT,                 -- JSON blob
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_coupon_wallets_phone ON coupon_wallets(phone);
CREATE INDEX IF NOT EXISTS idx_coupon_tokens_status ON coupon_tokens(status);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_phone ON coupon_redemptions(phone);
```

## Backend endpoints (minimal surface)
- `POST /api/admin/coupons/issue` (auth): create a single-use `token`, return `{ token, waUrl, waText }`. Kiosk can render one static QR: `https://wa.me/<WA_NUMBER>?text=KUPON%20<TOKEN>`; kiosk just swaps the token text.
- `POST /api/integrations/coupons/consume` (n8n → backend): body `{ phone, token, rawMessage }`. Validates token (unused, not expired), increments wallet, marks token used, logs an event, returns `{ ok, balance, remainingToFree }`.
- `POST /api/integrations/coupons/claim` (n8n → backend): body `{ phone }`. If `coupon_count >= 4`, subtract 4, create `coupon_redemptions` row with `status='pending'`, respond `{ ok: true, redemptionId }`. If not enough, respond `{ ok: false, balance, needed }`.
- `POST /api/admin/coupons/redeem/:id/complete` (auth): staff marks the free session as delivered; updates redemption status.
- `GET /api/admin/coupons/wallet/:phone` (auth): quick lookup for support/merging numbers.
- Optional: SSE or polling endpoint to surface `coupon_redemptions` status inside the admin panel.

## Message format and QR
- Issue QR text: `https://wa.me/<WA_NUMBER>?text=KUPON%20<TOKEN>` (token uppercase). Keep one printed/static QR; kiosk injects the current token text so you never reprint.
- Claim QR text: `https://wa.me/<WA_NUMBER>?text=kupon%20kullan`.
- Commands (matches your flow, adds small QoL):
  - `KUPON <TOKEN>` → awards 1 coupon.
  - `kupon kullan` → attempts redemption (needs 4).
  - `durum` → returns balance and next reward.
  - `iptal` → opts out of marketing.

## n8n workflows
- **Workflow A: Coupon capture** (your QR → WhatsApp idea)
  1) Trigger: WhatsApp inbound webhook. Filter message starting with `KUPON`.
  2) Normalize phone to E.164, parse token.
  3) HTTP POST to `/api/integrations/coupons/consume`.
  4) If success: reply with `You now have X/4 coupons` and remind to send `kupon kullan` at 4/4.
  5) If failure (invalid/used/expired): reply politely and ask them to show receipt at desk.
  6) Log to `coupon_events` via same endpoint or a second HTTP node.

- **Workflow B: Claim free session** (your “kupon kullan” command)
  1) Trigger: WhatsApp inbound where body equals `kupon kullan` (case-insensitive, trim).
  2) HTTP POST to `/api/integrations/coupons/claim`.
  3) If `ok`: reply confirmation + redemption id. Notify staff group on WhatsApp and optionally POST to admin backend for on-screen alert.
  4) If insufficient coupons: reply with balance and an upsell (optional).

- **Workflow C: Balance/opt-in**
  - Keyword `durum`: GET wallet from backend, reply with `X/4` and next reward.
  - Keyword `iptal`: set `opted_in_marketing=0` in wallet table.

- **Workflow D: Engagement upgrades** (my suggested improvements)
  - Off-peak booster: scheduled “double coupons” during slow hours, throttled per day.
  - Referrals: keyword `referans <phone>` to grant both parties +1 after first use.
  - Post-visit follow-up: 24h later ask for quick rating; good → upsell, bad → alert staff.

## Raspberry Pi n8n install (systemd)
```bash
sudo apt update && sudo apt install -y build-essential
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g n8n

# n8n service user
sudo useradd -m -s /bin/bash n8n
sudo mkdir -p /var/lib/n8n
sudo chown n8n:n8n /var/lib/n8n
```

Create `/etc/systemd/system/n8n.service`:
```
[Unit]
Description=n8n automation
After=network.target

[Service]
Type=simple
User=n8n
Environment=EXECUTIONS_PROCESS=main
Environment=N8N_BASIC_AUTH_ACTIVE=true
Environment=N8N_BASIC_AUTH_USER=<admin>
Environment=N8N_BASIC_AUTH_PASSWORD=<password>
Environment=N8N_PORT=5678
Environment=WEBHOOK_URL=https://<public-domain>
Environment=TZ=Europe/Istanbul
Environment=GENERIC_TIMEZONE=Europe/Istanbul
WorkingDirectory=/var/lib/n8n
ExecStart=/usr/bin/n8n
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now n8n
```

Expose via nginx/Caddy with HTTPS so WhatsApp webhooks succeed.

## WhatsApp provider (Meta Cloud API default)
- Keep a single business number.
- Set webhook to `https://<domain>/webhook` (n8n URL), subscribe to `messages`.
- Store secrets in n8n credentials; do not put tokens in the repo.
- Rate limit outbound sends; respect 24-hour window rules.

## Security & anti-abuse
- Tokens are single-use with short expiry (e.g., 24h). Tie each token to kiosk id and optional massage id.
- Normalize phone numbers and log every event (`coupon_events`) for audits.
- Rate limit per phone/day on the backend endpoints (reuse existing middleware pattern).
- Validate keywords strictly; drop unexpected attachments/locations.
- Opt-out respected; store flag in `coupon_wallets`.

## Implementation checklist
- [ ] Add the four tables above to `schema.sql` + typings in `database/types.ts`.
- [ ] Add DB helpers in `DatabaseService` (issue token, consume token, get wallet, create redemption, mark redemption complete).
- [ ] Add admin + integration routes (see endpoints section) with auth/rate limiting similar to existing routes.
- [ ] Add a small admin UI page: issue token (copy button for WhatsApp text/QR), view wallet by phone, list pending redemptions.
- [ ] Build the two n8n workflows (coupon capture, claim), add staff notification step, and test with a sandbox WhatsApp number.
- [ ] Document message templates (TR + EN) and keep them in i18n files for consistency.

## Raspberry Pi OS compatibility (full stack + n8n)
- Target: Raspberry Pi OS Bookworm (arm64 or armhf). Use Node.js 20.x for parity with the project.
- Prereqs for builds (better-sqlite3 needs native build):
  ```bash
  sudo apt update
  sudo apt install -y build-essential python3 sqlite3 libsqlite3-dev pkg-config
  ```
- Install Node 20 (arm build):
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
  ```
- Install repo deps (root workspace):
  ```bash
  npm install
  ```
- Run locally on Pi:
  - Dev: `npm run dev` (concurrent backend + frontend).
  - Prod: `npm run build`, then `npm run start:prod` (backend); `npm run preview --workspace=frontend` for a prod-like frontend.
- n8n on Pi: instructions above (systemd) work on Raspberry Pi OS; binaries are arm-compatible. Use HTTPS ingress (nginx/Caddy) for WhatsApp webhooks.
- Performance tips on Pi: keep `EXECUTIONS_PROCESS=main` for low memory; enable swap if RAM-constrained; use `pm2` or systemd to keep backend/frontend/n8n alive; avoid heavy cron overlap during peak hours.
