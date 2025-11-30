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
Customer WhatsApp → Meta Cloud API → ngrok → n8n (Pi) → Backend API → SQLite DB
                                                    ↓
                                              WhatsApp Reply
```

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Meta WhatsApp Business API | Cloud | Receives/sends WhatsApp messages |
| ngrok | Local/Pi | Tunnels webhook to local n8n |
| n8n | Raspberry Pi (192.168.1.5:5678) | Workflow automation |
| Backend API | Raspberry Pi (localhost:3001) | Coupon business logic |
| SQLite Database | Raspberry Pi | Stores coupon data |

---

## Configuration Details

### Meta Developer Console

**App ID:** `1311694093443416`  
**Business Account ID:** `376093462264266`  
**Phone Number ID:** `471153662739049`

**Webhook Configuration:**
- Callback URL: `https://<ngrok-subdomain>.ngrok-free.dev/webhook/whatsapp`
- Verify Token: `spa_kiosk_webhook_verify_2024`
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

### 1. Start ngrok (on development machine or Pi)
```bash
ngrok http 5678
```
Note the HTTPS URL (e.g., `https://tibial-marlena-lumberly.ngrok-free.dev`)

### 2. Configure Meta Webhook
1. Go to: https://developers.facebook.com/apps/1311694093443416
2. Navigate: WhatsApp → Configuration → Webhooks
3. Set Callback URL: `<ngrok-url>/webhook/whatsapp`
4. Set Verify Token: `spa_kiosk_webhook_verify_2024`
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

1. **Check ngrok is running:** `curl https://<ngrok-url>/webhook/whatsapp`
2. **Verify Meta subscription:** Must have `messages` field subscribed
3. **Check n8n workflow is active:** `n8n export:workflow --all`

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

### Renewing ngrok URL
When ngrok URL changes:
1. Get new URL from ngrok dashboard
2. Update Meta webhook callback URL
3. No changes needed in n8n (uses relative path)

### Refreshing WhatsApp Token
1. Go to Meta Developer Console
2. Generate new System User Token
3. Update `WHATSAPP_ACCESS_TOKEN` in backend `.env`
4. Update n8n "WhatsApp Business API" credential

---

**Last Updated:** November 29, 2025  
**Tested By:** Kiro Agent  
**Status:** Production Ready ✅
