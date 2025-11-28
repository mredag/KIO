# WhatsApp Coupon System - Environment Configuration

This document describes the environment variables required for the WhatsApp coupon system.

## Required Environment Variables

### N8N_API_KEY
**Purpose:** Authenticates requests from n8n workflows to the backend API integration endpoints.

**How to generate:**
```bash
openssl rand -base64 32
```

**Example:**
```env
N8N_API_KEY=dwsQf8q0BpFWXPqMhwy2SGLG/wHIw1hKyjW8eI4Cgd8=
```

**Security Notes:**
- Generate a unique key for each environment (dev, staging, production)
- Store the same key in n8n credentials configuration
- Rotate periodically (e.g., every 90 days)
- Never commit the actual key to version control

**Used by:**
- `backend/src/middleware/apiKeyAuth.ts` - Validates API key in Authorization header
- n8n workflows - Sends API key in HTTP requests to backend

---

### WHATSAPP_NUMBER
**Purpose:** Phone number used to generate WhatsApp deep links for coupon tokens.

**Format:** International format without the + prefix (e.g., `905551234567` for Turkey)

**Example:**
```env
WHATSAPP_NUMBER=905551234567
```

**How to obtain:**
1. Register for WhatsApp Business API through Meta
2. Get your WhatsApp Business phone number ID
3. Use the phone number associated with that ID

**Used by:**
- `backend/src/services/CouponService.ts` - Generates WhatsApp deep links in format:
  ```
  https://wa.me/905551234567?text=KUPON%20ABC123DEF456
  ```

---

### TZ (Timezone)
**Purpose:** Sets the timezone for rate limit resets and scheduled jobs.

**Value:** `Europe/Istanbul`

**Example:**
```env
TZ=Europe/Istanbul
```

**Why Istanbul?**
- Rate limits reset at midnight Istanbul time
- Scheduled cleanup jobs run at 3:00 AM Istanbul time
- Automatically handles Daylight Saving Time (DST) transitions

**Used by:**
- Node.js process - Sets default timezone for date operations
- `node-cron` - Schedules jobs at correct local time
- `backend/src/services/RateLimitService.ts` - Calculates midnight for rate limit resets

**Technical Details:**
- The RateLimitService uses `Intl.DateTimeFormat` with `timeZone: 'Europe/Istanbul'`
- This automatically handles DST transitions (UTC+3 in summer, UTC+2 in winter)
- All timestamps are stored in UTC in the database
- Timezone conversion happens at the application layer

---

## Configuration Checklist

### Development Environment
- [ ] Copy `backend/.env.example` to `backend/.env`
- [ ] Generate N8N_API_KEY: `openssl rand -base64 32`
- [ ] Set WHATSAPP_NUMBER to your test number
- [ ] Verify TZ=Europe/Istanbul is set
- [ ] Configure the same N8N_API_KEY in n8n credentials

### Production Environment
- [ ] Generate a new N8N_API_KEY (different from dev)
- [ ] Set WHATSAPP_NUMBER to production WhatsApp Business number
- [ ] Verify TZ=Europe/Istanbul is set
- [ ] Configure the same N8N_API_KEY in production n8n
- [ ] Test rate limit reset at midnight Istanbul time
- [ ] Verify scheduled jobs run at correct times

### n8n Configuration
In n8n, create a credential of type "Header Auth":
- **Name:** Backend API Key
- **Header Name:** Authorization
- **Header Value:** `Bearer <N8N_API_KEY>`

Use this credential in all HTTP Request nodes that call backend integration endpoints.

---

## Verification

### Test N8N_API_KEY
```bash
# Should return 401 Unauthorized
curl -X POST http://localhost:3001/api/integrations/coupons/consume \
  -H "Content-Type: application/json" \
  -d '{"phone": "+905551234567", "token": "ABC123DEF456"}'

# Should work (if token exists)
curl -X POST http://localhost:3001/api/integrations/coupons/consume \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_N8N_API_KEY" \
  -d '{"phone": "+905551234567", "token": "ABC123DEF456"}'
```

### Test WHATSAPP_NUMBER
1. Issue a token via admin interface
2. Verify the generated WhatsApp URL contains your WHATSAPP_NUMBER
3. Click the URL and verify WhatsApp opens with pre-filled message

### Test Timezone
```bash
# Check Node.js timezone
node -e "console.log(new Date().toString())"
# Should show "GMT+0300 (Turkey Time)" or similar

# Check rate limit reset calculation
# Create a rate limit counter and verify it resets at midnight Istanbul time
```

---

## Troubleshooting

### "Invalid API key" errors
- Verify N8N_API_KEY matches in both `.env` and n8n credentials
- Check for extra spaces or newlines in the key
- Ensure Authorization header format is: `Bearer <KEY>`

### WhatsApp link doesn't work
- Verify WHATSAPP_NUMBER is in correct format (no + prefix)
- Check the number is registered with WhatsApp Business API
- Test the URL manually in a browser

### Rate limits reset at wrong time
- Verify TZ=Europe/Istanbul is set in `.env`
- Restart the backend after changing TZ
- Check system timezone: `date` (should show Istanbul time)
- Verify DST is handled correctly during transitions

---

## Related Documentation

- **API Authentication:** `backend/src/middleware/README.md`
- **Rate Limiting:** `backend/src/services/RateLimitService.ts`
- **Coupon Service:** `backend/src/services/CouponService.ts`
- **n8n Workflows:** `n8n-workflows/README.md`
- **Deployment:** `deployment/raspberry-pi/README.md`

---

**Last Updated:** 2025-11-28
**Status:** ✅ Complete
