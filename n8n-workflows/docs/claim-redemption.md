# Claim Redemption Workflow

## Purpose

Handles redemption requests when customers have collected 4 or more coupons. When a customer sends "kupon kullan", this workflow checks their balance, creates a pending redemption if eligible, notifies staff, and replies to the customer with their redemption ID.

## Trigger

**Type**: WhatsApp Webhook (POST)  
**Path**: `/webhook/whatsapp-claim`  
**Method**: POST

### Webhook Configuration

Configure in Meta Cloud API Dashboard:
- **Webhook URL**: `https://<your-domain>/webhook/whatsapp-claim`
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

### 3. Filter 'kupon kullan'
- **Type**: IF Node
- **Condition**: Message text equals "kupon kullan" (case-insensitive)
- **True Path**: Continue to parse
- **False Path**: Ignore message (no response)

### 4. Parse Phone
- **Type**: Function Node
- **Purpose**: Extracts and normalizes phone number
- **Logic**:
  - Extracts phone from `message.from`
  - Normalizes phone to E.164 format (+90XXXXXXXXXX)

**Phone Normalization Rules**:
- Remove all non-digits
- Add +90 prefix if missing (Turkey)
- Handle formats: 05551234567, 905551234567, +905551234567

### 5. Check Deduplication
- **Type**: Function Node
- **Purpose**: Prevents duplicate processing of same claim request
- **Logic**:
  - Creates cache key: `claim:${phone}`
  - Checks workflow static data for existing entry
  - Returns `isDuplicate: true` if found within 5min TTL
  - Cleans expired cache entries

**Cache TTL**: 5 minutes (300 seconds)

### 6. Is Duplicate?
- **Type**: IF Node
- **Condition**: `isDuplicate === true`
- **True Path**: Skip API call, use cached redemption ID
- **False Path**: Call backend API

### 7. Claim Redemption API
- **Type**: HTTP Request Node
- **Method**: POST
- **URL**: `http://localhost:3001/api/integrations/coupons/claim`
- **Authentication**: Backend API Key (Header Auth)
- **Body**:
  ```json
  {
    "phone": "{{$json.phone}}"
  }
  ```
- **Retry**: 3 attempts with 1s wait between tries

**Response (new redemption)**:
```json
{
  "ok": true,
  "redemptionId": "uuid-v4",
  "rewardName": "Ücretsiz Masaj",
  "isNew": true
}
```

**Response (existing pending redemption)**:
```json
{
  "ok": true,
  "redemptionId": "uuid-v4",
  "rewardName": "Ücretsiz Masaj",
  "isNew": false,
  "message": "Zaten bekleyen bir kullanim talebiniz var. Resepsiyona kodu gosterin."
}
```

**Response (insufficient coupons)**:
```json
{
  "ok": false,
  "balance": 2,
  "needed": 2
}
```

### 8. Update Cache
- **Type**: Function Node
- **Purpose**: Stores redemption ID in deduplication cache
- **Logic**:
  - Saves redemption ID with 5min expiration
  - Updates workflow static data
  - Only caches if redemption was successful

### 9. Claim Success?
- **Type**: IF Node
- **Condition**: `ok === true`
- **True Path**: Format success messages (customer + staff)
- **False Path**: Format insufficient coupons message

### 10. Format Success (Customer)
- **Type**: Function Node
- **Purpose**: Creates Turkish success message for customer
- **Logic**: Checks `isNew` flag to distinguish new vs existing pending redemption
- **Messages**:
  - **New redemption** (`isNew: true`): "🎉 Tebrikler! Ücretsiz masaj hakkınız onaylandı! 🎫 Kod: {id}. Resepsiyona bu kodu gösterin."
  - **Existing pending** (`isNew: false`): "⏳ Zaten bekleyen bir kullanım talebiniz var! 🎫 Kod: {id}. Resepsiyona bu kodu gösterin. Onaylandıktan sonra yeni kupon toplayabilirsiniz."

### 11. Format Insufficient
- **Type**: Function Node
- **Purpose**: Creates Turkish message when customer doesn't have enough coupons
- **Message**: "📊 Henüz yeterli kuponunuz yok. Mevcut: {balance}/4 kupon. {needed} kupon daha toplamanız gerekiyor."

### 12. Send Customer Reply
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

### 13. Format Staff Notification
- **Type**: Function Node
- **Purpose**: Creates Turkish notification for staff group
- **Logic**:
  - Masks phone number (shows last 4 digits)
  - Formats timestamp in Istanbul timezone
  - Includes redemption ID for tracking

**Message**: 
```
🔔 Yeni kupon kullanımı!

Müşteri: ****1234
Redemption ID: {id}
Tarih: {timestamp}

Lütfen müşteriyi yönlendirin.
```

### 14. Send Staff Notification
- **Type**: HTTP Request Node
- **Method**: POST
- **URL**: `https://graph.facebook.com/v18.0/{{phoneId}}/messages`
- **Authentication**: WhatsApp Business API (Header Auth)
- **To**: Staff WhatsApp group ID
- **Body**: Same format as customer reply

### 15. Webhook Response
- **Type**: Respond to Webhook Node
- **Response**: `{"status": "ok"}`
- **Purpose**: Acknowledges webhook receipt to Meta

## Error Handling

### Invalid Signature
- Workflow stops immediately
- No response sent to customer
- Error logged in n8n execution history

### Insufficient Coupons
- Customer informed of current balance
- Told how many more coupons needed
- No staff notification sent

### Network Errors
- Automatic retry (3 attempts)
- Generic error message if all retries fail

### Rate Limiting
- Backend enforces 5 claims per day per phone
- Customer informed to try again later

## Testing

### Local Testing with curl

```bash
# Test successful claim (4+ coupons)
curl -X POST http://localhost:5678/webhook/whatsapp-claim \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=<SIGNATURE>" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "905551234567",
            "text": {
              "body": "kupon kullan"
            }
          }]
        }
      }]
    }]
  }'

# Test insufficient coupons
# (Use phone number with < 4 coupons in database)

# Test duplicate claim (within 5 minutes)
# (Send same request twice quickly)
```

### Test Checklist

- [ ] Successful claim (4+ coupons)
- [ ] Insufficient coupons (< 4)
- [ ] Duplicate claim (within 5min)
- [ ] Rate limit exceeded (6th request)
- [ ] Network error (backend down)
- [ ] Invalid webhook signature
- [ ] Turkish characters display correctly
- [ ] Phone normalization (various formats)
- [ ] Staff notification sent
- [ ] Phone masking in staff notification
- [ ] Timestamp in Istanbul timezone

## Monitoring

### n8n Execution History
- View all executions in n8n UI
- Check execution time and status
- Review error messages
- Verify both customer and staff messages sent

### Backend Logs
```bash
# Check redemption events
tail -f backend/logs/app.log | grep redemption

# Check rate limiting
tail -f backend/logs/app.log | grep "rate limit"
```

### Database Queries
```sql
-- Recent redemptions
SELECT * FROM coupon_redemptions 
WHERE status = 'pending' 
ORDER BY created_at DESC 
LIMIT 10;

-- Redemption events
SELECT * FROM coupon_events 
WHERE event IN ('redemption_attempt', 'redemption_granted', 'redemption_blocked')
ORDER BY created_at DESC 
LIMIT 20;

-- Customer balance
SELECT phone, coupon_count, total_earned, total_redeemed 
FROM coupon_wallets 
WHERE phone = '+905551234567';
```

## Troubleshooting

### Issue: Staff notification not sent

**Symptoms**: Customer receives message but staff doesn't

**Solutions**:
1. Verify staff group ID in credentials
2. Check WhatsApp API permissions for group messaging
3. Verify staff group exists and bot is member
4. Check n8n execution logs for WhatsApp API errors

### Issue: Duplicate redemptions created

**Symptoms**: Multiple redemptions for same customer

**Solutions**:
1. Check deduplication cache is working (5min TTL)
2. Verify workflow static data is enabled
3. Check backend idempotency logic
4. Review database for duplicate redemption IDs

### Issue: Phone masking not working

**Symptoms**: Full phone number visible in staff notification

**Solutions**:
1. Check regex in Format Staff Notification node
2. Verify phone format is E.164
3. Test masking function with sample data

### Issue: Timestamp wrong timezone

**Symptoms**: Time displayed in wrong timezone

**Solutions**:
1. Verify `toLocaleString` uses 'Europe/Istanbul'
2. Check server timezone (TZ environment variable)
3. Test with known timestamp

### Issue: Backend returns 401

**Symptoms**: "Invalid API key" error

**Solutions**:
1. Verify API key in n8n credentials
2. Check Authorization header format: `Bearer <KEY>`
3. Verify backend .env has matching N8N_API_KEY

## Performance

**Expected Latency**: < 3 seconds from message receipt to both replies sent

**Bottlenecks**:
- Backend API response time
- WhatsApp API response time (2 calls)
- Network latency

**Optimization**:
- Deduplication cache reduces redundant API calls
- Retry logic handles transient failures
- Parallel customer and staff notifications

## Security

- ✅ Webhook signature verification (Meta Cloud API)
- ✅ API key authentication for backend
- ✅ HTTPS required for all endpoints
- ✅ Phone number masking in staff notifications
- ✅ Rate limiting at backend level (5 claims/day)

## Business Logic

### Idempotency
- Duplicate claims within 5 minutes return same redemption ID
- Backend checks for existing pending redemption and returns it with `isNew: false`
- Workflow shows different message for existing pending vs new redemption
- Prevents double-spending of coupons
- Customer clearly informed when they already have a pending redemption

### Staff Workflow
1. Staff receives notification with redemption ID
2. Customer shows redemption ID at reception
3. Staff marks redemption complete in admin interface
4. Customer receives free massage

### Redemption Lifecycle
1. **Pending**: Created when customer claims
2. **Completed**: Marked by staff after service delivery
3. **Rejected**: Marked by staff if issue (with note)
4. **Expired**: Auto-expired after 30 days if not completed

## Requirements Validated

- **4.2**: Redemption claim with 4+ coupons
- **4.3**: Redemption record creation
- **4.4**: Customer confirmation message
- **4.5**: Staff notification
- **20.5**: Idempotent claim handling

## Related Documentation

- **Turkish Message Templates**: `n8n-workflows/docs/turkish-message-templates.md` ⭐
- Backend API: `backend/src/routes/integrationCouponRoutes.ts`
- Coupon Service: `backend/src/services/CouponService.ts`
- Design Document: `.kiro/specs/whatsapp-coupon-system/design.md`
- n8n Development Guide: `.kiro/steering/n8n-development.md`

## Status

✅ Workflow defined  
✅ Testing complete  
✅ Production deployed

**Recent Updates (2025-12-01)**:
- Added `isNew` flag to distinguish new vs existing pending redemptions
- Workflow now shows different messages:
  - New: "🎉 Tebrikler! Ücretsiz masaj hakkınız onaylandı!"
  - Existing: "⏳ Zaten bekleyen bir kullanım talebiniz var!"
- Prevents confusion when customer says "kupon kullan" multiple times

Last Updated: 2025-12-01
