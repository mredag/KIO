# Coupon Capture Workflow

## Purpose

Processes WhatsApp messages containing coupon tokens that customers receive after massage sessions. When a customer sends a message in the format "KUPON <TOKEN>", this workflow validates the token, awards the coupon to their wallet, and replies with their current balance.

## Trigger

**Type**: WhatsApp Webhook (POST)  
**Path**: `/webhook/whatsapp-coupon`  
**Method**: POST

### Webhook Configuration

Configure in Meta Cloud API Dashboard:
- **Webhook URL**: `https://<your-domain>/webhook/whatsapp-coupon`
- **Verify Token**: Set during webhook setup
- **Subscribed Fields**: `messages`

## Workflow Nodes

### 1. WhatsApp Webhook (Trigger)
- Receives incoming WhatsApp messages from Meta Cloud API
- Returns immediate 200 OK response
- Passes message data to next node

### 2. Verify Signature
- **Type**: Function Node
- **Purpose**: Validates Meta webhook signature for security
- **Logic**:
  - Extracts `x-hub-signature-256` header
  - Computes HMAC-SHA256 hash of payload using app secret
  - Compares computed hash with received signature
  - Throws error if signatures don't match

### 3. Filter KUPON Messages
- **Type**: IF Node
- **Condition**: Message text starts with "KUPON"
- **True Path**: Continue to parse
- **False Path**: Ignore message (no response)

### 4. Parse Phone & Token
- **Type**: Function Node
- **Purpose**: Extracts and normalizes phone number and token
- **Logic**:
  - Extracts phone from `message.from`
  - Parses token using regex: `/KUPON\s+([A-Z0-9]{12})/i`
  - Normalizes phone to E.164 format (+90XXXXXXXXXX)
  - Returns error if token format is invalid

**Phone Normalization Rules**:
- Remove all non-digits
- Add +90 prefix if missing (Turkey)
- Handle formats: 05551234567, 905551234567, +905551234567

### 5. Check Deduplication
- **Type**: Function Node
- **Purpose**: Prevents duplicate processing of same message
- **Logic**:
  - Creates cache key: `${phone}:${token}`
  - Checks workflow static data for existing entry
  - Returns `isDuplicate: true` if found within 60s TTL
  - Cleans expired cache entries

**Cache TTL**: 60 seconds

### 6. Is Duplicate?
- **Type**: IF Node
- **Condition**: `isDuplicate === true`
- **True Path**: Skip API call, use cached balance
- **False Path**: Call backend API

### 7. Consume Token API
- **Type**: HTTP Request Node
- **Method**: POST
- **URL**: `http://localhost:3001/api/integrations/coupons/consume`
- **Authentication**: Backend API Key (Header Auth)
- **Body**:
  ```json
  {
    "phone": "{{$json.phone}}",
    "token": "{{$json.token}}"
  }
  ```
- **Retry**: 3 attempts with 1s wait between tries

### 8. Update Cache
- **Type**: Function Node
- **Purpose**: Stores result in deduplication cache
- **Logic**:
  - Saves balance with 60s expiration
  - Updates workflow static data

### 9. Response Handler
- **Type**: Switch Node
- **Routes**:
  1. **Success** (200): Token consumed successfully
  2. **Invalid Token** (400, code: INVALID_TOKEN): Token already used or doesn't exist
  3. **Expired Token** (400, code: EXPIRED_TOKEN): Token past expiration
  4. **Rate Limit** (429): Too many requests
  5. **Server Error** (500+): Backend error

### 10-14. Format Message Nodes
- **Type**: Function Nodes
- **Purpose**: Creates Turkish response messages for each scenario

**Messages**:
- **Success**: "✅ Kuponunuz eklendi! Toplam: X/4 kupon. [instructions]"
- **Invalid**: "❌ Bu kupon geçersiz veya kullanılmış. Lütfen resepsiyonla iletişime geçin."
- **Expired**: "❌ Bu kuponun süresi dolmuş. Lütfen resepsiyonla iletişime geçin."
- **Rate Limit**: "⏳ Çok fazla istek gönderdiniz. Lütfen daha sonra tekrar deneyin."
- **Error**: "❌ Şu anda işlemi tamamlayamadık. Lütfen biraz sonra tekrar deneyin veya resepsiyonla konuşun."

### 15. Send WhatsApp Reply
- **Type**: HTTP Request Node
- **Method**: POST
- **URL**: `https://graph.facebook.com/v18.0/{{phoneId}}/messages`
- **Authentication**: WhatsApp Business API (Header Auth)
- **Body**:
  ```json
  {
    "messaging_product": "whatsapp",
    "to": "{{$json.phone}}",
    "type": "text",
    "text": {
      "body": "{{$json.message}}"
    }
  }
  ```

### 16. Webhook Response
- **Type**: Respond to Webhook Node
- **Response**: `{"status": "ok"}`
- **Purpose**: Acknowledges webhook receipt to Meta

## Error Handling

### Invalid Signature
- Workflow stops immediately
- No response sent to customer
- Error logged in n8n execution history

### Invalid Token Format
- Returns error message to customer
- Instructs to contact reception

### Network Errors
- Automatic retry (3 attempts)
- Generic error message if all retries fail

### Rate Limiting
- Customer informed to try again later
- Retry-After information not exposed to customer

## Testing

### Local Testing with curl

```bash
# Test valid token
curl -X POST http://localhost:5678/webhook/whatsapp-coupon \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=<SIGNATURE>" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "905551234567",
            "text": {
              "body": "KUPON ABC123DEF456"
            }
          }]
        }
      }]
    }]
  }'

# Test invalid format
curl -X POST http://localhost:5678/webhook/whatsapp-coupon \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=<SIGNATURE>" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "905551234567",
            "text": {
              "body": "KUPON INVALID"
            }
          }]
        }
      }]
    }]
  }'
```

### Test Checklist

- [ ] Valid token consumption
- [ ] Invalid token (already used)
- [ ] Expired token
- [ ] Invalid token format
- [ ] Duplicate message (within 60s)
- [ ] Rate limit exceeded (11th request)
- [ ] Network error (backend down)
- [ ] Invalid webhook signature
- [ ] Turkish characters display correctly
- [ ] Phone normalization (various formats)

## Monitoring

### n8n Execution History
- View all executions in n8n UI
- Check execution time and status
- Review error messages

### Backend Logs
```bash
# Check coupon events
tail -f backend/logs/app.log | grep coupon

# Check rate limiting
tail -f backend/logs/app.log | grep "rate limit"
```

### Database Queries
```sql
-- Recent token consumptions
SELECT * FROM coupon_events 
WHERE event = 'coupon_awarded' 
ORDER BY created_at DESC 
LIMIT 10;

-- Failed attempts
SELECT * FROM coupon_events 
WHERE event = 'redemption_blocked' 
ORDER BY created_at DESC 
LIMIT 10;
```

## Troubleshooting

### Issue: Webhook not receiving messages

**Symptoms**: No executions in n8n UI

**Solutions**:
1. Verify webhook URL in Meta dashboard: `https://webhook.eformspa.com/api/whatsapp/webhook`
2. Check Cloudflare Tunnel is running: `systemctl status cloudflared`
3. Verify webhook subscription includes "messages" field
4. Check n8n logs for incoming requests

### Issue: Signature verification fails

**Symptoms**: "Invalid webhook signature" error

**Solutions**:
1. Verify app secret in n8n credentials matches Meta dashboard
2. Check webhook payload is not modified by proxy
3. Ensure Content-Type is application/json

### Issue: Backend returns 401

**Symptoms**: "Invalid API key" error

**Solutions**:
1. Verify API key in n8n credentials
2. Check Authorization header format: `Bearer <KEY>`
3. Verify backend .env has matching N8N_API_KEY

### Issue: Deduplication not working

**Symptoms**: Same message processed multiple times

**Solutions**:
1. Check workflow static data is enabled
2. Verify cache TTL (60s)
3. Clear workflow static data in n8n UI

### Issue: Turkish characters broken

**Symptoms**: Garbled text in WhatsApp

**Solutions**:
1. Ensure Content-Type includes charset=utf-8
2. Verify WhatsApp API supports UTF-8
3. Check message encoding in function nodes

## Performance

**Expected Latency**: < 2 seconds from message receipt to reply

**Bottlenecks**:
- Backend API response time
- WhatsApp API response time
- Network latency

**Optimization**:
- Deduplication cache reduces redundant API calls
- Retry logic handles transient failures
- Async webhook response prevents timeout

## Security

- ✅ Webhook signature verification (Meta Cloud API)
- ✅ API key authentication for backend
- ✅ HTTPS required for all endpoints
- ✅ PII masking in logs (phone numbers)
- ✅ Rate limiting at backend level

## Requirements Validated

- **2.2**: Phone number normalization to E.164
- **2.4**: Token consumption via backend API
- **19.4**: Idempotent token consumption with deduplication

## Related Documentation

- **Turkish Message Templates**: `n8n-workflows/docs/turkish-message-templates.md` ⭐
- Backend API: `backend/src/routes/integrationCouponRoutes.ts`
- Coupon Service: `backend/src/services/CouponService.ts`
- Design Document: `.kiro/specs/whatsapp-coupon-system/design.md`
- n8n Development Guide: `.kiro/steering/n8n-development.md`

## Status

✅ Workflow defined  
⏳ Testing in progress  
⏳ Production deployment pending

Last Updated: 2025-11-28
