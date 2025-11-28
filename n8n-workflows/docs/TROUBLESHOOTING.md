# n8n Workflows Troubleshooting Guide

This guide covers common issues, debugging techniques, and solutions for the WhatsApp coupon system workflows.

## Quick Diagnostics

### Health Check Checklist

Run through this checklist when troubleshooting:

```bash
# 1. Check n8n service status
sudo systemctl status n8n

# 2. Check backend API health
curl http://localhost:3001/api/kiosk/health

# 3. Check n8n logs
sudo journalctl -u n8n -n 50 --no-pager

# 4. Check backend logs
tail -f ~/spa-kiosk/backend/logs/app.log | grep coupon

# 5. Test webhook endpoint
curl -X POST http://localhost:5678/webhook-test/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# 6. Check database connectivity
sqlite3 ~/spa-kiosk/data/kiosk.db "SELECT COUNT(*) FROM coupon_tokens;"
```

---

## Common Issues by Category

### 1. Webhook Issues

#### Issue: Webhook not receiving messages from WhatsApp

**Symptoms:**
- No executions appear in n8n UI
- WhatsApp messages sent but no response
- Meta dashboard shows webhook errors

**Diagnosis:**
```bash
# Check if n8n is listening
sudo netstat -tlnp | grep 5678

# Check nginx/Caddy proxy
sudo nginx -t
curl -I https://your-domain.com/webhook/whatsapp

# Check Meta webhook configuration
# In Meta dashboard: App → WhatsApp → Configuration → Webhook
```

**Solutions:**

1. **Verify webhook URL is publicly accessible**:
   ```bash
   # Test from external network
   curl -X POST https://your-domain.com/webhook/whatsapp \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   ```

2. **Check webhook signature verification**:
   - Ensure app secret is correct in n8n credentials
   - Verify signature calculation in Function node
   - Temporarily disable verification for testing (re-enable after!)

3. **Check reverse proxy configuration**:
   ```nginx
   # nginx should have:
   location /webhook {
       proxy_pass http://localhost:5678;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
   }
   ```

4. **Use ngrok for local testing**:
   ```bash
   ngrok http 5678
   # Update Meta webhook URL to ngrok URL
   ```

#### Issue: Webhook signature verification fails

**Symptoms:**
- Executions fail at signature verification node
- Error: "Invalid signature"

**Solutions:**

1. **Verify app secret**:
   - Check Meta dashboard: App → Settings → Basic → App Secret
   - Update in n8n credentials
   - Restart workflow

2. **Check signature calculation**:
   ```javascript
   // Correct signature verification
   const crypto = require('crypto');
   const signature = $('Webhook').item.headers['x-hub-signature-256'];
   const payload = JSON.stringify($input.item.json);
   const secret = $credentials.whatsappSecret;
   
   const hash = 'sha256=' + crypto
     .createHmac('sha256', secret)
     .update(payload)
     .digest('hex');
   
   if (signature !== hash) {
     throw new Error('Invalid signature');
   }
   ```

3. **Debug payload**:
   ```javascript
   // Add debug node before verification
   console.log('Received signature:', signature);
   console.log('Calculated hash:', hash);
   console.log('Payload:', payload);
   ```

---

### 2. Backend API Issues

#### Issue: Backend returns 401 Unauthorized

**Symptoms:**
- HTTP Request node fails with 401 status
- Error: "Invalid API key"

**Solutions:**

1. **Verify API key matches**:
   ```bash
   # Check backend .env
   grep N8N_API_KEY ~/spa-kiosk/backend/.env
   
   # Check n8n credential
   # In n8n UI: Settings → Credentials → Backend API Key
   ```

2. **Check Authorization header format**:
   ```
   Correct: Authorization: Bearer <API_KEY>
   Wrong: Authorization: <API_KEY>
   Wrong: Authorization: Bearer<API_KEY> (no space)
   ```

3. **Test API key manually**:
   ```bash
   curl -X POST http://localhost:3001/api/integrations/coupons/consume \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"phone": "+905551234567", "token": "ABC123DEF456"}'
   ```

#### Issue: Backend returns 429 Rate Limit Exceeded

**Symptoms:**
- HTTP Request node returns 429 status
- Customer receives rate limit message

**Solutions:**

1. **Check rate limit counters**:
   ```bash
   sqlite3 ~/spa-kiosk/data/kiosk.db \
     "SELECT * FROM coupon_rate_limits WHERE phone = '+905551234567';"
   ```

2. **Verify midnight reset**:
   ```bash
   # Check if reset_at is in the future
   sqlite3 ~/spa-kiosk/data/kiosk.db \
     "SELECT phone, endpoint, count, datetime(reset_at) FROM coupon_rate_limits;"
   ```

3. **Manual reset (for testing only)**:
   ```bash
   sqlite3 ~/spa-kiosk/data/kiosk.db \
     "DELETE FROM coupon_rate_limits WHERE phone = '+905551234567';"
   ```

4. **Check timezone configuration**:
   ```bash
   # Backend should use Europe/Istanbul
   grep TZ ~/spa-kiosk/backend/.env
   # Should show: TZ=Europe/Istanbul
   ```

#### Issue: Backend returns 400 Invalid Token

**Symptoms:**
- Token consumption fails
- Error: "INVALID_TOKEN" or "EXPIRED_TOKEN"

**Solutions:**

1. **Check token in database**:
   ```bash
   sqlite3 ~/spa-kiosk/data/kiosk.db \
     "SELECT token, status, datetime(expires_at), datetime(used_at) 
      FROM coupon_tokens WHERE token = 'ABC123DEF456';"
   ```

2. **Verify token format**:
   - Should be exactly 12 uppercase alphanumeric characters
   - Example: `ABC123DEF456`

3. **Check expiration**:
   - Tokens expire 24 hours after issuance
   - Check `expires_at` timestamp

4. **Verify token hasn't been used**:
   - Status should be 'issued', not 'used' or 'expired'

---

### 3. Deduplication Issues

#### Issue: Duplicate messages not being filtered

**Symptoms:**
- Same message processed multiple times
- Customer receives multiple replies
- Wallet balance incremented twice

**Solutions:**

1. **Check workflow static data**:
   ```javascript
   // In Function node
   console.log('Cache:', $workflow.staticData.cache);
   ```

2. **Verify cache TTL**:
   ```javascript
   // Coupon capture: 60 seconds
   const ttl = 60000;
   
   // Claim redemption: 5 minutes
   const ttl = 300000;
   ```

3. **Clear cache manually**:
   - In n8n UI: Workflow → Settings → Static Data → Clear

4. **Check cache key format**:
   ```javascript
   // Should be: phone:token or just phone
   const cacheKey = `${phone}:${token}`;
   ```

#### Issue: Cache not persisting between executions

**Symptoms:**
- Deduplication doesn't work
- Cache appears empty on each execution

**Solutions:**

1. **Enable workflow static data**:
   - In n8n UI: Workflow → Settings → Enable Static Data

2. **Verify cache storage**:
   ```javascript
   // Must assign back to staticData
   $workflow.staticData.cache = cache;
   ```

---

### 4. Phone Number Issues

#### Issue: Phone number normalization fails

**Symptoms:**
- Wallet not found
- Different formats create separate wallets
- Error: "Invalid phone number format"

**Solutions:**

1. **Check normalization logic**:
   ```javascript
   // Should handle all formats:
   // 5551234567 → +905551234567
   // 05551234567 → +905551234567
   // 905551234567 → +905551234567
   // +905551234567 → +905551234567
   ```

2. **Test normalization**:
   ```javascript
   // Add debug node
   console.log('Original:', phone);
   console.log('Normalized:', normalizedPhone);
   ```

3. **Verify E.164 format**:
   - Must start with '+'
   - Followed by country code (90 for Turkey)
   - Then subscriber number
   - Example: `+905551234567`

---

### 5. Turkish Message Issues

#### Issue: Turkish characters appear broken

**Symptoms:**
- Ğ, Ü, Ş, İ, Ö, Ç appear as � or ???
- Messages unreadable

**Solutions:**

1. **Check Content-Type header**:
   ```
   Content-Type: application/json; charset=utf-8
   ```

2. **Verify WhatsApp API encoding**:
   ```javascript
   // In HTTP Request node
   {
     "messaging_product": "whatsapp",
     "to": "={{$json.phone}}",
     "type": "text",
     "text": {
       "body": "={{$json.message}}"
     }
   }
   ```

3. **Test message templates**:
   ```bash
   # Send test message
   curl -X POST https://graph.facebook.com/v18.0/PHONE_ID/messages \
     -H "Authorization: Bearer ACCESS_TOKEN" \
     -H "Content-Type: application/json; charset=utf-8" \
     -d '{
       "messaging_product": "whatsapp",
       "to": "905551234567",
       "type": "text",
       "text": {"body": "Test: Ğ Ü Ş İ Ö Ç"}
     }'
   ```

#### Issue: Wrong message sent to customer

**Symptoms:**
- Customer receives generic error instead of specific message
- Message doesn't match scenario

**Solutions:**

1. **Check Switch node routing**:
   - Verify rules match response codes correctly
   - Check fallback path

2. **Verify message template selection**:
   ```javascript
   // Should match scenario
   const messageType = $json.error?.code === 'INVALID_TOKEN' 
     ? 'invalid_token' 
     : 'generic_error';
   ```

3. **Test all message paths**:
   - Success (200)
   - Invalid token (400)
   - Expired token (400)
   - Rate limit (429)
   - Server error (500)

---

### 6. Staff Notification Issues

#### Issue: Staff group not receiving notifications

**Symptoms:**
- Customer receives confirmation
- Staff group doesn't get notified
- No errors in execution log

**Solutions:**

1. **Verify group ID**:
   ```bash
   # Check WhatsApp group ID
   # Format: 1234567890-1234567890@g.us
   ```

2. **Check notification condition**:
   ```javascript
   // Should only notify on successful redemption
   if ($json.ok === true && $json.redemptionId) {
     // Send notification
   }
   ```

3. **Test notification manually**:
   ```bash
   curl -X POST https://graph.facebook.com/v18.0/PHONE_ID/messages \
     -H "Authorization: Bearer ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "messaging_product": "whatsapp",
       "to": "GROUP_ID",
       "type": "text",
       "text": {"body": "Test notification"}
     }'
   ```

---

### 7. Performance Issues

#### Issue: Workflow execution is slow

**Symptoms:**
- Customer waits >5 seconds for reply
- Timeout errors
- Poor user experience

**Solutions:**

1. **Check backend response time**:
   ```bash
   time curl -X POST http://localhost:3001/api/integrations/coupons/consume \
     -H "Authorization: Bearer API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"phone": "+905551234567", "token": "ABC123DEF456"}'
   ```

2. **Optimize HTTP Request node**:
   - Reduce timeout to 5 seconds
   - Enable connection pooling
   - Use keep-alive

3. **Check database performance**:
   ```bash
   # Check database size
   ls -lh ~/spa-kiosk/data/kiosk.db
   
   # Vacuum database
   sqlite3 ~/spa-kiosk/data/kiosk.db "VACUUM;"
   
   # Analyze query performance
   sqlite3 ~/spa-kiosk/data/kiosk.db "EXPLAIN QUERY PLAN 
     SELECT * FROM coupon_tokens WHERE token = 'ABC123DEF456';"
   ```

4. **Monitor n8n resource usage**:
   ```bash
   # Check CPU/memory
   top -p $(pgrep -f n8n)
   
   # Check execution queue
   # In n8n UI: Executions → Filter by "Running"
   ```

---

## Debugging Techniques

### 1. Enable Verbose Logging

```javascript
// Add to Function nodes
console.log('=== Debug Info ===');
console.log('Input:', JSON.stringify($input.all(), null, 2));
console.log('Workflow ID:', $workflow.id);
console.log('Execution ID:', $execution.id);
console.log('Node:', $node.name);
console.log('==================');
```

### 2. Test Individual Nodes

1. Click on node in n8n UI
2. Click "Execute Node" button
3. Provide test data
4. Review output

### 3. Use Webhook Test Mode

```bash
# Send test payload to webhook
curl -X POST http://localhost:5678/webhook-test/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "from": "905551234567",
    "text": {
      "body": "KUPON ABC123DEF456"
    }
  }'
```

### 4. Monitor Execution Logs

```bash
# Real-time n8n logs
sudo journalctl -u n8n -f

# Filter for errors
sudo journalctl -u n8n | grep -i error

# Filter for specific phone
sudo journalctl -u n8n | grep "5551234567"
```

### 5. Database Inspection

```bash
# Check recent events
sqlite3 ~/spa-kiosk/data/kiosk.db \
  "SELECT datetime(created_at), event, phone, token, details 
   FROM coupon_events 
   ORDER BY created_at DESC 
   LIMIT 10;"

# Check wallet state
sqlite3 ~/spa-kiosk/data/kiosk.db \
  "SELECT phone, coupon_count, total_earned, total_redeemed, 
          datetime(last_message_at), opted_in_marketing 
   FROM coupon_wallets 
   WHERE phone = '+905551234567';"

# Check pending redemptions
sqlite3 ~/spa-kiosk/data/kiosk.db \
  "SELECT id, phone, status, datetime(created_at) 
   FROM coupon_redemptions 
   WHERE status = 'pending';"
```

---

## Emergency Procedures

### Workflow Not Responding

```bash
# 1. Restart n8n service
sudo systemctl restart n8n

# 2. Wait 10 seconds
sleep 10

# 3. Check status
sudo systemctl status n8n

# 4. Test webhook
curl -X POST http://localhost:5678/webhook-test/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### Database Corruption

```bash
# 1. Stop backend
pm2 stop kiosk-backend

# 2. Backup database
cp ~/spa-kiosk/data/kiosk.db ~/spa-kiosk/data/kiosk.db.emergency

# 3. Check integrity
sqlite3 ~/spa-kiosk/data/kiosk.db "PRAGMA integrity_check;"

# 4. If corrupted, restore from backup
cp ~/spa-kiosk/data/backups/backup-LATEST.json ~/restore.json
# Import using admin panel

# 5. Restart backend
pm2 restart kiosk-backend
```

### Rate Limit Reset

```bash
# Emergency rate limit reset (use sparingly)
sqlite3 ~/spa-kiosk/data/kiosk.db \
  "DELETE FROM coupon_rate_limits;"
```

### Clear All Caches

```bash
# 1. Clear workflow static data
# In n8n UI: Each workflow → Settings → Static Data → Clear

# 2. Restart n8n
sudo systemctl restart n8n
```

---

## Monitoring and Alerts

### Set Up Monitoring

```bash
# 1. Create monitoring script
cat > ~/monitor-n8n.sh << 'EOF'
#!/bin/bash
if ! systemctl is-active --quiet n8n; then
  echo "n8n is down!" | mail -s "n8n Alert" admin@example.com
  sudo systemctl restart n8n
fi
EOF

# 2. Make executable
chmod +x ~/monitor-n8n.sh

# 3. Add to crontab (check every 5 minutes)
crontab -e
# Add: */5 * * * * /home/user/monitor-n8n.sh
```

### Key Metrics to Monitor

1. **Execution Success Rate**: Should be >95%
2. **Average Response Time**: Should be <3 seconds
3. **Rate Limit Rejections**: Should be <10 per day
4. **Failed Webhook Deliveries**: Should be 0
5. **Database Size**: Monitor growth rate

---

## Getting Help

### Information to Collect

When reporting issues, include:

1. **Error message** (exact text)
2. **Execution ID** (from n8n UI)
3. **Workflow name** and version
4. **Recent logs** (last 50 lines)
5. **Database state** (relevant tables)
6. **Environment** (n8n version, Node.js version, OS)

### Useful Commands

```bash
# System info
uname -a
node --version
npm list -g n8n

# n8n info
sudo systemctl status n8n
curl http://localhost:5678/healthz

# Backend info
pm2 status
curl http://localhost:3001/api/kiosk/health

# Database info
sqlite3 ~/spa-kiosk/data/kiosk.db ".schema coupon_tokens"
```

---

## Prevention Best Practices

1. **Regular Backups**: Run daily backups of workflows and database
2. **Monitor Logs**: Check logs daily for errors
3. **Test Changes**: Always test in development before deploying
4. **Document Changes**: Keep workflow documentation up to date
5. **Version Control**: Export workflows after every change
6. **Health Checks**: Set up automated monitoring
7. **Rate Limit Monitoring**: Alert on high rejection rates
8. **Database Maintenance**: Vacuum database monthly

---

**Last Updated**: 2025-11-28  
**Status**: ✅ Comprehensive troubleshooting guide  
**Coverage**: All common issues and debugging techniques
