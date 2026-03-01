# WhatsApp Agent Tools

## kio_api

HTTP API tool for calling the KIO backend.

**Base URL:** `http://localhost:3001`
**Auth:** `X-API-Key` header (value from `N8N_API_KEY` environment variable)

All requests must include the `X-API-Key` header. All POST/PATCH requests must include `Content-Type: application/json`.

---

### Endpoints

#### 1. Ignore List Check

Check if a phone number is on the ignore list before processing any message.

```
GET /api/integrations/whatsapp/ignore-check/:phone
```

**Response:**
```json
{ "ignored": true }
```
or
```json
{ "ignored": false }
```

If `ignored: true`, do NOT respond to the message. Silently skip it.

---

#### 2. Knowledge Base Query

Fetch business information for generating responses.

```
GET /api/integrations/knowledge/context?categories=services,pricing,contact
```

**Available categories:** `services`, `pricing`, `hours`, `policies`, `contact`, `faq`, `general`

⚠️ **ALWAYS include `contact` category in every query** — this ensures the agent always has the correct phone number and address.

**Response:**
```json
{
  "entries": [
    {
      "id": 1,
      "category": "services",
      "key": "masaj_hizmetleri",
      "value": "...",
      "description": "..."
    }
  ]
}
```

---

#### 3. Coupon Operations

##### Consume a coupon token
```
POST /api/integrations/coupons/consume
```
**Body:**
```json
{
  "token": "ABC123",
  "phone": "+905551234567",
  "source": "whatsapp"
}
```
**Response:** Success or error with Turkish message.

##### Check wallet balance
```
GET /api/integrations/coupons/wallet/:phone
```
**Response:** Wallet balance and transaction history.

##### Claim a coupon
```
POST /api/integrations/coupons/claim
```
**Body:**
```json
{
  "phone": "+905551234567",
  "source": "whatsapp"
}
```
**Response:** Redemption status.

---

#### 4. Policy Validation

Validate the generated response against business rules before sending to customer.

```
POST /api/integrations/whatsapp/validate-response
```

**Body:**
```json
{
  "phone": "+905551234567",
  "customer_message": "masaj fiyatları ne kadar?",
  "agent_response": "Masaj fiyatlarımız...",
  "knowledge_context": "...",
  "model_used": "moonshotai/kimi-k2"
}
```

**Response:**
```json
{
  "valid": true
}
```
or
```json
{
  "valid": false,
  "corrected_response": "Düzeltilmiş yanıt...",
  "violation_type": "appointment_claim",
  "violation_details": "Agent claimed to book an appointment"
}
```

**Rules:**
- If `valid: false` and `corrected_response` exists → use the corrected response instead
- If `valid: false` and no `corrected_response` → use fallback: "Detaylı bilgi için bizi arayabilirsiniz: 0326 502 58 58 📞"

---

#### 5. Interaction Logging

Log every interaction (both inbound and outbound) after processing.

```
POST /api/integrations/whatsapp/interaction
```

**Body:**
```json
{
  "phone": "+905551234567",
  "direction": "inbound",
  "message_text": "masaj fiyatları ne kadar?",
  "intent": "services,pricing",
  "sentiment": "neutral",
  "ai_response": "Masaj fiyatlarımız...",
  "response_time_ms": 1500,
  "model_used": "moonshotai/kimi-k2",
  "tokens_estimated": 350,
  "model_tier": "standard",
  "media_type": "text",
  "message_id": "unique_msg_id"
}
```

**Fields:**
| Field | Required | Description |
|-------|----------|-------------|
| `phone` | Yes | Customer phone number |
| `direction` | Yes | `inbound` or `outbound` |
| `message_text` | Yes | Message content |
| `intent` | No | Detected intent categories (comma-separated) |
| `sentiment` | No | Message sentiment |
| `ai_response` | No | AI-generated response (outbound only) |
| `response_time_ms` | No | Response generation time in ms |
| `model_used` | No | Model identifier |
| `tokens_estimated` | No | Estimated token count |
| `model_tier` | No | `light`, `standard`, or `advanced` |
| `media_type` | No | `text`, `image`, `voice`, `location`, `document` |
| `message_id` | No | Unique message ID for deduplication |

**Response:**
```json
{ "success": true, "id": "..." }
```
or (duplicate):
```json
{ "duplicate": true }
```

---

#### 6. Appointment Requests

Create an appointment request after collecting customer preferences.

```
POST /api/integrations/whatsapp/appointment-requests
```

**Body:**
```json
{
  "phone": "+905551234567",
  "service_requested": "Aromaterapi masajı",
  "preferred_date": "Cumartesi",
  "preferred_time": "Öğleden sonra"
}
```

**Response:**
```json
{
  "success": true,
  "id": "...",
  "status": "pending"
}
```

⚠️ This only records the request. Staff will be notified via Telegram and will contact the customer directly on WhatsApp. Do NOT tell the customer their appointment is confirmed.

---

#### 7. Conversation History (Read-Only)

Fetch previous messages for context (useful for follow-up questions).

```
GET /api/integrations/whatsapp/conversation/:phone
```

**Response:** Array of interactions sorted chronologically (oldest first).

---

#### 8. Stats (Read-Only)

Get WhatsApp pipeline statistics.

```
GET /api/integrations/whatsapp/stats
```

**Response:** Message counts, response times, violation counts, etc.
