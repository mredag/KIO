# Credentials Setup Guide

This guide explains how to obtain and configure all credentials required for the WhatsApp coupon system n8n workflows.

## Overview

The system requires two sets of credentials:
1. **Backend API Key**: For authenticating n8n → backend API calls
2. **WhatsApp Business API**: For sending/receiving WhatsApp messages

## 1. Backend API Key

### Purpose
Authenticates n8n workflows when calling backend integration endpoints.

### Generation

**On Backend Server**:

```bash
# Generate a secure random API key
openssl rand -base64 32

# Example output: 
# 8xK9mP2nQ5rT7vW1yZ3aB4cD6eF8gH0iJ2kL4mN6oP8q
```

### Configuration

**Backend (.env file)**:
```bash
# Add to backend/.env
N8N_API_KEY=8xK9mP2nQ5rT7vW1yZ3aB4cD6eF8gH0iJ2kL4mN6oP8q
```

**n8n Credentials**:
1. Open n8n UI at http://localhost:5678
2. Go to Settings → Credentials
3. Click "Add Credential"
4. Select "Header Auth"
5. Configure:
   - **Name**: Backend API Key
   - **Header Name**: Authorization
   - **Header Value**: `Bearer 8xK9mP2nQ5rT7vW1yZ3aB4cD6eF8gH0iJ2kL4mN6oP8q`
6. Click "Save"

### Testing

```bash
# Test API key works
curl -X GET http://localhost:3001/api/integrations/coupons/wallet/+905551234567 \
  -H "Authorization: Bearer 8xK9mP2nQ5rT7vW1yZ3aB4cD6eF8gH0iJ2kL4mN6oP8q"

# Should return 200 OK or 404 (not 401)
```

### Security Best Practices
- ✅ Use cryptographically secure random generation
- ✅ Minimum 32 characters
- ✅ Rotate every 90 days
- ✅ Never commit to git
- ✅ Store in environment variables only
- ✅ Use different keys for dev/staging/production

---

## 2. WhatsApp Business API Credentials

### Purpose
Enables n8n to receive webhook events and send messages via WhatsApp.

### Prerequisites
- Meta Business Account
- WhatsApp Business Account
- Verified business phone number

### Step-by-Step Setup

#### 2.1. Create Meta App

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Click "My Apps" → "Create App"
3. Select "Business" as app type
4. Fill in app details:
   - **App Name**: "Spa Coupon System" (or your choice)
   - **Contact Email**: Your business email
   - **Business Account**: Select your business
5. Click "Create App"

#### 2.2. Add WhatsApp Product

1. In app dashboard, find "WhatsApp" product
2. Click "Set Up"
3. Select or create a WhatsApp Business Account
4. Add a phone number:
   - Use test number for development
   - Use verified business number for production

#### 2.3. Get Access Token

**Temporary Token (Development)**:
1. In WhatsApp → Getting Started
2. Copy the temporary access token
3. Valid for 24 hours
4. Use for initial testing only

**Permanent Token (Production)**:
1. Go to WhatsApp → Configuration
2. Click "Generate Token"
3. Select permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
4. Copy and save the token securely
5. This token doesn't expire but can be revoked

#### 2.4. Get Phone Number ID

1. In WhatsApp → Getting Started
2. Find "Phone number ID" under your test number
3. Copy the numeric ID (e.g., `123456789012345`)

#### 2.5. Get App Secret

1. Go to Settings → Basic
2. Click "Show" next to "App Secret"
3. Enter your password to reveal
4. Copy the app secret

#### 2.6. Get Staff Group ID

**Option A: Using WhatsApp Web**
1. Open WhatsApp Web
2. Open the staff group
3. Look at URL: `https://web.whatsapp.com/send?phone=GROUP_ID`
4. Copy the GROUP_ID

**Option B: Using API**
```bash
# List all groups
curl -X GET "https://graph.facebook.com/v18.0/PHONE_NUMBER_ID/groups" \
  -H "Authorization: Bearer ACCESS_TOKEN"

# Find your staff group in the response
```

### Configuration in n8n

1. Open n8n UI at http://localhost:5678
2. Go to Settings → Credentials
3. Click "Add Credential"
4. Select "Generic Credential Type"
5. Configure:
   - **Name**: WhatsApp Business API
   - **Fields**:
     ```json
     {
       "whatsappAccessToken": "YOUR_ACCESS_TOKEN",
       "whatsappPhoneId": "123456789012345",
       "whatsappSecret": "YOUR_APP_SECRET",
       "whatsappStaffGroupId": "STAFF_GROUP_ID"
     }
     ```
6. Click "Save"

### Testing WhatsApp Credentials

#### Test Sending Message

```bash
curl -X POST "https://graph.facebook.com/v18.0/PHONE_NUMBER_ID/messages" \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "905551234567",
    "type": "text",
    "text": {
      "body": "Test message from n8n"
    }
  }'
```

#### Test Webhook Signature

```bash
# In n8n, create a test workflow with webhook trigger
# Send test webhook from Meta dashboard
# Verify signature verification passes
```

---

## 3. Webhook Configuration

### Setup Webhook URL

1. In Meta App Dashboard → WhatsApp → Configuration
2. Click "Edit" next to Webhook
3. Configure:
   - **Callback URL**: `https://your-domain.com/webhook/whatsapp-coupon`
   - **Verify Token**: Create a random string (e.g., `my_verify_token_123`)
4. Click "Verify and Save"

### Subscribe to Webhook Fields

1. In Webhook section, click "Manage"
2. Subscribe to:
   - ✅ `messages`
3. Click "Save"

### Webhook Verification

Meta will send a GET request to verify your webhook:

```
GET /webhook/whatsapp-coupon?hub.mode=subscribe&hub.verify_token=my_verify_token_123&hub.challenge=CHALLENGE_STRING
```

n8n webhook should respond with the challenge string.

### Production Setup with Cloudflare Tunnel

The production webhook uses Cloudflare Tunnel for a permanent HTTPS URL:

- **Webhook URL**: `https://webhook.eformspa.com/api/whatsapp/webhook`
- **Tunnel Service**: Running as systemd service on Raspberry Pi
- **No URL changes** - Permanent domain configured in Cloudflare

```bash
# Check tunnel status
ssh eform-kio@192.168.1.5 "systemctl status cloudflared --no-pager"

# Restart if needed
ssh eform-kio@192.168.1.5 "sudo systemctl restart cloudflared"
```

---

## 4. Credential Security

### Storage
- ✅ Store in n8n credential system (encrypted at rest)
- ✅ Use environment variables for systemd service
- ❌ Never hardcode in workflow JSON
- ❌ Never commit to git

### Access Control
- ✅ Limit n8n UI access (basic auth)
- ✅ Use HTTPS for all endpoints
- ✅ Restrict server access (firewall)
- ✅ Use separate credentials for dev/prod

### Rotation Schedule
- **Backend API Key**: Every 90 days
- **WhatsApp Access Token**: Every 180 days or on suspected compromise
- **App Secret**: Only on suspected compromise

### Monitoring
- ✅ Monitor for 401 errors (invalid credentials)
- ✅ Alert on repeated authentication failures
- ✅ Log credential usage (without exposing values)

---

## 5. Troubleshooting

### Issue: Backend returns 401

**Symptoms**: "Invalid API key" error in n8n

**Solutions**:
1. Verify API key matches between n8n and backend .env
2. Check Authorization header format: `Bearer <KEY>`
3. Ensure no extra spaces or newlines in key
4. Restart backend after changing .env

### Issue: WhatsApp API returns 401

**Symptoms**: "Invalid access token" error

**Solutions**:
1. Verify token hasn't expired (temporary tokens expire in 24h)
2. Check token has correct permissions
3. Verify phone number ID is correct
4. Ensure token is for correct Meta app

### Issue: Webhook signature verification fails

**Symptoms**: "Invalid webhook signature" error

**Solutions**:
1. Verify app secret matches Meta dashboard
2. Check payload isn't modified by proxy
3. Ensure Content-Type is application/json
4. Verify signature calculation algorithm

### Issue: Can't send to staff group

**Symptoms**: "Invalid recipient" error

**Solutions**:
1. Verify group ID is correct
2. Ensure bot is member of group
3. Check group permissions allow bot messages
4. Verify phone number has group messaging permission

---

## 6. Production Checklist

Before deploying to production:

- [ ] Backend API key generated with openssl
- [ ] Backend API key added to backend .env
- [ ] Backend API key added to n8n credentials
- [ ] Backend API key tested with curl
- [ ] WhatsApp permanent access token obtained
- [ ] WhatsApp phone number verified
- [ ] WhatsApp app secret obtained
- [ ] Staff group ID obtained
- [ ] All credentials added to n8n
- [ ] Webhook URL configured in Meta dashboard
- [ ] Webhook signature verification tested
- [ ] Test message sent successfully
- [ ] Test message received successfully
- [ ] All credentials documented (not values!)
- [ ] Credential rotation schedule established
- [ ] Monitoring alerts configured

---

## 7. Environment Variables Reference

### Backend (.env)
```bash
# API Authentication
N8N_API_KEY=<backend-api-key>

# WhatsApp (optional, if backend needs direct access)
WHATSAPP_NUMBER=<business-phone-number>
```

### n8n (systemd service or .env)
```bash
# n8n Configuration
N8N_PORT=5678
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=<secure-password>
WEBHOOK_URL=https://<your-domain>
TZ=Europe/Istanbul
GENERIC_TIMEZONE=Europe/Istanbul
```

---

## 8. Related Documentation

- [Meta WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [n8n Credentials Documentation](https://docs.n8n.io/credentials/)
- Backend API Routes: `backend/src/routes/integrationCouponRoutes.ts`
- n8n Development Guide: `../.kiro/steering/n8n-development.md`

---

## Status

✅ Template created  
⏳ Credentials to be configured per environment  
⏳ Production deployment pending

Last Updated: 2025-11-28
