# Dynamic Automation Management - n8n Workflow Deployment Guide

## Overview

This guide covers deploying the updated WhatsApp and Instagram workflows that integrate with the Dynamic Automation Management system. These workflows now support:

1. **Service Status Checking** - Workflows check if the service is enabled before processing
2. **Interaction Logging** - All inbound and outbound messages are logged for analytics
3. **Dynamic Knowledge Base** - Help messages use dynamic content from the knowledge base

## New Workflow Files

### WhatsApp
- **File**: `n8n-workflows/workflows-v2/whatsapp-dynamic-automation.json`
- **Name**: WhatsApp Kupon Dynamic Automation
- **Version ID**: dynamic-automation-v1

### Instagram
- **File**: `n8n-workflows/workflows-v2/instagram-dynamic-automation.json`
- **Name**: Instagram SPA AI Agent Dynamic
- **Version ID**: instagram-dynamic-v1

## Prerequisites

Before deploying, ensure:

1. ✅ Backend API is running with all new routes:
   - `/api/integrations/services/:name/status`
   - `/api/integrations/whatsapp/interaction`
   - `/api/integrations/instagram/interaction`
   - `/api/integrations/knowledge/context`

2. ✅ Database tables exist:
   - `service_settings`
   - `whatsapp_interactions`
   - `knowledge_base`

3. ✅ Services are enabled in database:
   ```sql
   SELECT * FROM service_settings WHERE service_name IN ('whatsapp', 'instagram');
   ```

4. ✅ Knowledge base has initial data (optional but recommended)

## Deployment Steps

### Step 1: Copy Workflows to Pi

```bash
# Copy WhatsApp workflow
scp n8n-workflows/workflows-v2/whatsapp-dynamic-automation.json eform-kio@192.168.1.5:~/whatsapp-dynamic.json

# Copy Instagram workflow
scp n8n-workflows/workflows-v2/instagram-dynamic-automation.json eform-kio@192.168.1.5:~/instagram-dynamic.json
```

### Step 2: Deactivate Old Workflows

```bash
ssh eform-kio@192.168.1.5 "n8n update:workflow --all --active=false 2>/dev/null"
```

### Step 3: Import New Workflows

```bash
# Import WhatsApp workflow
ssh eform-kio@192.168.1.5 "n8n import:workflow --input=~/whatsapp-dynamic.json 2>/dev/null"

# Import Instagram workflow
ssh eform-kio@192.168.1.5 "n8n import:workflow --input=~/instagram-dynamic.json 2>/dev/null"
```

### Step 4: Get Workflow IDs

```bash
ssh eform-kio@192.168.1.5 "n8n list:workflow 2>/dev/null | grep -E 'WhatsApp Kupon Dynamic|Instagram SPA AI Agent Dynamic'"
```

Note the workflow IDs for the next step.

### Step 5: Activate Workflows

```bash
# Replace <WHATSAPP_ID> and <INSTAGRAM_ID> with actual IDs from previous step
ssh eform-kio@192.168.1.5 "n8n update:workflow --id=<WHATSAPP_ID> --active=true 2>/dev/null"
ssh eform-kio@192.168.1.5 "n8n update:workflow --id=<INSTAGRAM_ID> --active=true 2>/dev/null"
```

### Step 6: Restart n8n (REQUIRED!)

```bash
ssh eform-kio@192.168.1.5 "sudo systemctl restart n8n"
```

Wait 10 seconds for n8n to fully restart.

### Step 7: Verify Deployment

```bash
# Check n8n status
ssh eform-kio@192.168.1.5 "systemctl status n8n --no-pager | head -5"

# List active workflows
ssh eform-kio@192.168.1.5 "n8n list:workflow 2>/dev/null | grep -E 'active.*true'"
```

## Testing the Integration

### Test 1: Service Status Check

1. Disable WhatsApp service via admin panel or API:
   ```bash
   curl -X POST http://192.168.1.5:3001/api/admin/services/whatsapp/toggle \
     -H "Authorization: Bearer <ADMIN_TOKEN>" \
     -H "Content-Type: application/json"
   ```

2. Send a WhatsApp message - should receive maintenance message

3. Re-enable service and test again - should process normally

### Test 2: Interaction Logging

1. Send a WhatsApp message: "DURUM"

2. Check database for logged interaction:
   ```bash
   ssh eform-kio@192.168.1.5 "sqlite3 ~/spa-kiosk/data/kiosk.db 'SELECT * FROM whatsapp_interactions ORDER BY created_at DESC LIMIT 1;'"
   ```

3. Verify in admin panel: Navigate to Interactions page

### Test 3: Dynamic Knowledge Base

1. Add knowledge entries via admin panel:
   - Category: hours
   - Key: weekdays
   - Value: Pazartesi-Cumartesi 10:00-22:00

2. Send WhatsApp message: "YARDIM"

3. Verify response includes the knowledge base content

### Test 4: Instagram Service Status

1. Disable Instagram service via admin panel

2. Send Instagram DM - should receive maintenance message

3. Re-enable and test normal flow

## Workflow Architecture

### WhatsApp Flow

```
Webhook → Parse → Check Service Status → Check Enabled → Router
                                              ↓
                                         (if disabled)
                                              ↓
                                        Maintenance
                                              ↓
                                      Log Interaction → Send WA → OK
                                              
                                         (if enabled)
                                              ↓
                                    Route to handlers (coupon/balance/claim/help)
                                              ↓
                                      Log Interaction → Send WA → OK
```

### Instagram Flow

```
Webhook → Parse → Router → Check Service Status → Check Enabled
                                                        ↓
                                                  (if disabled)
                                                        ↓
                                                  Maintenance → Send IG → OK
                                                        
                                                  (if enabled)
                                                        ↓
                                    Fetch Customer → Fetch Knowledge → Enrich Context
                                                        ↓
                                                  Log Inbound → AI Agent → Format
                                                        ↓
                                                  Log Outbound → Send IG → OK
```

## Key Features

### 1. Service Status Check

Both workflows now check service status before processing:

```javascript
// Check if service is enabled
const isEnabled = statusResponse.enabled === true;

if (!isEnabled) {
  // Return maintenance message
  return [{ 
    json: { 
      route: 'maintenance',
      message: '🔧 Sistem bakımda. Lütfen daha sonra tekrar deneyin.'
    } 
  }];
}
```

### 2. Interaction Logging

All messages are logged with intent and sentiment:

```javascript
// Log interaction
{
  "phone": "905551234567",
  "direction": "outbound",
  "messageText": "Original message",
  "intent": "balance_check",
  "sentiment": "neutral"
}
```

### 3. Dynamic Knowledge Base

Help messages are built from knowledge base:

```javascript
// Fetch knowledge context
GET /api/integrations/knowledge/context

// Returns:
{
  "services": { "massage": "Klasik Masaj - 800 TL" },
  "hours": { "weekdays": "Pazartesi-Cumartesi 10:00-22:00" },
  "contact": { "phone": "+90 XXX XXX XXXX" }
}
```

## Troubleshooting

### Issue: Workflow not triggering

**Solution**: 
- Verify workflow is active: `n8n list:workflow`
- Restart n8n: `sudo systemctl restart n8n`
- Check webhook URL in Meta dashboard

### Issue: Service status always returns disabled

**Solution**:
- Check database: `SELECT * FROM service_settings;`
- Verify backend API is running
- Check API key in workflow matches backend .env

### Issue: Knowledge base returns empty

**Solution**:
- Add entries via admin panel
- Check database: `SELECT * FROM knowledge_base WHERE is_active = 1;`
- Verify API endpoint: `curl http://localhost:3001/api/integrations/knowledge/context`

### Issue: Interactions not logging

**Solution**:
- Check database table exists: `whatsapp_interactions`
- Verify API endpoint works
- Check n8n execution logs for errors
- Ensure timeout is sufficient (2-3 seconds)

## Rollback Procedure

If issues occur, rollback to previous workflows:

```bash
# Deactivate new workflows
ssh eform-kio@192.168.1.5 "n8n update:workflow --id=<NEW_ID> --active=false"

# Activate old workflows
ssh eform-kio@192.168.1.5 "n8n update:workflow --id=<OLD_ID> --active=true"

# Restart n8n
ssh eform-kio@192.168.1.5 "sudo systemctl restart n8n"
```

## Monitoring

### Check Service Health

```bash
# Check service status
curl http://192.168.1.5:3001/api/integrations/services/whatsapp/status \
  -H "Authorization: Bearer <API_KEY>"

# Check recent interactions
curl http://192.168.1.5:3001/api/admin/interactions?limit=10 \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### View n8n Execution Logs

1. Access n8n UI: http://192.168.1.5:5678
2. Navigate to Executions tab
3. Filter by workflow name
4. Review execution details

## Next Steps

After successful deployment:

1. ✅ Seed knowledge base with initial data (see task 11.1)
2. ✅ Train staff on admin panel features
3. ✅ Monitor interaction analytics
4. ✅ Adjust knowledge base content based on common questions
5. ✅ Set up alerts for service downtime

## Related Documentation

- [n8n Development Guide](../n8n-development.md)
- [Dynamic Automation Management Spec](../../.kiro/specs/dynamic-automation-management/)
- [Backend API Routes](../../backend/src/routes/integrationRoutes.ts)

---

**Last Updated**: 2025-12-05  
**Status**: ✅ Ready for deployment  
**Tested**: Workflows validated with all integration points
