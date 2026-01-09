# Design Document

## Overview

The WhatsApp Coupon System is a loyalty program that integrates with the existing spa kiosk application to enable customers to collect digital coupons via WhatsApp messaging and redeem them for free services. The system uses n8n workflow automation to process WhatsApp messages from the Meta Cloud API and communicates with the backend Express.js server to manage coupon tokens, customer wallets, and redemptions.

The architecture follows a three-tier model:
1. **WhatsApp + n8n Layer**: Handles customer interactions, message parsing, and workflow orchestration
2. **Backend API Layer**: Manages business logic, data validation, and database operations
3. **Admin Interface Layer**: Provides staff tools for token issuance, redemption management, and customer support

Key design principles:
- **Idempotency**: All operations are safe to retry without side effects
- **Security**: API key authentication, rate limiting, PII masking, HTTPS enforcement
- **Auditability**: Complete event logging for compliance and dispute resolution
- **Simplicity**: Minimal operational overhead with automated cleanup and monitoring

## Architecture

### System Components

```
Customer (WhatsApp) -> Meta Cloud API Webhook -> n8n (workflows) -> Backend API (HTTPS + API key) -> SQLite
Admin Panel (session auth) -> Backend API -> SQLite
Reverse proxy (nginx/Caddy) terminates TLS in front of n8n and Backend
```

### Data Flow

**Token Issuance Flow:**
1. Staff clicks "Issue Token" in admin interface
2. Backend generates a 10-character uppercase alphanumeric token with collision retry
3. Backend stores token with status='issued', expires_at=now+24h
4. Backend logs 'issued' event
5. Backend returns token + WhatsApp deep link
6. Admin interface displays QR code for customer to scan

**Coupon Collection Flow:**
1. Customer scans QR, WhatsApp opens with pre-filled message "KUPON <TOKEN>"
2. Customer sends message
3. Meta Cloud API delivers webhook to n8n
4. n8n verifies signature, normalizes phone to E.164
5. n8n checks deduplication cache (60s TTL)
6. n8n POSTs to `/api/integrations/coupons/consume` with API key
7. Backend validates token (status='issued', not expired)
8. Backend increments wallet.coupon_count, updates token status='used'
9. Backend logs 'coupon_awarded' event
10. Backend returns balance
11. n8n replies to customer with Turkish message

**Redemption Flow:**
1. Customer sends "kupon kullan"
2. n8n processes message, checks deduplication (5min TTL)
3. n8n POSTs to `/api/integrations/coupons/claim`
4. Backend checks wallet.coupon_count >= 4
5. Backend checks for existing pending redemption (idempotency)
6. Backend subtracts 4 coupons, creates redemption with status='pending'
7. Backend logs 'redemption_granted' event
8. Backend returns redemption ID
9. n8n replies to customer with confirmation
10. n8n sends notification to staff WhatsApp group
11. Staff marks redemption complete in admin interface after service delivery

### Technology Stack

- **WhatsApp Integration**: Meta Cloud API (webhook-based)
- **Workflow Automation**: n8n (self-hosted on Raspberry Pi)
- **Backend**: Express.js + TypeScript
- **Database**: SQLite with better-sqlite3
- **Frontend**: React + TypeScript + Vite
- **Reverse Proxy**: nginx or Caddy (HTTPS termination)
- **Process Management**: systemd (n8n), PM2 (backend)
- **Deployment**: Raspberry Pi OS Bookworm (arm64)

## Components and Interfaces

### Backend Services

#### CouponService
Manages core coupon business logic.

**Methods:**
- `issueToken(kioskId: string, issuedFor?: string): Promise<CouponToken>` - Generate new 10-char token with collision retry
- `consumeToken(phone: string, token: string): Promise<{ ok: boolean, balance: number, remainingToFree: number }>` - Validate and consume token in an atomic transaction, increment wallet (idempotent)
- `getWallet(phone: string): Promise<CouponWallet | null>` - Retrieve wallet by phone
- `claimRedemption(phone: string): Promise<{ ok: boolean, redemptionId?: string, balance?: number, needed?: number }>` - Create redemption if eligible (idempotent)
- `completeRedemption(redemptionId: string, adminUsername: string): Promise<void>` - Mark redemption complete
- `optOut(phone: string): Promise<void>` - Set opted_in_marketing=0
- `cleanupExpiredTokens(): Promise<number>` - Mark issued tokens past expiry as expired (idempotent)

#### RateLimitService
Manages rate limiting with SQLite persistence.

**Methods:**
- `checkLimit(phone: string, endpoint: string, limit: number): Promise<{ allowed: boolean, retryAfter?: number }>` - Check if request allowed
- `incrementCounter(phone: string, endpoint: string): Promise<void>` - Increment counter
- `resetExpiredCounters(): Promise<void>` - Clean up expired counters

#### EventLogService
Logs all coupon-related events for audit trail.

**Methods:**
- `logEvent(event: CouponEvent): Promise<void>` - Log event to database
- `getEventsByPhone(phone: string, limit?: number): Promise<CouponEvent[]>` - Retrieve event history

### API Routes

#### Admin Routes (Session Auth)
- `POST /api/admin/coupons/issue` - Issue new token
- `GET /api/admin/coupons/wallet/:phone` - Get wallet details
- `GET /api/admin/coupons/redemptions` - List redemptions (query: status, limit, offset)
- `POST /api/admin/coupons/redemptions/:id/complete` - Complete redemption
- `GET /api/admin/coupons/events/:phone` - Get event history

#### Integration Routes (API Key Auth)
- `POST /api/integrations/coupons/consume` - Consume token (body: phone, token)
- `POST /api/integrations/coupons/claim` - Claim redemption (body: phone)
- `GET /api/integrations/coupons/wallet/:phone` - Get wallet balance
- `POST /api/integrations/coupons/opt-out` - Opt out of marketing (body: phone)

### Middleware

#### apiKeyAuth
Validates `Authorization: Bearer <API_KEY>` header for integration endpoints.

**Logic:**
1. Extract token from Authorization header
2. Compare with `process.env.N8N_API_KEY`
3. Return 401 if missing or invalid
4. Attach `req.apiClient = 'n8n'` for logging

#### couponRateLimit
Rate limiting middleware using RateLimitService.

**Configuration:**
- `/api/integrations/coupons/consume`: 10 requests/day per phone
- `/api/integrations/coupons/claim`: 5 requests/day per phone
- Reset at midnight Europe/Istanbul (DST-aware)

**Logic:**
1. Extract phone from request body
2. Determine endpoint from req.path
3. Check rate limit via RateLimitService
4. If exceeded, return 429 with Retry-After header
5. If allowed, increment counter and continue

## Security, Monitoring, and Operations

- **TLS Everywhere**: WhatsApp webhooks and backend endpoints are served via HTTPS behind nginx/Caddy; HTTP is redirected.
- **Authentication**: Admin routes require an authenticated session; integration routes require `Authorization: Bearer <secret>` configured in env and rotated periodically.
- **Webhook Verification**: n8n verifies Meta Cloud API webhook signatures before processing.
- **PII Masking**: Database stores full phone/token; application logs mask phone to last 4 digits and tokens to first/last 4 characters.
- **Backups**: SQLite database and n8n workflow exports are backed up daily with a documented restore procedure.
- **Health Checks**: Backend exposes a health endpoint covering DB connectivity; alerts trigger on repeated failures for consume/claim or health checks.
- **Time Zones**: Rate-limit resets and cron jobs use `Europe/Istanbul`, accounting for DST changes automatically.

### n8n Workflows

#### Coupon Capture Workflow
**Trigger**: WhatsApp webhook (POST)
**Nodes**:
1. Webhook trigger (verify Meta signature)
2. Filter (message starts with "KUPON")
3. Function: Parse phone (E.164) and token
4. Function: Check deduplication cache
5. HTTP Request: POST /api/integrations/coupons/consume
6. Switch: Handle response codes (200, 400, 429, 500)
7. WhatsApp Send: Reply with appropriate Turkish message
8. Function: Update deduplication cache

**Deduplication**: In-memory Map with phone+token as key, 60s TTL

#### Claim Redemption Workflow
**Trigger**: WhatsApp webhook (POST)
**Nodes**:
1. Webhook trigger (verify Meta signature)
2. Filter (message equals "kupon kullan")
3. Function: Parse phone (E.164)
4. Function: Check deduplication cache
5. HTTP Request: POST /api/integrations/coupons/claim
6. Switch: Handle response (ok: true/false)
7. WhatsApp Send: Reply to customer
8. WhatsApp Send: Notify staff group (if ok: true)
9. Function: Update deduplication cache

**Deduplication**: In-memory Map with phone as key, 5min TTL

#### Balance Check Workflow
**Trigger**: WhatsApp webhook (POST)
**Nodes**:
1. Webhook trigger
2. Filter (message equals "durum")
3. Function: Parse phone
4. HTTP Request: GET /api/integrations/coupons/wallet/:phone
5. Switch: Handle response (200, 404)
6. WhatsApp Send: Reply with balance

#### Opt-Out Workflow
**Trigger**: WhatsApp webhook (POST)
**Nodes**:
1. Webhook trigger
2. Filter (message equals "iptal")
3. Function: Parse phone
4. HTTP Request: POST /api/integrations/coupons/opt-out
5. WhatsApp Send: Reply with confirmation

### Message Templates (Turkish)
- **Coupon awarded**: `Kuponun kullanıldı! Şu an {balance}/4 kuponun var. 4'e ulaştığında "kupon kullan" yaz.` 
- **Invalid/expired token**: `Bu kupon geçerli değil veya süresi dolmuş. Lütfen resepsiyonla iletişime geç.` 
- **Rate limited**: `Çok sık deneme yaptın. Lütfen daha sonra tekrar dene.` 
- **Balance check**: `Şu an {balance}/4 kuponun var. 4 olduğunda "kupon kullan" yaz.` 
- **Insufficient for claim**: `Şu an {balance}/4 kuponun var. Ücretsiz masaj için {needed} kupona daha ihtiyacın var.` 
- **Claim success**: `Talebin alındı! Kodun: {redemptionId}. Resepsiyon seni yönlendirecek.` 
- **Opt-out confirm**: `Bildirimleri kapattık. Kupon kazanımı ve kullanımı normal devam eder.` 
- **Generic error**: `Şu anda işlemi tamamlayamadık. Lütfen biraz sonra tekrar dene veya resepsiyonla konuş.` 

### Frontend Components

#### CouponIssuePage
Admin page for issuing tokens.

**Features**:
- Button to generate new token
- Display token in large font
- Copy button for WhatsApp text
- QR code display (using qrcode library)
- Recent tokens list (last 10)

#### CouponRedemptionsPage
Admin page for managing redemptions.

**Features**:
- Table of redemptions with filters (status: pending/completed)
- Columns: Phone (masked), Redemption ID, Created, Status, Actions
- Complete button (opens confirmation modal)
- Event history link per redemption

#### CouponWalletLookupPage
Admin page for customer support.

**Features**:
- Phone number input (E.164 format)
- Display wallet details (balance, total earned, total redeemed, opt-in status)
- Event history table

## Data Models

### Database Schema

#### coupon_tokens
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
CREATE INDEX IF NOT EXISTS idx_coupon_tokens_status ON coupon_tokens(status);
CREATE INDEX IF NOT EXISTS idx_coupon_tokens_expires ON coupon_tokens(expires_at);
```

**Fields**:
- `token`: 10-character uppercase alphanumeric, primary key
- `status`: 'issued' (default), 'used', 'expired'
- `issued_for`: Optional reference to massage session or campaign
- `kiosk_id`: Identifier of kiosk that issued token
- `phone`: E.164 phone number (filled when used)
- `expires_at`: Expiration timestamp (24 hours from creation)
- `used_at`: Timestamp when token was consumed
- `created_at`, `updated_at`: Audit timestamps

#### coupon_wallets
```sql
CREATE TABLE IF NOT EXISTS coupon_wallets (
  phone TEXT PRIMARY KEY,
  coupon_count INTEGER DEFAULT 0,
  total_earned INTEGER DEFAULT 0,
  total_redeemed INTEGER DEFAULT 0,
  opted_in_marketing INTEGER DEFAULT 0,
  last_message_at DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_coupon_wallets_phone ON coupon_wallets(phone);
```

**Fields**:
- `phone`: E.164 phone number, primary key
- `coupon_count`: Current balance (0-N)
- `total_earned`: Lifetime coupons earned
- `total_redeemed`: Lifetime coupons redeemed
- `opted_in_marketing`: 0 or 1 (default 0)
- `last_message_at`: Last WhatsApp interaction timestamp
- `updated_at`: Last modification timestamp

#### coupon_redemptions
```sql
CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  coupons_used INTEGER DEFAULT 4,
  status TEXT CHECK(status IN ('pending','completed')) DEFAULT 'pending',
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  notified_at DATETIME,
  completed_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_phone ON coupon_redemptions(phone);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_status ON coupon_redemptions(status);
```

**Fields**:
- `id`: UUID v4, primary key
- `phone`: E.164 phone number
- `coupons_used`: Number of coupons used (default 4)
- `status`: 'pending' (default) or 'completed'
- `note`: Optional note for staff context
- `created_at`: Creation timestamp
- `notified_at`: When staff was notified (for audit)
- `completed_at`: When marked complete

#### coupon_events
```sql
CREATE TABLE IF NOT EXISTS coupon_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT,
  event TEXT,
  token TEXT,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_coupon_events_phone ON coupon_events(phone);
CREATE INDEX IF NOT EXISTS idx_coupon_events_created ON coupon_events(created_at);
```

**Fields**:
- `id`: Auto-increment integer
- `phone`: E.164 phone number (masked in logs)
- `event`: Event type (issued, coupon_awarded, redemption_attempt, redemption_granted, redemption_blocked)
- `token`: Token involved (masked in logs)
- `details`: JSON string with additional context
- `created_at`: Event timestamp

**Event Types**:
- `issued`: Token created by admin
- `coupon_awarded`: Token successfully consumed
- `redemption_attempt`: Customer sent "kupon kullan"
- `redemption_granted`: Redemption created
- `redemption_blocked`: Redemption failed (insufficient coupons, rate limit, etc.)

#### coupon_rate_limits
```sql
CREATE TABLE IF NOT EXISTS coupon_rate_limits (
  phone TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  count INTEGER DEFAULT 1,
  reset_at DATETIME NOT NULL,
  PRIMARY KEY (phone, endpoint)
);
CREATE INDEX IF NOT EXISTS idx_coupon_rate_limits_reset ON coupon_rate_limits(reset_at);
```

**Fields**:
- `phone`: E.164 phone number
- `endpoint`: Endpoint identifier ('consume' or 'claim')
- `count`: Current request count
- `reset_at`: Midnight Istanbul time when counter resets
- Composite primary key on (phone, endpoint)

### TypeScript Interfaces

```typescript
interface CouponToken {
  token: string;
  status: 'issued' | 'used' | 'expired';
  issuedFor?: string;
  kioskId?: string;
  phone?: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface CouponWallet {
  phone: string;
  couponCount: number;
  totalEarned: number;
  totalRedeemed: number;
  optedInMarketing: boolean;
  lastMessageAt?: Date;
  updatedAt: Date;
}

interface CouponRedemption {
  id: string;
  phone: string;
  couponsUsed: number;
  status: 'pending' | 'completed';
  note?: string;
  createdAt: Date;
  notifiedAt?: Date;
  completedAt?: Date;
}

interface CouponEvent {
  id: number;
  phone?: string;
  event: 'issued' | 'coupon_awarded' | 'redemption_attempt' | 'redemption_granted' | 'redemption_blocked';
  token?: string;
  details?: Record<string, any>;
  createdAt: Date;
}

interface RateLimit {
  phone: string;
  endpoint: 'consume' | 'claim';
  count: number;
  resetAt: Date;
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Token Generation Uniqueness
*For any* sequence of token generation requests, all generated tokens should be unique (no duplicates).
**Validates: Requirements 1.1, 17.1**

### Property 2: Token Expiration Calculation
*For any* generated token, the expiration timestamp should be exactly 24 hours after the creation timestamp.
**Validates: Requirements 1.4**

### Property 3: WhatsApp Deep Link Format
*For any* generated token, the returned WhatsApp URL should match the format `https://wa.me/<NUMBER>?text=KUPON%20<TOKEN>` where TOKEN is the generated token.
**Validates: Requirements 1.3**

### Property 4: Phone Number Normalization
*For any* phone number input (in various formats), normalizing it should produce a valid E.164 format string starting with '+' followed by digits.
**Validates: Requirements 2.2, 8.2**

### Property 5: Phone Lookup Normalization
*For any* wallet lookup by phone number, normalization should allow lookups regardless of input format (with/without '+', country code).
**Validates: Requirements 8.4**

### Property 6: Token Status Validation
*For any* token consumption request, only tokens with status='issued' should pass validation; tokens with status='used' or 'expired' should be rejected.
**Validates: Requirements 7.1, 7.3**

### Property 7: Token Expiration Validation
*For any* token consumption request, tokens with expires_at in the past should be rejected with an expiration error.
**Validates: Requirements 7.2, 7.4**

### Property 8: Token Consumption State Update
*For any* successful token consumption, the token status should be updated to 'used', the phone number should be recorded, and used_at should be set to the current timestamp.
**Validates: Requirements 7.5**

### Property 9: Token Consumption Idempotency
*For any* valid token, consuming it multiple times should only increment the wallet balance once, and subsequent attempts should return the same balance without further increments.
**Validates: Requirements 2.4, 17.2, 17.5**

### Property 10: Token Format Validation
*For any* generated token, it should be exactly 10 characters long and contain only uppercase letters (A-Z) and digits (0-9).
**Validates: Requirements 17.1**

### Property 11: Token Collision Retry
*For any* token generation that encounters a collision (duplicate token), the system should retry generation until a unique token is created or the request fails.
**Validates: Requirements 17.1**

### Property 12: Token Auto-Expiration
*For any* token past its expiration timestamp with status='issued', scheduled cleanup should mark it as 'expired'.
**Validates: Requirements 17.4**

### Property 13: E.164 Storage Format
*For any* wallet creation or update, the phone number should be stored in E.164 format (starting with '+' followed by digits only).
**Validates: Requirements 8.3, 8.5**

### Property 14: Balance Reply Instructions
*For any* balance response where a customer has 4 or more coupons, the message should include instructions to send "kupon kullan" to redeem.
**Validates: Requirements 3.4**

### Property 15: Coupon Claim Subtraction
*For any* wallet with 4 or more coupons, successfully claiming a redemption should subtract exactly 4 coupons from the balance.
**Validates: Requirements 4.2**

### Property 16: Redemption Creation Uniqueness
*For any* successful claim operation, a redemption record should be created with a unique identifier and status 'pending'.
**Validates: Requirements 4.3**

### Property 17: Claim Idempotency
*For any* phone number with a pending redemption, attempting to claim again should return the existing redemption ID without creating a new redemption or subtracting coupons again.
**Validates: Requirements 17.3**

### Property 18: Pending Redemptions Filter
*For any* query for redemptions with status filter 'pending', all returned redemptions should have status='pending'.
**Validates: Requirements 5.1**

### Property 19: Redemption Completion
*For any* pending redemption, marking it complete should update the status to 'completed' and set the completed_at timestamp to the current time.
**Validates: Requirements 5.2**

### Property 20: Event Logging for Token Issuance
*For any* token issuance operation, an event record with type 'issued' should be created containing the token identifier.
**Validates: Requirements 6.1**

### Property 21: Event Logging for Token Consumption
*For any* successful token consumption, an event record with type 'coupon_awarded' should be created containing the phone number and token identifier.
**Validates: Requirements 6.2**

### Property 22: Event Logging for Redemption Attempts
*For any* redemption claim attempt, an event record with type 'redemption_attempt' should be created containing the phone number.
**Validates: Requirements 6.3**

### Property 23: Event Logging for Granted Redemptions
*For any* successful redemption creation, an event record with type 'redemption_granted' should be created containing the redemption identifier.
**Validates: Requirements 6.4**

### Property 24: Event Logging for Blocked Redemptions
*For any* failed redemption attempt due to insufficient coupons, an event record with type 'redemption_blocked' should be created containing the phone number and reason.
**Validates: Requirements 6.5**

### Property 25: Consume Endpoint Rate Limiting
*For any* phone number, the 11th consume request within a 24-hour period should be rejected with HTTP 429 status.
**Validates: Requirements 9.1, 9.3**

### Property 26: Claim Endpoint Rate Limiting
*For any* phone number, the 6th claim request within a 24-hour period should be rejected with HTTP 429 status.
**Validates: Requirements 9.2, 9.3**

### Property 27: Rate Limit Counter Reset
*For any* rate limit counter, when the reset_at timestamp is reached (midnight Istanbul time, DST-aware), the counter should be cleared or reset to 0.
**Validates: Requirements 9.5**

### Property 28: Opt-Out Operation
*For any* wallet, calling the opt-out operation should set opted_in_marketing to 0 and update the updated_at timestamp.
**Validates: Requirements 10.2**

### Property 29: Opt-Out Does Not Affect Coupons
*For any* wallet with opted_in_marketing=0, token consumption should still increment the coupon count normally.
**Validates: Requirements 10.5**

### Property 30: Admin Session Authentication
*For any* request to admin coupon endpoints without a valid authenticated session, the request should be rejected with HTTP 401 status.
**Validates: Requirements 16.1**

### Property 31: API Key Authentication
*For any* request to integration endpoints without a valid API key in the Authorization header, the request should be rejected with HTTP 401 status.
**Validates: Requirements 16.1**

### Property 32: HTTPS and Webhook Verification
*For any* external webhook or API endpoint, HTTPS must be required and Meta webhook signatures must be verified before processing.
**Validates: Requirements 12.3, 16.2**

### Property 33: PII Masking in Logs
*For any* logged event containing a phone number or token, the values should be masked (phone shows last 4 digits; token shows first/last 4 characters).
**Validates: Requirements 16.3**

### Property 34: Backups Exist
*For any* production day, there should be at least one backup artifact for the SQLite database and n8n workflows with a defined restore process.
**Validates: Requirements 16.4**

### Property 35: Health Check Reporting
*For any* health check request, the endpoint should reflect backend and database availability and surface failures for alerting.
**Validates: Requirements 16.5**

### Property 36: n8n Service Reliability
*For any* Raspberry Pi boot or crash, the n8n systemd service should start automatically and restart after failure.
**Validates: Requirements 11.1, 11.2**

### Property 37: n8n Port and Auth
*For any* n8n start, the service should bind to port 5678 with basic authentication enabled.
**Validates: Requirements 11.3**

### Property 38: Webhook Exposure
*For any* running environment, n8n webhook endpoints should be reachable via HTTPS through the reverse proxy.
**Validates: Requirements 11.4, 12.1**

### Property 39: Webhook Delivery and Signature
*For any* inbound WhatsApp message, Meta should deliver to the configured n8n webhook within expected latency and n8n should verify the signature using the app secret.
**Validates: Requirements 12.2, 12.3**

### Property 40: Unmatched Message Handling
*For any* message that does not match expected keywords, the workflow should ignore it without replying.
**Validates: Requirements 15.1**

### Property 41: Friendly Error Replies
*For any* backend error response, n8n should reply to the customer with a user-friendly Turkish message.
**Validates: Requirements 15.2**

### Property 42: Network Retry Policy
*For any* network error calling the backend, n8n should retry the request up to 3 times with exponential backoff.
**Validates: Requirements 15.3**

### Property 43: Invalid or Expired Token Reply
*For any* invalid or expired token submission, n8n should reply instructing the customer to contact reception.
**Validates: Requirements 15.4**

### Property 44: Insufficient Coupon Reply
*For any* redemption attempt with insufficient coupons, n8n should reply with the current balance and how many more coupons are needed.
**Validates: Requirements 15.5**

## Error Handling

### Token Generation Errors
- **Collision Exhaustion**: After 3 failed collision retries, return HTTP 500 with error message "Failed to generate unique token after 3 attempts"
- **Database Error**: If token insertion fails, return HTTP 500 with generic error message, log full error server-side

### Token Consumption Errors
- **Invalid Token**: Return HTTP 400 with error code "INVALID_TOKEN" and message "Token is invalid or has already been used"
- **Expired Token**: Return HTTP 400 with error code "EXPIRED_TOKEN" and message "Token has expired"
- **Rate Limit Exceeded**: Return HTTP 429 with Retry-After header set to seconds until midnight Istanbul time
- **Database Error**: Return HTTP 500 with generic error message

### Redemption Claim Errors
- **Insufficient Coupons**: Return HTTP 400 with error code "INSUFFICIENT_COUPONS", current balance, and coupons needed
- **Rate Limit Exceeded**: Return HTTP 429 with Retry-After header
- **Database Error**: Return HTTP 500 with generic error message

### Authentication Errors
- **Missing Session**: Return HTTP 401 with error message "Authentication required"
- **Invalid API Key**: Return HTTP 401 with error message "Invalid API key"
- **Expired Session**: Return HTTP 401 with error message "Session expired"

### Validation Errors
- **Missing Required Field**: Return HTTP 400 with error message specifying which field is missing
- **Invalid Phone Format**: Return HTTP 400 with error message "Invalid phone number format"
- **Invalid Redemption ID**: Return HTTP 404 with error message "Redemption not found"

### Error Response Format
All error responses follow this JSON structure:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Optional additional context
    }
  }
}
```

### Error Logging
- All errors are logged with severity level (ERROR, WARN, INFO)
- PII (phone numbers, tokens) are masked in logs
- Stack traces are logged server-side but never sent to clients
- Error IDs are generated for correlation between client and server logs

## Testing Strategy

### Unit Testing
Unit tests will verify specific examples, edge cases, and error conditions for individual functions and services.

**Test Coverage:**
- Token generation with collision scenarios
- Phone number normalization with various input formats
- Rate limiting edge cases (exactly at limit, just over limit)
- Timezone calculations (midnight, DST transitions)
- PII masking functions
- Validation functions (token format, phone format, required fields)

**Example Unit Tests:**
- `CouponService.issueToken()` with mocked database returning collision, verify retry logic
- `PhoneNormalizer.normalize()` with inputs like "5551234567", "+905551234567", "905551234567"
- `RateLimitService.checkLimit()` at exactly 10 requests, verify 11th is blocked
- `MaskingUtil.maskPhone()` with various phone lengths
- `TokenValidator.validate()` with expired token, used token, invalid format

### Property-Based Testing
Property-based tests will verify universal properties that should hold across all inputs using a PBT library.

**PBT Library**: fast-check (JavaScript/TypeScript property-based testing library)

**Configuration**: Each property test will run a minimum of 100 iterations with randomly generated inputs.

**Test Tagging**: Each PBT test will include a comment with the format:
```typescript
// Feature: whatsapp-coupon-system, Property 1: Token Generation Uniqueness
```

**Property Tests:**

1. **Token Uniqueness** (Property 1)
   - Generate N tokens, verify all are unique
   - Validates: Requirements 1.1, 17.1

2. **Token Expiration** (Property 2)
   - Generate token, verify expires_at = created_at + 24 hours
   - Validates: Requirements 1.4

3. **WhatsApp URL Format** (Property 3)
   - Generate token, verify URL matches regex pattern
   - Validates: Requirements 1.3

4. **Phone Normalization** (Property 4)
   - Generate random phone formats, verify all normalize to E.164
   - Validates: Requirements 2.2, 8.2

5. **Consumption Idempotency** (Property 9)
   - Consume same token twice, verify balance increments only once
   - Validates: Requirements 2.4, 17.2, 17.5

6. **Claim Subtraction** (Property 15)
   - Create wallet with N coupons (N >= 4), claim, verify balance = N - 4
   - Validates: Requirements 4.2

7. **Claim Idempotency** (Property 17)
   - Claim twice with same phone, verify same redemption ID returned, balance unchanged on second call
   - Validates: Requirements 17.3

8. **Event Logging Completeness** (Properties 20-24)
   - Perform operation, verify corresponding event exists in database
   - Validates: Requirements 6.1-6.5

9. **Token Validation** (Properties 6-8, 10-12)
   - Generate tokens with various statuses and expiration times, verify only valid ones pass and expired ones are marked
   - Validates: Requirements 7.1-7.5, 17.1, 17.4

10. **Rate Limiting** (Properties 25-27)
    - Make N+1 requests, verify Nth+1 is rejected with 429 and reset aligns with Istanbul midnight
    - Validates: Requirements 9.1-9.3, 9.5

11. **PII Masking** (Property 33)
    - Log events with phone/token, verify logged values are masked
    - Validates: Requirements 16.3

12. **Token Format** (Property 10)
    - Generate many tokens, verify all match format regex
    - Validates: Requirements 17.1

13. **Cleanup Operations** (Property 12)
    - Create tokens with various ages, run cleanup, verify past-due issued tokens are marked expired
    - Validates: Requirements 17.4

14. **Opt-Out Flow** (Properties 28-29)
    - Opt out and verify marketing flag and coupon increment behavior
    - Validates: Requirements 10.2, 10.5

15. **Error Handling & Messaging** (Properties 40-44)
    - Exercise unmatched, invalid token, insufficient coupons, backend error, and network retry cases
    - Validates: Requirements 15.1-15.5

16. **Auth and TLS** (Properties 30-32)
    - Attempt admin/integration calls without auth and with HTTP, verify rejection and signature verification paths
    - Validates: Requirements 12.3, 16.1, 16.2

17. **Service Reliability** (Properties 36-39)
    - Verify n8n systemd behavior, port/auth binding, webhook reachability, and Meta signature checks
    - Validates: Requirements 11.1-11.4, 12.1-12.3

### Integration Testing
Integration tests will verify the interaction between components (n8n workflows, backend API, database).

**Test Scenarios:**
- End-to-end token issuance -> consumption -> wallet update flow
- End-to-end redemption claim -> staff notification -> completion flow
- Rate limiting across multiple requests
- Authentication and authorization for all endpoints
- Database transaction rollback on errors

### Test Data Management
- Use in-memory SQLite database for unit and property tests
- Reset database state between tests
- Use factories to generate test data (tokens, wallets, redemptions)
- Mock external dependencies (WhatsApp API, n8n webhooks)

### Continuous Integration
- Run all unit tests on every commit
- Run property tests on every pull request
- Run integration tests before deployment
- Maintain minimum 80% code coverage for services and routes






