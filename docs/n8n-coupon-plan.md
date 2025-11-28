# n8n WhatsApp Coupon Automation - Implementation Plan

Plan to add the WhatsApp + n8n coupon flow to the kiosk system with minimal backend changes and clear operations steps.

## Goals
- Reception issues coupons after each massage; kiosk shows a QR that opens WhatsApp to n8n with the coupon code.
- Customers send the coupon; when they reach 4, they can send "kupon kullan" to claim a free massage.
- Notify reception/admin when a customer qualifies or redeems.
- Simplify ops: single kiosk QR with dynamic token text; no reprints.
- Keep everything auditable, rate limited, and secure.

## Data Model (SQLite)
New tables alongside existing schema:

```sql
CREATE TABLE IF NOT EXISTS coupon_tokens (
  token TEXT PRIMARY KEY,
  status TEXT CHECK(status IN ('issued','used','expired')) DEFAULT 'issued',
  issued_for TEXT,
  kiosk_id TEXT,
  phone TEXT,
  expires_at DATETIME,
  used_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coupon_wallets (
  phone TEXT PRIMARY KEY,
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
  completed_at DATETIME,
  rejected_at DATETIME
);

CREATE TABLE IF NOT EXISTS coupon_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT,
  event TEXT,
  token TEXT,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coupon_rate_limits (
  phone TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  count INTEGER DEFAULT 1,
  reset_at DATETIME NOT NULL,
  PRIMARY KEY (phone, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_coupon_wallets_phone ON coupon_wallets(phone);
CREATE INDEX IF NOT EXISTS idx_coupon_tokens_status ON coupon_tokens(status);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_phone ON coupon_redemptions(phone);
CREATE INDEX IF NOT EXISTS idx_coupon_rate_limits_reset ON coupon_rate_limits(reset_at);
```

## Backend Endpoints

### Admin Endpoints (Session Auth Required)
- `POST /api/admin/coupons/issue` - Create token, return `{ token, waUrl, waText }`
- `GET /api/admin/coupons/wallet/:phone` - Lookup wallet by phone
- `GET /api/admin/coupons/redemptions` - List redemptions with filtering
- `POST /api/admin/coupons/redemptions/:id/complete` - Mark complete
- `POST /api/admin/coupons/redemptions/:id/reject` - Reject with note, refund coupons
- `GET /api/admin/coupons/events/:phone` - Get event history

### Integration Endpoints (API Key Auth Required)
- `POST /api/integrations/coupons/consume` - Validate token, increment wallet
- `POST /api/integrations/coupons/claim` - Create redemption if 4+ coupons
- `GET /api/integrations/coupons/wallet/:phone` - Get balance
- `POST /api/integrations/coupons/opt-out` - Set opted_in_marketing=0

### Authentication & Security
- Admin: session auth (existing middleware)
- Integration: `Authorization: Bearer <API_KEY>` header
- API key in `.env` as `N8N_API_KEY`
- HTTPS only in production
- Rate limits: 10/day consume, 5/day claim, reset midnight Istanbul
- Return 429 with Retry-After when exceeded
- PII masking in logs (last 4 digits phone, first/last 4 chars token)
- Webhook signature verification

## Token Specifications
- Format: 12 uppercase alphanumeric chars
- Generation: Cryptographically secure random
- Collision: Retry up to 3 times
- Expiration: 24 hours
- Single-use: Status 'issued' → 'used'
- Cleanup: Daily 3AM, delete expired (7d) and used (90d)

## Redemption Lifecycle
- pending: Created on "kupon kullan" with 4+ coupons
- completed: Staff marks complete after service
- rejected: Staff rejects with note, refunds 4 coupons
- Auto-expire: 30 days, refund coupons
- Idempotent: Duplicate claims return existing ID


## Turkish Message Templates

### Customer Messages
- **Coupon awarded**: "✅ Kuponunuz eklendi! Toplam: X/4 kupon. 4 kupona ulaştığınızda 'kupon kullan' yazarak ücretsiz masajınızı alabilirsiniz."
- **Balance check**: "📊 Kupon durumunuz: X/4 kupon toplandı. Y kupon daha toplamanız gerekiyor."
- **Redemption success**: "🎉 Tebrikler! 4 kuponunuz kullanıldı. Redemption ID: <ID>. Resepsiyona bu kodu göstererek ücretsiz masajınızı alabilirsiniz."
- **Invalid token**: "❌ Bu kupon geçersiz veya kullanılmış. Lütfen resepsiyonla iletişime geçin."
- **Expired token**: "❌ Bu kuponun süresi dolmuş. Lütfen resepsiyonla iletişime geçin."
- **Insufficient coupons**: "📊 Henüz yeterli kuponunuz yok. Mevcut: X/4 kupon. Y kupon daha toplamanız gerekiyor."
- **Rate limit**: "⏳ Çok fazla istek gönderdiniz. Lütfen daha sonra tekrar deneyin."
- **Opt-out**: "✅ Pazarlama mesajlarından çıkarıldınız. Kupon sistemi normal şekilde çalışmaya devam edecek."

### Staff Notifications
- **New redemption**: "🔔 Yeni kupon kullanımı! Müşteri: <PHONE_MASKED> | Redemption ID: <ID> | Tarih: <TIMESTAMP>"
- **Completed**: "✅ Kupon kullanımı tamamlandı. Redemption ID: <ID> | Tamamlayan: <ADMIN_USERNAME>"
- **Rejected**: "❌ Kupon kullanımı reddedildi. Redemption ID: <ID> | Sebep: <NOTE>"
- **Abuse**: "⚠️ Şüpheli aktivite tespit edildi. Telefon: <PHONE_MASKED> | Detay: <DETAILS>"
- **Daily summary**: "📈 Günlük özet: <COUNT> kupon verildi, <COUNT> kullanım yapıldı."

## n8n Workflows (MVP)

### Workflow A: Coupon Capture
1. Trigger: WhatsApp webhook, verify Meta signature
2. Filter: Message starts with `KUPON`
3. Deduplicate: Cache phone+token for 60s
4. Normalize: E.164 phone, parse 12-char token
5. POST `/api/integrations/coupons/consume` with API key
6. Retry: 3x with exponential backoff
7. Success: Reply with Turkish template
8. Errors: 401/403 (auth), 429 (rate limit), 400 (invalid), 500 (generic)
9. Backend logs `coupon_awarded` event

### Workflow B: Claim Redemption
1. Trigger: WhatsApp webhook, verify signature
2. Filter: Message equals `kupon kullan`
3. Deduplicate: Cache phone for 5min
4. Normalize: E.164 phone
5. POST `/api/integrations/coupons/claim` with API key
6. Retry: 3x with backoff
7. Success: Reply customer + notify staff group
8. Insufficient: Reply with balance
9. Backend logs `redemption_attempt` and `redemption_granted`/`redemption_blocked`

### Workflow C: Balance Check
1. Trigger: WhatsApp webhook
2. Filter: Message equals `durum`
3. GET `/api/integrations/coupons/wallet/:phone`
4. Reply with balance or "no coupons yet"

### Workflow D: Opt-Out
1. Trigger: WhatsApp webhook
2. Filter: Message equals `iptal`
3. POST `/api/integrations/coupons/opt-out`
4. Reply with confirmation

### Idempotency
- n8n: In-memory cache (60s tokens, 5min claims)
- Backend: Token status check, pending redemption check
- All endpoints return same result for duplicates

### Event Logging
- `issued`: Token created
- `coupon_awarded`: Token consumed (phone, token, balance)
- `redemption_attempt`: Customer sends "kupon kullan"
- `redemption_granted`: Redemption created
- `redemption_blocked`: Failed (reason: insufficient, rate_limit, etc.)

## Raspberry Pi n8n Install

```bash
sudo apt update && sudo apt install -y build-essential
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g n8n

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

Expose via nginx/Caddy with HTTPS.

## WhatsApp Setup
- Single business number
- Webhook: `https://<domain>/webhook` (n8n)
- Subscribe to `messages` events
- Store secrets in n8n credentials
- Verify webhook signatures

## Non-Functional Requirements

### Performance
- 99.5% uptime (9 AM - 10 PM Istanbul)
- n8n replies within 5 seconds
- Backend API within 500ms
- Handle 100 req/min

### Monitoring
- Alert: n8n service down
- Alert: 5 consecutive backend errors
- Alert: Database > 1 GB
- Alert: TLS expires within 30 days
- Alert: Rate limit rejections > 50/hour

### Backup
- Daily 2:00 AM Istanbul
- SQLite database + n8n workflows
- Retain 30 days
- Store in `/var/backups/coupon-system/`

### Timezone
- All jobs: Europe/Istanbul
- Rate limits reset: midnight Istanbul
- Auto DST adjustment
- Store UTC, display Istanbul

## Implementation Checklist
- [ ] Add 5 tables to `schema.sql` + types
- [ ] Add DB helpers in `DatabaseService`
- [ ] Add admin routes (session auth)
- [ ] Add integration routes (API key auth)
- [ ] Implement rate limiting middleware
- [ ] Add token cleanup cron (3 AM)
- [ ] Add redemption expiration cron (3 AM)
- [ ] Add admin UI page (issue, wallet, redemptions)
- [ ] Build 4 n8n workflows
- [ ] Configure WhatsApp webhook
- [ ] Set up n8n systemd service
- [ ] Configure nginx/Caddy HTTPS
- [ ] Add Turkish i18n templates
- [ ] Set up monitoring/alerting
- [ ] Configure backups
- [ ] Test with sandbox number

## Phase 2 (Future)
- Off-peak double coupons
- Referral system
- Post-visit follow-up
- Birthday rewards, VIP tiers
