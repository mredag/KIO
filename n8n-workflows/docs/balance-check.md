# Balance Check Workflow

## Purpose

Allows customers to check their current coupon balance via WhatsApp. When a customer sends "durum" (Turkish for "status"), this workflow retrieves their wallet information and replies with their current balance and instructions.

## Trigger

**Type**: WhatsApp Webhook (POST)  
**Path**: `/webhook/whatsapp-balance`  
**Method**: POST

### Webhook Configuration

Configure in Meta Cloud API Dashboard:
- **Webhook URL**: `https://<your-domain>/webhook/whatsapp-balance`
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

### 3. Filter 'durum'
- **Type**: IF Node
- **Condition**: Message text equals "durum" (case-insensitive)
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

### 5. Get Wallet API
- **Type**: HTTP Request Node
- **Method**: GET
- **URL**: `http://localhost:3001/api/integrations/coupons/wallet/{{phone}}`
- **Authentication**: Backend API Key (Header Auth)
- **Retry**: 3 attempts with 1s wait between tries

**Response (200)**:
```json
{
  "phone": "+905551234567",
  "couponCount": 2,
  "totalEarned": 5,
  "totalRedeemed": 1,
  "optedInMarketing": false,
  "lastMessageAt": "2025-11-28T10:30:00Z",
  "updatedAt": "2025-11-28T10:30:00Z"
}
```

**Response (404)**:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Wallet not found"
  }
}
```

### 6. Wallet Exists?
- **Type**: IF Node
- **Condition**: `statusCode === 200`
- **True Path**: Format balance message
- **False Path**: Format no wallet message

### 7. Format Balance Message
- **Type**: Function Node
- **Purpose**: Creates Turkish message with current balance
- **Logic**:
  - Extracts `couponCount` from response
  - Calculates remaining coupons needed (4 - balance)
  - Formats appropriate message based on balance

**Messages**:
- **4+ coupons**: "📊 Kupon durumunuz: X/4 kupon toplandı. 'kupon kullan' yazarak ücretsiz masajınızı alabilirsiniz!"
- **1-3 coupons**: "📊 Kupon durumunuz: X/4 kupon toplandı. Y kupon daha toplamanız gerekiyor."
- **0 coupons**: "📊 Henüz kuponunuz yok. Her masaj sonrası verilen QR kodu okutarak kupon toplayabilirsiniz. 4 kupon topladığınızda ücretsiz masaj kazanırsınız!"

### 8. Format No Wallet Message
- **Type**: Function Node
- **Purpose**: Creates Turkish message for new customers
- **Message**: "📊 Henüz kuponunuz yok. Her masaj sonrası verilen QR kodu okutarak kupon toplayabilirsiniz. 4 kupon topladığınızda ücretsiz masaj kazanırsınız!"

### 9. Send WhatsApp Reply
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

### 10. Webhook Response
- **Type**: Respond to Webhook Node
- **Response**: `{"status": "ok"}`
- **Purpose**: Acknowledges webhook receipt to Meta

## Error Handling

### Invalid Signature
- Workflow stops immediately
- No response sent to customer
- Error logged in n8n execution history

### Wallet Not Found (404)
- Treated as zero balance
- Customer receives welcome message with instructions
- No error logged (expected behavior for new customers)

### Network Errors
- Automatic retry (3 attempts)
- Generic error message if all retries fail

### Backend API Errors (500+)
- Automatic retry (3 attempts)
- Generic error message if all retries fail

## Testing

### Local Testing with curl

```bash
# Test existing wallet with balance
curl -X POST http://localhost:5678/webhook/whatsapp-balance \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=<SIGNATURE>" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "905551234567",
            "text": {
              "body": "durum"
            }
          }]
        }
      }]
    }]
  }'

# Test non-existent wallet
# (Use phone number not in database)

# Test case variations
# "DURUM", "Durum", "durum" should all work
```

### Test Checklist

- [ ] Existing wallet with 0 coupons
- [ ] Existing wallet with 1-3 coupons
- [ ] Existing wallet with 4+ coupons
- [ ] Non-existent wallet (404)
- [ ] Case-insensitive matching ("DURUM", "Durum")
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
# Check wallet lookups
tail -f backend/logs/app.log | grep wallet

# Check API calls
tail -f backend/logs/app.log | grep "GET /api/integrations/coupons/wallet"
```

### Database Queries
```sql
-- Check wallet data
SELECT phone, coupon_count, total_earned, total_redeemed 
FROM coupon_wallets 
WHERE phone = '+905551234567';

-- Recent balance checks (via events)
SELECT * FROM coupon_events 
WHERE event = 'balance_check' 
ORDER BY created_at DESC 
LIMIT 10;
```

## Troubleshooting

### Issue: Wrong balance displayed

**Symptoms**: Customer reports incorrect coupon count

**Solutions**:
1. Check database directly for wallet record
2. Verify backend API response
3. Check for recent redemptions or token consumptions
4. Review coupon_events table for audit trail

### Issue: 404 for existing customer

**Symptoms**: Customer who has used coupons gets "no wallet" message

**Solutions**:
1. Verify phone normalization is consistent
2. Check database for wallet with various phone formats
3. Verify backend wallet lookup logic
4. Check for database corruption or migration issues

### Issue: Message not formatted correctly

**Symptoms**: Missing emoji, wrong language, or formatting issues

**Solutions**:
1. Check function node logic for message formatting
2. Verify Turkish characters are preserved
3. Test with various balance values (0, 1-3, 4+)
4. Check WhatsApp API supports UTF-8

### Issue: Backend returns 401

**Symptoms**: "Invalid API key" error

**Solutions**:
1. Verify API key in n8n credentials
2. Check Authorization header format: `Bearer <KEY>`
3. Verify backend .env has matching N8N_API_KEY

## Performance

**Expected Latency**: < 2 seconds from message receipt to reply

**Bottlenecks**:
- Backend API response time
- Database query time
- WhatsApp API response time
- Network latency

**Optimization**:
- Simple GET request (no complex logic)
- Database indexed on phone number
- No deduplication needed (read-only operation)

## Security

- ✅ Webhook signature verification (Meta Cloud API)
- ✅ API key authentication for backend
- ✅ HTTPS required for all endpoints
- ✅ No PII exposed (customer only sees own data)
- ✅ No rate limiting needed (read-only, low cost)

## Business Logic

### Balance Display Rules
- **0 coupons**: Welcome message with instructions
- **1-3 coupons**: Current progress and remaining needed
- **4+ coupons**: Prompt to redeem with "kupon kullan"

### Customer Experience
- Simple, one-word command ("durum")
- Instant response with clear information
- Helpful instructions for next steps
- Encourages engagement with loyalty program

### No Rate Limiting
- Balance checks are read-only
- Low computational cost
- Encourages customer engagement
- No abuse potential

## Requirements Validated

- **3.1**: Retrieve customer wallet via WhatsApp
- **3.2**: Display current balance in format "X/4 coupons"
- **3.3**: Handle non-existent wallet gracefully
- **3.4**: Include redemption instructions when eligible

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
