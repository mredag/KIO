# WhatsApp Coupon Integration - Complete Setup Guide

**Status:** ✅ Working and Tested (Nov 29, 2025)  
**Last Successful Test:** "✅ Kupon eklendi! 2/4 - 2 kupon daha toplayın."

---

## Overview

This system allows customers to collect loyalty coupons via WhatsApp. When a customer sends a coupon code (e.g., `KUPON ABC123DEF456`), the system:
1. Receives the message via Meta WhatsApp Business API webhook
2. Processes it through n8n workflow on Raspberry Pi
3. Calls the backend API to consume the coupon
4. Sends a Turkish response back to the customer

## Architecture

```
Customer WhatsApp → Meta Cloud API → Cloudflare Tunnel → Backend (Pi) → n8n → Backend API → SQLite DB
                                                                                    ↓
                                                                              WhatsApp Reply
```

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Meta WhatsApp Business API | Cloud | Receives/sends WhatsApp messages |
| Cloudflare Tunnel | Pi (systemd) | Permanent HTTPS webhook URL |
| Backend Webhook Proxy | Raspberry Pi (port 3001) | Receives & forwards to n8n |
| n8n | Raspberry Pi (port 5678) | Workflow automation |
| Backend API | Raspberry Pi (port 3001) | Coupon business logic |
| SQLite Database | Raspberry Pi | Stores coupon data |

---

## Configuration Details

### Meta Developer Console

**App ID:** `1311694093443416`  
**Business Account ID:** `376093462264266`  
**Phone Number ID:** `471153662739049`

**Webhook Configuration:**
- Callback URL: `https://webhook.eformspa.com/api/whatsapp/webhook`
- Verify Token: `spa-kiosk-verify-token`
- Subscribed Fields: `messages` ✅

### n8n Credentials (on Pi)

1. **Backend API Key** (Header Auth)
   - Name: `Authorization`
   - Value: `Bearer dwsQf8q0BpFWXPqMhwy2SGLG/wHIw1hKyjW8eI4Cgd8=`

2. **WhatsApp Business API** (Header Auth)
   - Name: `Authorization`
   - Value: `Bearer <WHATSAPP_ACCESS_TOKEN>`

### Backend Environment Variables

```env
N8N_API_KEY=dwsQf8q0BpFWXPqMhwy2SGLG/wHIw1hKyjW8eI4Cgd8=
WHATSAPP_VERIFY_TOKEN=spa_kiosk_webhook_verify_2024
WHATSAPP_PHONE_NUMBER_ID=471153662739049
```

---

## n8n Workflow Structure

**Workflow Name:** `WhatsApp Coupon Handler - WORKING TESTED`  
**File:** `n8n-workflows/workflows/whatsapp-working-tested.json`

### Node Flow

```
┌─────────────────┐     ┌──────────────┐     ┌──────────────────┐
│  WhatsApp GET   │────▶│ Verify Token │────▶│ Return Challenge │
└─────────────────┘     └──────────────┘     └──────────────────┘
        (Meta webhook verification)

┌─────────────────┐     ┌───────────────┐     ┌───────────┐
│  WhatsApp POST  │────▶│ Parse Message │────▶│ Is KUPON? │
└─────────────────┘     └───────────────┘     └───────────┘
                                                    │
                              ┌─────────────────────┼─────────────────────┐
                              ▼                                           ▼
                       ┌──────────────┐                           ┌─────────────┐
                       │ Extract Token│                           │ Respond Skip│
                       └──────────────┘                           └─────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Call Backend API │
                    └──────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Format Response │
                    └─────────────────┘
                              │
                              ▼
                   ┌────────────────────┐
                   │ Send WhatsApp Reply│
                   └────────────────────┘
                              │
                              ▼
                       ┌────────────┐
                       │ Respond OK │
                       └────────────┘
```

### Key Design Decisions

1. **Separate GET/POST Webhooks:** Meta sends GET for verification, POST for messages. Using separate nodes prevents conflicts.

2. **Response Mode:** Set to `responseNode` so we can respond after processing (not immediately).

3. **Continue on Fail:** Backend API call has `continueOnFail: true` to handle errors gracefully.

4. **Phone Normalization:** Adds `+` prefix to phone numbers for Turkish format.

---

## Message Format

### Customer Input
```
KUPON ABC123DEF456
```

### Response Messages (Turkish)

| Scenario | Message |
|----------|---------|
| Success | ✅ Kupon eklendi! 2/4 - 2 kupon daha toplayın. |
| Free massage earned | ✅ Kupon eklendi! 4/4 - Ücretsiz masaj hakkınız var! |
| Invalid token | ❌ Bu kupon geçersiz veya kullanılmış. |
| Expired token | ❌ Bu kuponun süresi dolmuş. |
| Rate limited | ⏳ Çok fazla istek. Lütfen bekleyin. |
| Invalid format | ❌ Geçersiz format. KUPON ABC123DEF456 şeklinde gönderin. |

---

## Deployment Steps

### 1. Cloudflare Tunnel (Already Configured)
The webhook uses Cloudflare Tunnel for a permanent HTTPS URL:
- **URL**: `https://webhook.eformspa.com/api/whatsapp/webhook`
- **Service**: Running as systemd service on Pi

```bash
# Check tunnel status
ssh eform-kio@192.168.1.5 "systemctl status cloudflared --no-pager"
```

### 2. Configure Meta Webhook
1. Go to: https://developers.facebook.com/apps/1311694093443416
2. Navigate: WhatsApp → Configuration → Webhooks
3. Set Callback URL: `https://webhook.eformspa.com/api/whatsapp/webhook`
4. Set Verify Token: `spa-kiosk-verify-token`
5. Subscribe to: `messages` field

### 3. Import Workflow to n8n
```bash
# Copy workflow to Pi
scp n8n-workflows/workflows/whatsapp-working-tested.json eform-kio@192.168.1.5:~/n8n-workflows/

# SSH to Pi and import
ssh eform-kio@192.168.1.5
n8n import:workflow --input=/home/eform-kio/n8n-workflows/whatsapp-working-tested.json

# Activate workflow
n8n update:workflow --all --active=true
```

### 4. Create n8n Credentials
In n8n UI (http://192.168.1.5:5678):
1. Create "Backend API Key" (Header Auth)
2. Create "WhatsApp Business API" (Header Auth)

### 5. Test
Send a WhatsApp message to the business number:
```
KUPON TEST12345678
```

---

## Troubleshooting

### Webhook Not Receiving Messages

1. **Check Cloudflare Tunnel:** `ssh eform-kio@192.168.1.5 "systemctl status cloudflared --no-pager"`
2. **Test webhook URL:** `curl https://webhook.eformspa.com/api/whatsapp/webhook`
3. **Verify Meta subscription:** Must have `messages` field subscribed
4. **Check n8n workflow is active:** `n8n export:workflow --all`

### 404 Errors on Webhook

**Cause:** Workflow not active or wrong webhook path  
**Fix:** Ensure workflow is active and path is `/webhook/whatsapp`

### Verification Works but POST Fails

**Cause:** Single webhook node trying to handle both GET and POST  
**Fix:** Use separate GET and POST webhook nodes (as in working workflow)

### Backend API Returns 401

**Cause:** Invalid or missing API key  
**Fix:** Check `N8N_API_KEY` in backend `.env` matches n8n credential

### WhatsApp Reply Not Sent

**Cause:** Invalid access token or phone number ID  
**Fix:** Verify `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`

---

## Files Reference

| File | Purpose |
|------|---------|
| `n8n-workflows/workflows/whatsapp-working-tested.json` | Working n8n workflow |
| `backend/.env` | Backend configuration |
| `backend/src/routes/integrationCouponRoutes.ts` | API endpoints |
| `backend/src/services/CouponService.ts` | Business logic |
| `WHATSAPP_WEBHOOK_CONFIG.md` | Quick webhook reference |

---

## API Endpoints

### Consume Coupon
```
POST /api/integrations/coupons/consume
Authorization: Bearer <N8N_API_KEY>
Content-Type: application/json

{
  "phone": "+905551234567",
  "token": "ABC123DEF456"
}
```

**Response:**
```json
{
  "ok": true,
  "balance": 2,
  "remainingToFree": 2
}
```

---

## Security Notes

- Never commit `.env` files with real tokens
- Rotate `WHATSAPP_ACCESS_TOKEN` periodically (expires after ~60 days)
- Use HTTPS for all webhook URLs
- API key should be strong (32+ bytes, base64 encoded)

---

## Maintenance

### Cloudflare Tunnel
The webhook uses Cloudflare Tunnel with a permanent URL (`https://webhook.eformspa.com`).
No URL changes needed - the tunnel runs as a systemd service.

```bash
# Check tunnel status
ssh eform-kio@192.168.1.5 "systemctl status cloudflared --no-pager"

# Restart if needed
ssh eform-kio@192.168.1.5 "sudo systemctl restart cloudflared"
```

### Refreshing WhatsApp Token
1. Go to Meta Developer Console
2. Generate new System User Token
3. Update `WHATSAPP_ACCESS_TOKEN` in backend `.env`
4. Update n8n "WhatsApp Business API" credential

---

**Last Updated:** November 29, 2025  
**Tested By:** Kiro Agent  
**Status:** Production Ready ✅
