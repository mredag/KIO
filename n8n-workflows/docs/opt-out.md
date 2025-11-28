# Opt-Out Workflow

## Purpose

Allows customers to opt out of marketing messages while maintaining their ability to collect and redeem coupons. When a customer sends "iptal" (Turkish for "cancel"), this workflow updates their marketing preference and confirms the change.

## Trigger

**Type**: WhatsApp Webhook (POST)  
**Path**: `/webhook/whatsapp-optout`  
**Method**: POST

### Webhook Configuration

Configure in Meta Cloud API Dashboard:
- **Webhook URL**: `https://<your-domain>/webhook/whatsapp-optout`
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

### 3. Filter 'iptal'
- **Type**: IF Node
- **Condition**: Message text equals "iptal" (case-insensitive)
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

### 5. Opt-Out API
- **Type**: HTTP Request Node
- **Method**: POST
- **URL**: `http://localhost:3001/api/integrations/coupons/opt-out`
- **Authentication**: Backend API Key (Header Auth)
- **Body**:
  ```json
  {
    "phone": "{{$json.phone}}"
  }
  ```
- **Retry**: 3 attempts with 1s wait between tries

**Response (200)**:
```json
{
  "ok": true,
  "message": "Opted out successfully"
}
```

### 6. Format Confirmation
- **Type**: Function Node
- **Purpose**: Creates Turkish confirmation message
- **Message**: "✅ Pazarlama bildirimleri kapatıldı. Kupon kazanımı ve kullanımı normal şekilde devam edecek. Tekrar bildirimleri açmak isterseniz lütfen resepsiyonla iletişime geçin."

**Translation**: "✅ Marketing notifications turned off. Coupon collection and redemption will continue normally. If you want to turn notifications back on, please contact reception."

### 7. Send WhatsApp Reply
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

### 8. Webhook Response
- **Type**: Respond to Webhook Node
- **Response**: `{"status": "ok"}`
- **Purpose**: Acknowledges webhook receipt to Meta

## Error Handling

### Invalid Signature
- Workflow stops immediately
- No response sent to customer
- Error logged in n8n execution history

### Wallet Not Found
- Backend creates wallet with opted_in_marketing=0
- Customer receives confirmation message
- No error (expected behavior for new customers)

### Network Errors
- Automatic retry (3 attempts)
- Generic error message if all retries fail

### Backend API Errors (500+)
- Automatic retry (3 attempts)
- Generic error message if all retries fail

## Testing

### Local Testing with curl

```bash
# Test opt-out
curl -X POST http://localhost:5678/webhook/whatsapp-optout \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=<SIGNATURE>" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "905551234567",
            "text": {
              "body": "iptal"
            }
          }]
        }
      }]
    }]
  }'

# Test case variations
# "IPTAL", "Iptal", "iptal" should all work
```

### Test Checklist

- [ ] Existing wallet opt-out
- [ ] New customer opt-out (creates wallet)
- [ ] Case-insensitive matching ("IPTAL", "Iptal")
- [ ] Verify opted_in_marketing set to 0 in database
- [ ] Verify coupon functionality still works after opt-out
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
# Check opt-out operations
tail -f backend/logs/app.log | grep opt-out

# Check API calls
tail -f backend/logs/app.log | grep "POST /api/integrations/coupons/opt-out"
```

### Database Queries
```sql
-- Check opt-out status
SELECT phone, opted_in_marketing, updated_at 
FROM coupon_wallets 
WHERE phone = '+905551234567';

-- Count opted-out customers
SELECT COUNT(*) 
FROM coupon_wallets 
WHERE opted_in_marketing = 0;

-- Recent opt-outs
SELECT phone, updated_at 
FROM coupon_wallets 
WHERE opted_in_marketing = 0 
ORDER BY updated_at DESC 
LIMIT 10;
```

## Troubleshooting

### Issue: Opt-out not persisted

**Symptoms**: Customer still receives marketing messages

**Solutions**:
1. Check database for wallet record
2. Verify opted_in_marketing field is 0
3. Check backend opt-out logic
4. Verify marketing message workflows check opt-in status

### Issue: Coupon functionality broken after opt-out

**Symptoms**: Customer can't collect or redeem coupons

**Solutions**:
1. Verify backend doesn't block opted-out customers
2. Check coupon workflows don't filter by opt-in status
3. Review requirements (opt-out should only affect marketing)
4. Test token consumption and redemption for opted-out customer

### Issue: Confirmation message not sent

**Symptoms**: Customer doesn't receive confirmation

**Solutions**:
1. Check WhatsApp API response
2. Verify phone number format
3. Check n8n execution logs
4. Verify WhatsApp API credentials

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
- Database update time
- WhatsApp API response time
- Network latency

**Optimization**:
- Simple POST request (minimal logic)
- Database indexed on phone number
- No deduplication needed (idempotent operation)

## Security

- ✅ Webhook signature verification (Meta Cloud API)
- ✅ API key authentication for backend
- ✅ HTTPS required for all endpoints
- ✅ No PII exposed
- ✅ No rate limiting needed (low frequency operation)

## Business Logic

### Opt-Out Behavior
- Sets `opted_in_marketing` to 0 in database
- Does NOT affect coupon collection
- Does NOT affect coupon redemption
- Does NOT delete customer data
- Can be reversed by contacting reception

### Marketing Messages
- Future marketing workflows should check `opted_in_marketing` flag
- Opted-out customers excluded from promotional messages
- Transactional messages (coupon awarded, redemption confirmed) still sent

### Data Retention
- Wallet and coupon history preserved
- Customer can still use loyalty program
- Only marketing preference changed

### Re-Opt-In
- Not automated (requires reception contact)
- Prevents accidental re-opt-in
- Ensures customer intent

## Requirements Validated

- **10.1**: Process "iptal" message to opt out
- **10.4**: Send confirmation message

## Related Documentation

- **Turkish Message Templates**: `n8n-workflows/docs/turkish-message-templates.md` ⭐
- Backend API: `backend/src/routes/integrationCouponRoutes.ts`
- Coupon Service: `backend/src/services/CouponService.ts`
- Design Document: `.kiro/specs/whatsapp-coupon-system/design.md`
- Requirements: `.kiro/specs/whatsapp-coupon-system/requirements.md` (Requirement 10)
- n8n Development Guide: `.kiro/steering/n8n-development.md`

## Privacy Compliance

### GDPR/KVKK Considerations
- ✅ Customer can opt out of marketing
- ✅ Opt-out is immediate and persistent
- ✅ Confirmation provided to customer
- ✅ Data retained for service delivery (coupons)
- ✅ Clear instructions for re-opt-in

### Best Practices
- Simple, one-word command
- Immediate confirmation
- Clear explanation of what changes
- Reassurance that service continues
- Path to reverse decision

## Status

✅ Workflow defined  
⏳ Testing in progress  
⏳ Production deployment pending

Last Updated: 2025-11-28
