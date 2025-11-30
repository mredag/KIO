# WhatsApp Access Token Renewal Guide

## Problem
Your WhatsApp Business API application or access token has been deleted/revoked, causing this error:
```
Error validating application. Application has been deleted.
```

## Solution: Generate New Access Token

### Option 1: Temporary Token (24 hours) - Quick Test

1. **Go to Meta Developer Console**
   - Visit: https://developers.facebook.com/apps
   - Login with your Facebook account

2. **Select Your App**
   - Find your WhatsApp Business app
   - If deleted, you'll need to create a new one

3. **Navigate to WhatsApp Settings**
   - Left sidebar: Click "WhatsApp" → "API Setup"

4. **Generate Temporary Token**
   - Find "Temporary access token" section
   - Click "Generate Token"
   - Copy the token (valid for 24 hours)

5. **Test the Token**
   ```bash
   node test-whatsapp-token.js <YOUR_TOKEN> <PHONE_NUMBER_ID>
   ```

### Option 2: Permanent Token (Recommended for Production)

1. **Create System User**
   - Go to: https://business.facebook.com/settings/system-users
   - Click "Add" → Create new system user
   - Name: "n8n WhatsApp Integration"
   - Role: Admin

2. **Assign Assets**
   - Click on the system user
   - Click "Add Assets"
   - Select your WhatsApp Business Account
   - Enable "Manage WhatsApp Business Account"

3. **Generate Token**
   - Click "Generate New Token"
   - Select your app
   - Permissions needed:
     - `whatsapp_business_messaging`
     - `whatsapp_business_management`
   - Token expiration: "Never" or "60 days" (your choice)
   - Copy and save the token securely

4. **Test the Token**
   ```bash
   node test-whatsapp-token.js <YOUR_TOKEN> <PHONE_NUMBER_ID>
   ```

## Update n8n Credential

### Method 1: Via n8n UI (Recommended)

1. **SSH to Raspberry Pi**
   ```bash
   ssh eform-kio@192.168.1.5
   ```

2. **Access n8n UI**
   - Open browser: http://192.168.1.5:5678
   - Login: admin@spa-kiosk.local / Admin123!

3. **Update Credential**
   - Click "Credentials" in left sidebar
   - Find "WhatsApp Business API"
   - Click to edit
   - Update "Access Token" field with new token
   - Click "Save"

4. **Test Workflow**
   - Open "WhatsApp Coupon Capture" workflow
   - Click "Execute Workflow"
   - Check execution log for success

### Method 2: Via n8n CLI

1. **SSH to Pi**
   ```bash
   ssh eform-kio@192.168.1.5
   ```

2. **Export Current Credentials**
   ```bash
   n8n export:credentials --all --output=~/creds-backup.json
   ```

3. **Edit Credential File**
   ```bash
   nano ~/creds-backup.json
   # Find WhatsApp credential
   # Update "data" field with new token
   # Save and exit (Ctrl+X, Y, Enter)
   ```

4. **Import Updated Credentials**
   ```bash
   n8n import:credentials --input=~/creds-backup.json
   ```

5. **Restart n8n**
   ```bash
   sudo systemctl restart n8n
   ```

## Verify Everything Works

### 1. Test Token Locally
```bash
node test-whatsapp-token.js
```

### 2. Test n8n Workflow
```bash
# SSH to Pi
ssh eform-kio@192.168.1.5

# Check n8n is running
systemctl status n8n

# Test workflow via webhook (if you have ngrok/public URL)
curl -X POST https://your-ngrok-url.ngrok.io/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "905551234567",
            "text": { "body": "KUPON TEST123" }
          }]
        }
      }]
    }]
  }'
```

### 3. Check n8n Execution Logs
- Go to n8n UI: http://192.168.1.5:5678
- Click "Executions" tab
- Check latest execution
- Should see "Success" status

## Common Issues

### Issue: "Invalid OAuth access token"
**Cause:** Token format incorrect or expired  
**Fix:** Regenerate token, ensure you copy the full token

### Issue: "Permissions error"
**Cause:** Token doesn't have required permissions  
**Fix:** When generating token, ensure these permissions:
- `whatsapp_business_messaging`
- `whatsapp_business_management`

### Issue: "Phone number not found"
**Cause:** Wrong PHONE_NUMBER_ID  
**Fix:** Get correct ID from Meta Developer Console → WhatsApp → API Setup

### Issue: Token works locally but not in n8n
**Cause:** Credential not updated in n8n  
**Fix:** Update credential via n8n UI, restart n8n service

## Security Best Practices

1. **Never commit tokens to git**
   - Tokens are in `.env` (already in `.gitignore`)
   - n8n credentials are encrypted in database

2. **Use System User tokens for production**
   - More secure than user access tokens
   - Can be revoked without affecting user account
   - Better audit trail

3. **Rotate tokens regularly**
   - Set expiration (60 days recommended)
   - Create calendar reminder to renew
   - Test new token before old one expires

4. **Monitor token usage**
   - Check Meta Developer Console for API calls
   - Set up alerts for unusual activity
   - Review n8n execution logs regularly

## Quick Reference

### Environment Variables (backend/.env)
```env
WHATSAPP_ACCESS_TOKEN=your_new_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_waba_id
```

### n8n Credential Fields
- **Name:** WhatsApp Business API
- **Type:** Header Auth
- **Header Name:** Authorization
- **Header Value:** Bearer YOUR_TOKEN_HERE

### Test Commands
```bash
# Test token
node test-whatsapp-token.js

# Check n8n status
ssh eform-kio@192.168.1.5 "systemctl status n8n"

# View n8n logs
ssh eform-kio@192.168.1.5 "journalctl -u n8n -f"

# Restart n8n
ssh eform-kio@192.168.1.5 "sudo systemctl restart n8n"
```

## Next Steps After Token Renewal

1. ✅ Test token with `test-whatsapp-token.js`
2. ✅ Update n8n credential
3. ✅ Test workflow execution
4. ✅ Verify WhatsApp messages are sent
5. ✅ Update documentation with new token expiration date
6. ✅ Set calendar reminder for next renewal

---

**Last Updated:** 2025-11-29  
**Status:** Active troubleshooting guide  
**Related:** docs/WHATSAPP_COUPON_INTEGRATION.md
