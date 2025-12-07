# n8n Development Guide for Kiro Agent

**Purpose:** Best practices and patterns for developing n8n workflows integrated with the backend API, specifically for the WhatsApp coupon system.

---

## 🔴 CRITICAL: Pi Connection Required

**n8n runs on the Raspberry Pi, NOT locally.** When working with n8n:

1. **ALWAYS connect via SSH** to execute n8n commands
2. **Use n8n CLI** for workflow management (not Puppeteer/browser automation)
3. **Copy files via SCP** before importing

### Pi Connection Details
```
Host: 192.168.1.5
User: eform-kio
SSH:  ssh eform-kio@192.168.1.5
```

### n8n Access
```
URL:      http://192.168.1.5:5678
Email:    admin@spa-kiosk.local
Password: Admin123!
```

### Quick Commands (run via SSH)
```bash
# Check n8n status
ssh eform-kio@192.168.1.5 "systemctl status n8n --no-pager"

# Import workflows
scp n8n-workflows/workflows/*.json eform-kio@192.168.1.5:~/n8n-workflows/
ssh eform-kio@192.168.1.5 "n8n import:workflow --separate --input=/home/eform-kio/n8n-workflows/"

# Export workflows
ssh eform-kio@192.168.1.5 "n8n export:workflow --all"

# Activate all workflows
ssh eform-kio@192.168.1.5 "n8n update:workflow --all --active=true"

# Restart n8n
ssh eform-kio@192.168.1.5 "sudo systemctl restart n8n"
```

---

## 🎯 Core Principles

1. **Workflows are code** - Version control workflow JSON exports
2. **Execute on Pi** - All n8n operations happen on the Raspberry Pi via SSH
3. **Use CLI over UI** - Prefer n8n CLI commands for automation
4. **Idempotency matters** - Design workflows to handle retries safely
5. **Security first** - Never hardcode credentials, use n8n credential system

---

## 📋 n8n CLI Reference

### Workflow Commands (run on Pi via SSH)
```bash
# List all workflows
n8n export:workflow --all

# Import single workflow
n8n import:workflow --input=/path/to/workflow.json

# Import multiple workflows
n8n import:workflow --separate --input=/path/to/workflows/

# Activate workflow
n8n update:workflow --id=<WORKFLOW_ID> --active=true

# Deactivate workflow
n8n update:workflow --id=<WORKFLOW_ID> --active=false

# Activate all workflows
n8n update:workflow --all --active=true

# Execute workflow manually
n8n execute --id=<WORKFLOW_ID>
```

### Credential Commands
```bash
# Export credentials (encrypted)
n8n export:credentials --all

# Export credentials (decrypted - CAREFUL!)
n8n export:credentials --all --decrypted --output=creds.json

# Import credentials
n8n import:credentials --input=credentials.json
```

### Backup Commands
```bash
# Full backup
n8n export:workflow --backup --output=backups/workflows/
n8n export:credentials --backup --output=backups/credentials/
```

### Workflow JSON Requirements
When creating workflow JSON files, include these fields:
```json
{
  "name": "Workflow Name",
  "versionId": "unique-version-id",
  "active": true,
  "settings": { "executionOrder": "v1" },
  "nodes": [...],
  "connections": {...}
}
```

---

## 🔴 CRITICAL: Workflow Creation Best Practices

### 1. Required Fields
Every workflow JSON MUST have:
- `name` - Workflow name
- `versionId` - Unique string (required for import!)
- `nodes` - Array of node definitions
- `connections` - Object defining node connections
- `settings` - At minimum `{ "executionOrder": "v1" }`

### 2. Node Structure
```json
{
  "parameters": { ... },
  "id": "unique-node-id",
  "name": "Node Display Name",
  "type": "n8n-nodes-base.webhook",
  "typeVersion": 2,
  "position": [250, 400]
}
```

### 3. ⚠️ CRITICAL: Expression Syntax in JSON Body

**NEVER use `JSON.stringify()` with single quotes in expressions!**

```
❌ WRONG - causes "invalid syntax" error:
"jsonBody": "={{ JSON.stringify({messaging_product:'whatsapp',to:$json.phone}) }}"

✅ CORRECT - use template syntax directly:
"jsonBody": "={\"messaging_product\":\"whatsapp\",\"to\":\"{{ $json.phone }}\",\"text\":{\"body\":\"{{ $json.message }}\"}}"
```

### 4. ⚠️ CRITICAL: WhatsApp Webhook Payload Types

Meta sends TWO types of webhooks - handle both!

```javascript
// In Parse/Code node:
const value = body?.entry?.[0]?.changes?.[0]?.value;

// 1. STATUS UPDATES (delivery receipts) - IGNORE these
if (value?.statuses) {
  return [{ json: { route: 'ignore', reason: 'status_update' } }];
}

// 2. ACTUAL MESSAGES - process these
const messages = value?.messages;
if (!messages || !messages[0]) {
  return [{ json: { route: 'ignore', reason: 'no_messages' } }];
}
```

### 5. ⚠️ CRITICAL: Use Switch Node Instead of Chained IF Nodes

**IF nodes can have unexpected behavior. Use Switch node for routing:**

```json
{
  "parameters": {
    "rules": {
      "values": [
        { "conditions": { "conditions": [{ "leftValue": "={{ $json.route }}", "rightValue": "balance", "operator": { "type": "string", "operation": "equals" } }] }, "outputKey": "balance" },
        { "conditions": { "conditions": [{ "leftValue": "={{ $json.route }}", "rightValue": "coupon", "operator": { "type": "string", "operation": "equals" } }] }, "outputKey": "coupon" }
      ]
    },
    "options": { "fallbackOutput": "extra" }
  },
  "type": "n8n-nodes-base.switch",
  "typeVersion": 3
}
```

### 6. ⚠️ CRITICAL: Credential References

**Don't use credential IDs in workflow JSON - they won't match on import!**

Instead, use inline headers (for non-sensitive APIs):
```json
{
  "authentication": "none",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      { "name": "Authorization", "value": "Bearer YOUR_TOKEN" }
    ]
  }
}
```

### 7. Connection Format
```json
"connections": {
  "Webhook": { "main": [[{ "node": "Parse", "type": "main", "index": 0 }]] },
  "Parse": { "main": [[{ "node": "Router", "type": "main", "index": 0 }]] },
  "Router": { "main": [
    [{ "node": "Handler1", "type": "main", "index": 0 }],
    [{ "node": "Handler2", "type": "main", "index": 0 }],
    [{ "node": "Fallback", "type": "main", "index": 0 }]
  ]}
}
```

### 8. Deployment Process
```bash
# 1. Copy workflow to Pi
scp workflow.json eform-kio@192.168.1.5:~/workflow.json

# 2. Deactivate all workflows
ssh eform-kio@192.168.1.5 "n8n update:workflow --all --active=false 2>/dev/null"

# 3. Import workflow
ssh eform-kio@192.168.1.5 "n8n import:workflow --input=~/workflow.json 2>/dev/null"

# 4. Get new workflow ID
ssh eform-kio@192.168.1.5 "n8n list:workflow 2>/dev/null | grep 'Workflow Name'"

# 5. Activate workflow
ssh eform-kio@192.168.1.5 "n8n update:workflow --id=<ID> --active=true 2>/dev/null"

# 6. MUST restart n8n for changes to take effect!
ssh eform-kio@192.168.1.5 "sudo systemctl restart n8n"

# 7. Wait for startup (10 seconds)
sleep 10
```

### 9. Working Workflow Template
Reference: `n8n-workflows/workflows-v2/whatsapp-final.json`

This is the tested, working WhatsApp coupon workflow with:
- Proper webhook handling
- Status update filtering
- Switch-based routing
- Correct JSON body syntax
- Turkish messages

---

## 🚀 Quick Start on Raspberry Pi

### Installation
```bash
# Install Node.js 20.x (matches project)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install n8n globally
sudo npm install -g n8n

# Create n8n user and directory
sudo useradd -m -s /bin/bash n8n
sudo mkdir -p /var/lib/n8n
sudo chown n8n:n8n /var/lib/n8n
```

### Development Mode (Local Testing)
```bash
# Run n8n locally for development
n8n

# Access UI at http://localhost:5678
# Default: no authentication in dev mode
```

### Production Mode (systemd Service)
```bash
# Create service file (see deployment section below)
sudo systemctl daemon-reload
sudo systemctl enable n8n
sudo systemctl start n8n
sudo systemctl status n8n
```

---

## 📋 Workflow Development Workflow

### 1. Design Phase
- Map out workflow nodes on paper/whiteboard
- Identify external dependencies (WhatsApp API, Backend API)
- Plan error handling paths
- Define deduplication strategy

### 2. Build Phase (n8n UI)
- Create workflow in n8n UI at http://localhost:5678
- Use "Execute Workflow" button to test each node
- Add error handling nodes (IF, Switch, Error Trigger)
- Test with sample data

### 3. Test Phase
- Test with real WhatsApp sandbox number
- Verify backend API integration
- Test error scenarios (invalid token, rate limit, network error)
- Verify deduplication works

### 4. Export Phase
```bash
# Export workflow to JSON
# In n8n UI: Workflow menu → Download
# Save to: deployment/n8n-workflows/<workflow-name>.json
```

### 5. Deploy Phase
```bash
# Import workflow on production n8n
# In n8n UI: Import from File
# Or use n8n CLI (if available)
```

---

## 🔧 Essential n8n Patterns

### Pattern 1: WhatsApp Webhook Trigger
```
Webhook Trigger Node:
- HTTP Method: POST
- Path: /webhook/whatsapp
- Authentication: None (signature verified in Function node)
- Response Mode: Immediately

Function Node (Verify Signature):
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

return $input.all();
```

### Pattern 2: Phone Number Normalization
```javascript
// Function Node: Normalize Phone
const phone = $json.from; // WhatsApp phone from webhook

// Remove all non-digits
let normalized = phone.replace(/\D/g, '');

// Add + prefix if missing
if (!normalized.startsWith('+')) {
  // Assume Turkey (+90) if no country code
  if (normalized.startsWith('0')) {
    normalized = '+90' + normalized.substring(1);
  } else if (normalized.length === 10) {
    normalized = '+90' + normalized;
  } else {
    normalized = '+' + normalized;
  }
}

return { phone: normalized };
```

### Pattern 3: Deduplication Cache
```javascript
// Function Node: Check Deduplication
const phone = $json.phone;
const token = $json.token;
const cacheKey = `${phone}:${token}`;

// Use workflow static data for in-memory cache
const cache = $workflow.staticData.cache || {};
const now = Date.now();
const ttl = 60000; // 60 seconds

// Clean expired entries
Object.keys(cache).forEach(key => {
  if (cache[key].expires < now) {
    delete cache[key];
  }
});

// Check if duplicate
if (cache[cacheKey] && cache[cacheKey].expires > now) {
  return {
    isDuplicate: true,
    cachedBalance: cache[cacheKey].balance
  };
}

// Store in cache
cache[cacheKey] = {
  balance: null, // Will be updated after API call
  expires: now + ttl
};

$workflow.staticData.cache = cache;

return { isDuplicate: false };
```

### Pattern 4: Backend API Call with Retry
```
HTTP Request Node:
- Method: POST
- URL: http://localhost:3001/api/integrations/coupons/consume
- Authentication: Generic Credential Type
  - Header Auth: Authorization: Bearer {{$credentials.n8nApiKey}}
- Body: JSON
  {
    "phone": "={{$json.phone}}",
    "token": "={{$json.token}}"
  }
- Retry on Fail: Yes
- Max Tries: 3
- Wait Between Tries: 1000ms (exponential backoff)
- Continue on Fail: Yes (handle in error path)
```

### Pattern 5: Error Handling with Switch
```
Switch Node (after HTTP Request):
- Mode: Rules
- Rules:
  1. $json.error.code === 'INVALID_TOKEN' → Invalid Token Path
  2. $json.error.code === 'EXPIRED_TOKEN' → Expired Token Path
  3. $statusCode === 429 → Rate Limit Path
  4. $statusCode >= 500 → Server Error Path
  5. $statusCode === 200 → Success Path
- Fallback: Generic Error Path
```

### Pattern 6: WhatsApp Reply
```
HTTP Request Node (WhatsApp Send):
- Method: POST
- URL: https://graph.facebook.com/v18.0/{{$credentials.whatsappPhoneId}}/messages
- Authentication: Generic Credential Type
  - Header Auth: Authorization: Bearer {{$credentials.whatsappAccessToken}}
- Body: JSON
  {
    "messaging_product": "whatsapp",
    "to": "={{$json.phone}}",
    "type": "text",
    "text": {
      "body": "={{$json.message}}"
    }
  }
```

### Pattern 7: Turkish Message Templates
```javascript
// Function Node: Format Message
const balance = $json.balance;
const remainingToFree = $json.remainingToFree;

const messages = {
  coupon_awarded: `✅ Kuponunuz eklendi! Toplam: ${balance}/4 kupon. ${remainingToFree === 0 ? "'kupon kullan' yazarak ücretsiz masajınızı alabilirsiniz." : `${remainingToFree} kupon daha toplamanız gerekiyor.`}`,
  
  invalid_token: "❌ Bu kupon geçersiz veya kullanılmış. Lütfen resepsiyonla iletişime geçin.",
  
  expired_token: "❌ Bu kuponun süresi dolmuş. Lütfen resepsiyonla iletişime geçin.",
  
  rate_limit: "⏳ Çok fazla istek gönderdiniz. Lütfen daha sonra tekrar deneyin.",
  
  redemption_success: `🎉 Tebrikler! 4 kuponunuz kullanıldı. Redemption ID: ${$json.redemptionId}. Resepsiyona bu kodu göstererek ücretsiz masajınızı alabilirsiniz.`,
  
  insufficient_coupons: `📊 Henüz yeterli kuponunuz yok. Mevcut: ${balance}/4 kupon. ${remainingToFree} kupon daha toplamanız gerekiyor.`
};

return { message: messages[$json.messageType] };
```

---

## 🔐 Credentials Management

### ⚠️ CRITICAL: Bearer Token Format

**ALWAYS include "Bearer " prefix when using Header Auth credentials!**

Common mistake:
- ❌ WRONG: `EAASoZBpRZBYVgBQI9tq...` (missing Bearer prefix)
- ✅ CORRECT: `Bearer EAASoZBpRZBYVgBQI9tq...` (with Bearer and space)

The Authorization header format is: `Authorization: Bearer <token>`

### Backend API Key
```
Credential Type: Header Auth
Name: Backend API Key
Header Name: Authorization
Header Value: Bearer <API_KEY>

⚠️ MUST include "Bearer " prefix with space!

Usage in HTTP Request Node:
- Authentication: Backend API Key
```

### WhatsApp Business API (Header Auth Method)
```
Credential Type: Header Auth
Name: WhatsApp Business API
Header Name: Authorization
Header Value: Bearer <ACCESS_TOKEN>

⚠️ MUST include "Bearer " prefix with space!

Usage in HTTP Request Node:
- Authentication: WhatsApp Business API
```

### WhatsApp Business API (Generic Credential Type - Alternative)
```
Credential Type: Generic Credential Type
Name: WhatsApp Business API
Fields:
- whatsappAccessToken: <ACCESS_TOKEN>
- whatsappPhoneId: <PHONE_NUMBER_ID>
- whatsappSecret: <APP_SECRET>

Usage:
- Access Token: {{$credentials.whatsappAccessToken}}
- Phone ID: {{$credentials.whatsappPhoneId}}
- Secret: {{$credentials.whatsappSecret}}
```

**CRITICAL**: 
- Never commit credentials to git. Store in n8n credential system only.
- Always include "Bearer " prefix for Header Auth credentials
- Test credentials immediately after creating/updating

---

## 🧪 Testing Workflows

### Local Testing Checklist
- [ ] Test with valid token
- [ ] Test with invalid token
- [ ] Test with expired token
- [ ] Test with duplicate message (deduplication)
- [ ] Test rate limiting (11th request)
- [ ] Test network error (stop backend)
- [ ] Test WhatsApp API error
- [ ] Verify Turkish messages display correctly
- [ ] Verify staff notifications sent
- [ ] Check execution logs for errors

### Testing Tools
```bash
# Test webhook with curl
curl -X POST http://localhost:5678/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=<SIGNATURE>" \
  -d '{
    "from": "905551234567",
    "text": {
      "body": "KUPON ABC123DEF456"
    }
  }'

# Check n8n execution logs
# In n8n UI: Executions tab → View execution details

# Check backend logs
tail -f backend/logs/app.log | grep coupon
```

---

## 🚨 Common Pitfalls & Solutions

### Issue 1: Missing "Bearer " Prefix ⚠️ MOST COMMON
**Symptom:** 401 Unauthorized or "Invalid token" errors  
**Cause:** Forgot to include "Bearer " prefix in Header Auth credential  
**Solution:** 
```
❌ WRONG: EAASoZBpRZBYVgBQI9tq...
✅ CORRECT: Bearer EAASoZBpRZBYVgBQI9tq...
```
**Note:** There must be a space after "Bearer"!

### Issue 2: Wrong Credential Type
**Symptom:** Credential not found or authentication fails  
**Cause:** Using wrong credential type for the node  
**Solution:** 
- For HTTP Request nodes: Use "Header Auth" credential type
- For WhatsApp nodes: Use "WhatsApp OAuth API" credential type
- Match credential name exactly in workflow JSON

### Issue 3: Credential Name Mismatch
**Symptom:** "Credential not found" error  
**Cause:** Credential name in workflow doesn't match n8n credential name  
**Solution:** 
- Check workflow JSON for credential ID/name
- Ensure n8n credential has exact same name
- Case-sensitive matching

### Issue 4: Token Expiration
**Symptom:** Worked before, now getting 401 errors  
**Cause:** Access token expired (temporary tokens expire in 24 hours)  
**Solution:** 
- Use System User tokens (never expire)
- Regenerate token in Meta Developer Console
- Update n8n credential with new token (including "Bearer " prefix!)

### Issue 5: Phone Number Format
**Symptom:** "Invalid parameter" error from WhatsApp API  
**Cause:** Wrong phone number format  
**Solution:** 
- Use format: `905551234567` (no + or spaces)
- Remove all non-digits before sending
- For Turkey: prefix with 90, remove leading 0

### Issue 6: Workflow Not Triggering
**Symptom:** Webhook receives messages but workflow doesn't execute  
**Cause:** Workflow not activated or wrong webhook URL  
**Solution:** 
- Check workflow is active: `n8n list:workflow`
- Activate: `n8n update:workflow --id=<ID> --active=true`
- Restart n8n: `sudo systemctl restart n8n`
- Verify webhook URL in Meta Developer Console

### Issue 7: n8n Changes Not Applied
**Symptom:** Updated workflow/credential but still using old values  
**Cause:** n8n needs restart to apply changes  
**Solution:** 
```bash
sudo systemctl restart n8n
# Wait 5-10 seconds for n8n to fully start
systemctl status n8n
```

## 📊 Monitoring and Debugging

### Enable Workflow Logging
```javascript
// Function Node: Log Execution
console.log('Workflow execution:', {
  workflowId: $workflow.id,
  executionId: $execution.id,
  phone: $json.phone?.replace(/\d(?=\d{4})/g, '*'), // Mask phone
  token: $json.token?.substring(0, 4) + '****' + $json.token?.substring(8), // Mask token
  timestamp: new Date().toISOString()
});

return $input.all();
```

### Common Issues and Solutions

**Issue: Webhook not receiving messages**
- Check WhatsApp webhook configuration in Meta dashboard
- Verify Cloudflare Tunnel is running: `systemctl status cloudflared`
- Check webhook URL: `https://webhook.eformspa.com/api/whatsapp/webhook`
- Check webhook signature verification

**Issue: Backend API returns 401**
- Verify API key in n8n credentials matches backend .env
- Check Authorization header format: `Bearer <API_KEY>`

**Issue: Deduplication not working**
- Check workflow static data is enabled
- Verify cache TTL is appropriate (60s for tokens, 5min for claims)
- Clear cache: delete workflow static data in n8n UI

**Issue: Turkish characters broken**
- Ensure Content-Type: application/json; charset=utf-8
- Check WhatsApp API supports UTF-8

**Issue: Rate limiting not working**
- Verify backend rate limit middleware is applied
- Check rate limit counters in database
- Verify midnight reset calculation uses Istanbul timezone

---

## 🚀 Deployment Best Practices

### systemd Service Configuration
```ini
# /etc/systemd/system/n8n.service
[Unit]
Description=n8n workflow automation
After=network.target

[Service]
Type=simple
User=n8n
Environment=EXECUTIONS_PROCESS=main
Environment=N8N_BASIC_AUTH_ACTIVE=true
Environment=N8N_BASIC_AUTH_USER=admin
Environment=N8N_BASIC_AUTH_PASSWORD=<SECURE_PASSWORD>
Environment=N8N_PORT=5678
Environment=WEBHOOK_URL=https://<PUBLIC_DOMAIN>
Environment=TZ=Europe/Istanbul
Environment=GENERIC_TIMEZONE=Europe/Istanbul
Environment=N8N_LOG_LEVEL=info
Environment=N8N_LOG_OUTPUT=file
Environment=N8N_LOG_FILE_LOCATION=/var/lib/n8n/logs/
WorkingDirectory=/var/lib/n8n
ExecStart=/usr/bin/n8n
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Reverse Proxy (nginx)
```nginx
# /etc/nginx/sites-available/n8n
server {
    listen 443 ssl http2;
    server_name n8n.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/n8n.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/n8n.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:5678;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support for n8n UI
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Workflow Export/Import
```bash
# Export all workflows (manual in UI)
# Workflow menu → Download → Save to deployment/n8n-workflows/

# Import workflow (manual in UI)
# Import from File → Select JSON file

# Backup workflows
cp /var/lib/n8n/.n8n/database.sqlite3 /var/backups/n8n/database-$(date +%Y%m%d).sqlite3
```

---

## 📝 Workflow Documentation Template

For each workflow, document in `deployment/n8n-workflows/<workflow-name>.md`:

```markdown
# Workflow: <Name>

## Purpose
<Brief description>

## Trigger
<Webhook URL, schedule, etc.>

## Nodes
1. **Trigger**: <Description>
2. **Verify Signature**: <Description>
3. **Normalize Phone**: <Description>
4. **Check Deduplication**: <Description>
5. **Call Backend API**: <Description>
6. **Handle Response**: <Description>
7. **Send WhatsApp Reply**: <Description>

## Error Handling
- Invalid token → Reply with error message
- Rate limit → Reply with retry message
- Network error → Retry 3x, then generic error

## Testing
- Test URL: <Webhook URL>
- Sample payload: <JSON>
- Expected response: <JSON>

## Monitoring
- Check executions in n8n UI
- Check backend logs for API calls
- Monitor WhatsApp delivery status
```

---

## 🎓 Advanced Patterns

### Pattern: Conditional Staff Notification
```javascript
// Function Node: Should Notify Staff
const event = $json.event;
const notifyEvents = ['redemption_granted', 'abuse_detected'];

return {
  shouldNotify: notifyEvents.includes(event),
  staffGroupId: process.env.WHATSAPP_STAFF_GROUP_ID
};

// Use in IF node to conditionally send notification
```

### Pattern: Batch Processing
```javascript
// Function Node: Batch Events
const events = $input.all();
const batches = [];
const batchSize = 10;

for (let i = 0; i < events.length; i += batchSize) {
  batches.push(events.slice(i, i + batchSize));
}

return batches.map(batch => ({ batch }));

// Use with Split In Batches node
```

### Pattern: Scheduled Cleanup
```
Cron Node:
- Mode: Every Day
- Hour: 3
- Minute: 0
- Timezone: Europe/Istanbul

HTTP Request Node:
- Method: POST
- URL: http://localhost:3001/api/admin/coupons/cleanup
- Authentication: Backend API Key
```

---

## ✅ Pre-Deployment Checklist

- [ ] All workflows tested locally
- [ ] Credentials configured (no hardcoded secrets)
- [ ] Error handling paths tested
- [ ] Turkish messages verified
- [ ] Deduplication working
- [ ] Rate limiting tested
- [ ] Webhook signature verification working
- [ ] Staff notifications tested
- [ ] Workflows exported to JSON
- [ ] Documentation updated
- [ ] systemd service configured
- [ ] Reverse proxy configured with HTTPS
- [ ] Monitoring alerts configured
- [ ] Backup script includes n8n database

---

## 🔗 Related Documentation

- WhatsApp Coupon System Spec: `.kiro/specs/whatsapp-coupon-system/`
- Implementation Plan: `docs/n8n-coupon-plan.md`
- Backend API Routes: `backend/src/routes/`
- Deployment Guide: `deployment/raspberry-pi/README.md`

---

## 🏗️ Final Working Workflow Architecture

The tested, production-ready workflow (`whatsapp-final.json`) uses this architecture:

```
┌─────────────┐     ┌─────────┐     ┌──────────┐
│   Webhook   │────▶│  Parse  │────▶│  Router  │
│  (POST)     │     │  (Code) │     │ (Switch) │
└─────────────┘     └─────────┘     └────┬─────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        │              │                 │                │               │
        ▼              ▼                 ▼                ▼               ▼
   ┌─────────┐   ┌───────────┐   ┌───────────┐   ┌──────────┐   ┌─────────┐
   │ Verify  │   │API Coupon │   │API Balance│   │API Claim │   │  Help/  │
   │Response │   │  (HTTP)   │   │  (HTTP)   │   │  (HTTP)  │   │ OptOut  │
   └────┬────┘   └─────┬─────┘   └─────┬─────┘   └────┬─────┘   └────┬────┘
        │              │               │              │              │
        │              ▼               ▼              ▼              │
        │        ┌───────────┐   ┌───────────┐   ┌───────────┐      │
        │        │Fmt Coupon │   │Fmt Balance│   │ Fmt Claim │      │
        │        │  (Code)   │   │  (Code)   │   │  (Code)   │      │
        │        └─────┬─────┘   └─────┬─────┘   └─────┬─────┘      │
        │              │               │              │              │
        │              └───────────────┼──────────────┴──────────────┘
        │                              │
        │                              ▼
        │                        ┌───────────┐
        │                        │  Send WA  │
        │                        │  (HTTP)   │
        │                        └─────┬─────┘
        │                              │
        ▼                              ▼
   ┌─────────┐                   ┌───────────┐
   │Challenge│                   │    OK     │
   │Response │                   │ Response  │
   └─────────┘                   └───────────┘
```

### Node Details

| Node | Type | Purpose |
|------|------|---------|
| Webhook | webhook | Receives WhatsApp webhooks (POST /webhook/whatsapp) |
| Parse | code | Parses payload, filters status updates, extracts command |
| Router | switch | Routes to correct handler based on command |
| API Coupon | httpRequest | POST /api/integrations/coupons/consume |
| API Balance | httpRequest | GET /api/integrations/coupons/wallet/{phone} |
| API Claim | httpRequest | POST /api/integrations/coupons/claim |
| Fmt * | code | Formats Turkish response messages |
| Send WA | httpRequest | Sends WhatsApp reply via Graph API |

### Supported Commands

| Command | Route | Description |
|---------|-------|-------------|
| `KUPON <CODE>` | coupon | Consume a coupon token |
| `DURUM` / `BAKIYE` | balance | Check coupon balance |
| `KUPON KULLAN` / `KULLAN` | claim | Redeem 4 coupons for free massage |
| `YARDIM` / `HELP` / `?` | help | Show available commands |
| `IPTAL` / `DUR` / `STOP` | optout | Opt out of notifications |

---

## 🔧 Quick Troubleshooting Reference

### Symptom → Solution Table

| Symptom | Likely Cause | Quick Fix |
|---------|--------------|-----------|
| Workflow always goes to "ignore" | Status updates not filtered | Add `if (value?.statuses) return ignore` in Parse node |
| "invalid syntax" in HTTP node | Wrong JSON expression syntax | Use template syntax: `"={\"key\":\"{{ $json.val }}\"}"` |
| 401 Unauthorized | Missing "Bearer " prefix | Add `Bearer ` (with space) before token |
| Credential not found | Credential ID mismatch | Use inline headers instead of credential references |
| Workflow not triggering | Not activated or needs restart | `n8n update:workflow --id=X --active=true` then `sudo systemctl restart n8n` |
| Changes not applied | n8n caches workflows | `sudo systemctl restart n8n` and wait 10 seconds |
| Wrong route selected | IF node issues | Replace IF nodes with Switch node |
| Phone format error | Wrong format for WhatsApp | Use `905551234567` (no + or spaces) |

### Emergency Reset Commands

```bash
# Full workflow reset on Pi
ssh eform-kio@192.168.1.5 << 'EOF'
# Stop n8n
sudo systemctl stop n8n

# Clear workflow cache (optional - removes all workflows!)
# rm -rf ~/.n8n/database.sqlite3

# Restart n8n
sudo systemctl start n8n

# Wait for startup
sleep 10

# Check status
systemctl status n8n --no-pager
EOF
```

### Test Webhook Manually

```bash
# Test via Cloudflare Tunnel (production URL)
curl -X POST https://webhook.eformspa.com/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "905551234567",
            "text": { "body": "DURUM" }
          }]
        }
      }]
    }]
  }'

# Or test n8n directly on Pi
curl -X POST http://192.168.1.5:5678/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"entry":[{"changes":[{"value":{"messages":[{"from":"905551234567","text":{"body":"DURUM"}}]}}]}]}'
```

---

## 📊 Current Workflow Status

### Production Workflows (2025-12-07)

| Workflow | File | Status | Features |
|----------|------|--------|----------|
| **WhatsApp** | `whatsapp-dynamic-automation.json` | ✅ Production | Keyword routing + Dynamic AI prompts + Security |
| **Instagram** | `instagram-dynamic-automation.json` | ✅ Production | AI Agent + Knowledge Base + Customer Data + Dynamic Prompts |

### WhatsApp Workflow Architecture

```
Webhook → Verify Signature → Parse → Router (Switch) → [Balance/Coupon/Claim/Help] → Format → Send WA
```

**Key Features:**
- ✅ Signature verification (security)
- ✅ Keyword-based routing (reliable)
- ✅ Dynamic AI prompts (optional, not connected)
- ✅ Interaction logging
- ✅ Turkish messages

**File:** `n8n-workflows/workflows-v2/whatsapp-dynamic-automation.json`

### Instagram Workflow Architecture

```
Webhook → Parse → Check Service → Fetch Profile → Fetch Customer → Fetch Knowledge → Fetch AI Prompt → Enrich Context → Log Inbound → AI Agent → Format → Log Outbound → Send IG
```

**Key Features:**
- ✅ Dynamic AI prompts from database
- ✅ Knowledge base integration
- ✅ Customer data enrichment
- ✅ Interaction logging
- ✅ Intent detection
- ✅ Response time tracking

**File:** `n8n-workflows/workflows-v2/instagram-dynamic-automation.json`

### ⚠️ CRITICAL: Gemini + n8n Tool Compatibility

**HTTP Request Tool does NOT work with Gemini** - causes "empty parameter keys" error.

**Solution: Use Code Tool (`toolCode`) instead:**
```json
{
  "parameters": {
    "name": "tool_name",
    "description": "Tool description",
    "jsCode": "const param = $fromAI('param_name', 'description', 'string');\nconst response = await fetch('http://...', { ... });\nreturn await response.json();"
  },
  "type": "@n8n/n8n-nodes-langchain.toolCode",
  "typeVersion": 1.1
}
```

**Key points:**
- Use `$fromAI('name', 'description', 'type')` to define parameters
- Use `fetch()` for HTTP requests inside the code
- Avoid Turkish characters in tool names (use ASCII only)

### Legacy Workflows (Deprecated)
| Workflow | ID | Status |
|----------|-----|--------|
| WhatsApp Balance Check | Z7hznAe9tf5TzyGC | ❌ Deprecated |
| WhatsApp Claim Redemption | Ncgg7lbKWFUd00GT | ❌ Deprecated |
| WhatsApp Coupon Capture | MM0rlnDn2xOZQSbA | ❌ Deprecated |
| WhatsApp Opt-Out | qiCdgSvgQVnz5C3Z | ❌ Deprecated |

### Deploy Final Workflow

```bash
# 1. Copy to Pi
scp n8n-workflows/workflows-v2/whatsapp-final.json eform-kio@192.168.1.5:~/whatsapp-final.json

# 2. Deactivate old workflows
ssh eform-kio@192.168.1.5 "n8n update:workflow --all --active=false 2>/dev/null"

# 3. Import new workflow
ssh eform-kio@192.168.1.5 "n8n import:workflow --input=~/whatsapp-final.json 2>/dev/null"

# 4. Activate
ssh eform-kio@192.168.1.5 "n8n update:workflow --all --active=true 2>/dev/null"

# 5. Restart n8n (REQUIRED!)
ssh eform-kio@192.168.1.5 "sudo systemctl restart n8n"

# 6. Wait and verify
sleep 10
ssh eform-kio@192.168.1.5 "systemctl status n8n --no-pager | head -5"
```

---

## 🔑 Environment Variables Reference

### Backend (.env)
```env
# Required for n8n integration
N8N_API_KEY=dwsQf8q0BpFWXPqMhwy2SGLG/wHIw1hKyjW8eI4Cgd8=

# WhatsApp Configuration
WHATSAPP_PHONE_NUMBER_ID=471153662739049
WHATSAPP_ACCESS_TOKEN=<your-token>
WHATSAPP_VERIFY_TOKEN=spa-kiosk-verify-token
WHATSAPP_APP_SECRET=<your-app-secret>
```

### n8n Service (/etc/systemd/system/n8n.service)
```ini
Environment=N8N_PORT=5678
Environment=WEBHOOK_URL=https://your-domain.com
Environment=TZ=Europe/Istanbul
Environment=GENERIC_TIMEZONE=Europe/Istanbul
```

---

## 📁 File Structure Reference

```
n8n-workflows/
├── workflows-v2/
│   ├── whatsapp-final.json         ✅ WhatsApp production
│   ├── instagram-ai-agent-v3.json  ✅ Instagram production (with analytics)
│   ├── instagram-ai-agent.json     📦 Instagram basic (v1)
│   └── *.json                      📦 Legacy/test workflows
├── docs/
│   ├── instagram-setup.md          📖 Instagram setup guide
│   ├── TROUBLESHOOTING.md          📖 Detailed troubleshooting
│   ├── MESSAGE_FILTERING.md        📖 Webhook filtering guide
│   └── turkish-message-templates.md 📖 Turkish messages
├── deployment/
│   ├── DEPLOYMENT.md               📖 Deployment guide
│   └── BACKUP.md                   📖 Backup procedures
└── README.md                       📖 Overview
```

---

## ✅ Final Checklist

### Before Going Live
- [ ] `whatsapp-final.json` deployed to Pi
- [ ] Workflow activated and n8n restarted
- [ ] WhatsApp webhook URL configured in Meta dashboard
- [ ] Backend API running on Pi (port 3001)
- [ ] Test all commands: KUPON, DURUM, KULLAN, YARDIM, IPTAL
- [ ] Verify Turkish messages display correctly
- [ ] Check n8n execution logs for errors

### Monitoring
- [ ] n8n UI accessible at http://192.168.1.5:5678
- [ ] Check Executions tab for workflow runs
- [ ] Monitor backend logs: `tail -f ~/spa-kiosk/backend/logs/*.log`
- [ ] Set up alerts for failed executions (optional)

---

## 🆕 Recent Updates (2025-12-01)

### Pending Redemption Handling

The `/claim` API now returns an `isNew` flag to distinguish between:
- **New redemption** (`isNew: true`): First time claiming, coupons deducted
- **Existing pending** (`isNew: false`): Already has pending redemption, returns same code

**Workflow handles this with different messages:**
```javascript
if (r.isNew === false) {
  // Existing pending - remind user
  msg = `⏳ Zaten bekleyen bir kullanim talebiniz var!
🎫 Kod: ${r.redemptionId}
Resepsiyona bu kodu gosterin. Onaylandiktan sonra yeni kupon toplayabilirsiniz.`;
} else {
  // New redemption
  msg = `🎉 Tebrikler! Ucretsiz masaj hakkiniz onaylandi!
🎫 Kod: ${r.redemptionId}
Resepsiyona bu kodu gosterin.`;
}
```

This prevents confusion when customers say "kupon kullan" multiple times.

---

## 📸 Instagram DM Integration (2025-12-07)

### Overview

Instagram DM AI Agent with **dynamic automation** - combines AI prompts from database, knowledge base integration, and customer data enrichment.

### Current Production Workflow

**File:** `instagram-dynamic-automation.json`  
**Status:** ✅ Active on Pi  
**Workflow ID:** Check with `n8n list:workflow`

### Workflow Flow

```
Webhook → Parse → Check Service → Fetch IG Profile → Fetch Customer → Fetch Knowledge → Fetch AI Prompt → Enrich Context → Log Inbound → AI Agent → Format → Log Outbound → Send IG
```

### Key Features

1. **Dynamic AI Prompts**: Fetches system message from `/api/integrations/ai/prompt/instagram-spa-assistant`
2. **Knowledge Base Integration**: Fetches business info from `/api/integrations/knowledge/context`
3. **Customer Enrichment**: Fetches customer history from `/api/integrations/instagram/customer/:id`
4. **Interaction Logging**: Logs all messages to `instagram_interactions` table
5. **Intent Detection**: Classifies messages (pricing, hours, booking, coupon, greeting)
6. **Response Time Tracking**: Measures AI latency

### Backend API Endpoints

```
# AI Prompts (Dynamic)
GET  /api/integrations/ai/prompt/:name           - Get AI system prompt

# Knowledge Base (Dynamic)
GET  /api/integrations/knowledge/context         - Get business info

# Customer Data
GET  /api/integrations/instagram/customer/:id    - Fetch customer data
POST /api/integrations/instagram/interaction     - Log interaction
POST /api/integrations/instagram/customer/:id/link-phone - Link phone

# Analytics
GET  /api/integrations/instagram/analytics       - Marketing stats
GET  /api/integrations/instagram/export?format=csv - Export to Sheets
```

### Database Tables

```sql
-- AI Prompts (managed in admin panel)
ai_system_prompts (id, name, system_message, workflow_type, version)

-- Knowledge Base (managed in admin panel)
knowledge_base (id, category, key, value_tr, value_en)

-- Customer Data
instagram_customers (instagram_id, phone, interaction_count, last_interaction_at)
instagram_interactions (id, instagram_id, direction, message_text, intent, sentiment, ai_response, response_time_ms)
```

### Deploy Instagram Workflow

```bash
# Copy workflow to Pi
scp n8n-workflows/workflows-v2/instagram-dynamic-automation.json eform-kio@192.168.1.5:~/instagram-dynamic.json

# Import and activate
ssh eform-kio@192.168.1.5 << 'EOF'
n8n update:workflow --all --active=false 2>/dev/null
n8n import:workflow --input=~/instagram-dynamic.json 2>/dev/null
n8n update:workflow --all --active=true 2>/dev/null
sudo systemctl restart n8n
sleep 10
systemctl status n8n --no-pager | head -5
EOF
```

### Required Credentials

1. **Google Gemini API** - For AI responses
2. **Instagram Business API** - Header Auth with access token
3. **Backend API Key** - Header Auth: `Authorization: Bearer <N8N_API_KEY>`

### Admin Panel Management

**AI Prompts:** `http://192.168.1.5:3001/admin/ai-prompts`
- Edit `instagram-spa-assistant` prompt
- Changes apply immediately (no workflow redeploy!)

**Knowledge Base:** `http://192.168.1.5:3001/admin/knowledge-base`
- Update business info (prices, hours, policies)
- Changes apply immediately to AI responses

### Documentation

- Full guide: `n8n-workflows/DYNAMIC_AUTOMATION_INTEGRATION.md`
- AI Prompts: `n8n-workflows/AI_PROMPTS_SYSTEM.md`
- Architecture: `n8n-workflows/ARCHITECTURE.md`

---

## 🔐 WhatsApp Security (2025-12-07)

### Signature Verification

**CRITICAL:** WhatsApp webhooks MUST verify `x-hub-signature-256` header to prevent unauthorized access.

### Implementation in Workflow

**File:** `whatsapp-dynamic-automation.json`

**Verify Signature Node (Code):**
```javascript
const crypto = require('crypto');
const body = $input.item.json.body;
const signature = $input.item.json.headers['x-hub-signature-256'];

if (!signature) {
  return [{ json: { error: 'Missing signature', verified: false } }];
}

const appSecret = 'YOUR_APP_SECRET'; // From Meta Developer Console
const expectedSignature = 'sha256=' + crypto
  .createHmac('sha256', appSecret)
  .update(JSON.stringify(body))
  .digest('hex');

if (signature !== expectedSignature) {
  return [{ json: { error: 'Invalid signature', verified: false } }];
}

return [{ json: { ...body, verified: true } }];
```

### Security Checklist

- [ ] Signature verification enabled in workflow
- [ ] App Secret stored securely (not in workflow JSON)
- [ ] Webhook URL uses HTTPS
- [ ] Rate limiting enabled in backend
- [ ] PII masking in logs

### Documentation

- Security guide: `n8n-workflows/WHATSAPP_SECURITY_HARDENING.md`
- Deployment: `n8n-workflows/WHATSAPP_SECURITY_DEPLOYMENT.md`

---

## 🤖 Dynamic AI Prompts System (2025-12-07)

### Overview

Manage AI system prompts from admin panel instead of hardcoding in workflows.

### Benefits

- ✅ Edit prompts without redeploying workflows
- ✅ Version tracking (auto-increments)
- ✅ A/B testing different prompts
- ✅ Central management for all workflows

### Usage in n8n

**Step 1: Add HTTP Request Node**
```json
{
  "name": "Fetch AI Prompt",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "GET",
    "url": "http://localhost:3001/api/integrations/ai/prompt/instagram-spa-assistant",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth"
  }
}
```

**Step 2: Use in AI Agent**
```
System Message: {{ $('Fetch AI Prompt').first().json.systemMessage + '\n\nBILGILER:' + $('Enrich Context').first().json.knowledgeContext }}
```

### Available Prompts (Seeded)

| Name | Workflow Type | Description |
|------|---------------|-------------|
| `instagram-spa-assistant` | Instagram | Natural conversation assistant |
| `whatsapp-coupon-assistant` | WhatsApp | Intent classification |
| `general-customer-service` | General | Generic customer service |

### Admin Panel

**URL:** `http://192.168.1.5:3001/admin/ai-prompts`

**Features:**
- Create/Edit/Delete prompts
- Copy prompt names for n8n
- Active/Inactive toggle
- Version tracking

### API Endpoints

```
# Integration API (no auth - for n8n)
GET /api/integrations/ai/prompt/:name

# Admin API (requires auth)
GET    /api/admin/ai-prompts
POST   /api/admin/ai-prompts
PUT    /api/admin/ai-prompts/:id
DELETE /api/admin/ai-prompts/:id
```

### Documentation

- Full guide: `n8n-workflows/AI_PROMPTS_SYSTEM.md`
- Integration: `n8n-workflows/AI_PROMPTS_INTEGRATION_GUIDE.md`
- Deployment: `n8n-workflows/AI_PROMPTS_DEPLOYMENT_COMPLETE.md`

---

**Last Updated:** 2025-12-07  
**Status:** ✅ Production-ready with dynamic automation  
**Working Workflows:** 
- WhatsApp: `n8n-workflows/workflows-v2/whatsapp-dynamic-automation.json`
- Instagram: `n8n-workflows/workflows-v2/instagram-dynamic-automation.json`  
**Applies to:** WhatsApp Coupon System, Instagram DM Integration

