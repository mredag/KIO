# n8n Development Guide for Kiro Agent

**Purpose:** Best practices and patterns for developing n8n workflows integrated with the backend API, specifically for the WhatsApp coupon system.

---

## 🎯 Core Principles

1. **Workflows are code** - Version control workflow JSON exports
2. **Test locally first** - Use n8n UI for development, export for deployment
3. **Idempotency matters** - Design workflows to handle retries safely
4. **Security first** - Never hardcode credentials, use n8n credential system
5. **Monitor everything** - Log all workflow executions and errors

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

### Backend API Key
```
Credential Type: Header Auth
Name: Backend API Key
Header Name: Authorization
Header Value: Bearer <API_KEY>

Usage in HTTP Request Node:
- Authentication: Backend API Key
```

### WhatsApp Business API
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

**CRITICAL**: Never commit credentials to git. Store in n8n credential system only.

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
- Verify webhook URL is publicly accessible (use ngrok for local testing)
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

**Last Updated:** 2025-11-28  
**Status:** ✅ Ready for implementation  
**Applies to:** WhatsApp Coupon System feature

