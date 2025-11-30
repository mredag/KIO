# WhatsApp n8n Setup - Continuation Guide

**Last Updated:** 2025-11-29
**Status:** v2 workflows imported, credentials need to be linked in n8n UI

---

## Current Setup Status

### ✅ Completed

1. **n8n installed and running** on Raspberry Pi (192.168.1.5:5678)
2. **4 workflows imported and active:**
   - WhatsApp Coupon Capture
   - WhatsApp Balance Check
   - WhatsApp Claim Redemption
   - WhatsApp Opt-Out

3. **Credentials created in n8n:**
   - Backend API Key (Header Auth)
   - WhatsApp Business API (Header Auth)

4. **Credentials linked to workflows:**
   - Backend API nodes → Backend API Key
   - WhatsApp API nodes → WhatsApp Business API

5. **Backend API verified working:**
   ```bash
   curl -s -X GET 'http://192.168.1.5:3001/api/integrations/coupons/wallet/905551234567' \
     -H 'Authorization: Bearer dwsQf8q0BpFWXPqMhwy2SGLG/wHIw1hKyjW8eI4Cgd8='
   # Returns: {"phone":"+905551234567","couponCount":0,...}
   ```

6. **Ngrok installed and configured:**
   - Auth token configured
   - Running as background process
   - Public URL: `https://tibial-marlena-lumberly.ngrok-free.dev`

---

## 🔴 Next Step: Configure Meta WhatsApp Webhook

### Webhook URLs

| Workflow | Public Webhook URL |
|----------|-------------------|
| Coupon Capture | `https://tibial-marlena-lumberly.ngrok-free.dev/webhook/whatsapp-coupon` |
| Balance Check | `https://tibial-marlena-lumberly.ngrok-free.dev/webhook/whatsapp-balance` |
| Claim Redemption | `https://tibial-marlena-lumberly.ngrok-free.dev/webhook/whatsapp-claim` |
| Opt-Out | `https://tibial-marlena-lumberly.ngrok-free.dev/webhook/whatsapp-optout` |

### Steps to Configure Meta Webhook

1. **Go to Meta Business Suite:**
   - https://business.facebook.com/
   - Navigate to WhatsApp → Configuration

2. **Configure Webhook:**
   - Click "Edit" on Webhook section
   - **Callback URL:** `https://tibial-marlena-lumberly.ngrok-free.dev/webhook/whatsapp-coupon`
   - **Verify Token:** `spa-kiosk-verify-token` (or any string you choose)
   - Click "Verify and Save"

3. **Subscribe to Webhook Fields:**
   - Check "messages" field
   - Save changes

4. **Test the Integration:**
   - Send a WhatsApp message to your business number (905365100558)
   - Message: `KUPON ABC123DEF456` (use a valid token from admin panel)

---

## Important Notes

### Ngrok URL Changes
- **Free ngrok URLs change every restart!**
- Current URL: `https://tibial-marlena-lumberly.ngrok-free.dev`
- After Pi restart, you'll need to:
  1. Start ngrok again: `ngrok http 5678`
  2. Get new URL: `curl http://localhost:4040/api/tunnels`
  3. Update Meta webhook with new URL

### For Production (Permanent Solution)
Options:
1. **Ngrok paid plan** - Get a static domain
2. **Port forwarding** - Forward router port to Pi
3. **Cloud deployment** - Deploy n8n to a VPS
4. **Cloudflare Tunnel** - Free alternative to ngrok

---

## Quick Commands Reference

### Check ngrok status
```bash
ssh eform-kio@192.168.1.5 "curl -s http://localhost:4040/api/tunnels | jq '.tunnels[0].public_url'"
```

### Restart ngrok
```bash
ssh eform-kio@192.168.1.5 "pkill ngrok; nohup ngrok http 5678 --log=stdout > ~/ngrok.log 2>&1 &"
```

### Check n8n status
```bash
ssh eform-kio@192.168.1.5 "systemctl status n8n --no-pager"
```

### Check backend status
```bash
ssh eform-kio@192.168.1.5 "pm2 status"
```

### Test backend API
```bash
ssh eform-kio@192.168.1.5 "curl -s http://localhost:3001/api/kiosk/health"
```

---

## Test Messages (After Meta Webhook Configured)

Send these to your WhatsApp Business number (905365100558):

| Action | Message |
|--------|---------|
| Add coupon | `KUPON ABC123DEF456` |
| Check balance | `bakiye` |
| Claim redemption | `kupon kullan` |
| Opt out | `durdur` |

---

## Credentials Reference

### n8n Access
- **URL:** http://192.168.1.5:5678
- **Email:** admin@spa-kiosk.local
- **Password:** Admin123!

### Backend API Key
- **Header:** `Authorization: Bearer dwsQf8q0BpFWXPqMhwy2SGLG/wHIw1hKyjW8eI4Cgd8=`

### WhatsApp Business
- **Phone Number:** 905365100558
- **Access Token:** (configured in n8n credentials)

---

## Troubleshooting

### Webhook not receiving messages
1. Check ngrok is running: `curl http://localhost:4040/api/tunnels`
2. Verify Meta webhook URL matches ngrok URL
3. Check n8n workflow is active (green toggle)

### API returns HTML instead of JSON
- Backend needs restart: `pm2 restart kiosk-backend`

### Ngrok URL changed
- Get new URL and update Meta webhook configuration

### n8n workflow errors
- Check n8n Executions tab for error details
- Verify credentials are linked to HTTP Request nodes

---

## Architecture Summary

```
WhatsApp User
     │
     ▼
Meta WhatsApp API
     │
     ▼ (webhook)
Ngrok Public URL
     │
     ▼ (tunnel)
Raspberry Pi (192.168.1.5)
     │
     ├─► n8n (port 5678) - Workflow automation
     │        │
     │        ▼
     └─► Backend API (port 3001) - Coupon system
              │
              ▼
         SQLite Database
```

---

**Next Action:** Configure Meta WhatsApp webhook with the ngrok URL above.


---

## 🔴 CRITICAL: Use V1 Workflows (Not V2)

**V2 workflows won't work** - they use WhatsApp Trigger which is limited to 1 per phone number by Facebook.

**V1 workflows are correct** - they use n8n Webhook triggers (unlimited).

### V1 Workflows (Use These)

| Workflow | Webhook Path |
|----------|--------------|
| WhatsApp Coupon Capture | `/webhook/whatsapp-coupon` |
| WhatsApp Balance Check | `/webhook/whatsapp-balance` |
| WhatsApp Claim Redemption | `/webhook/whatsapp-claim` |
| WhatsApp Opt-Out | `/webhook/whatsapp-optout` |

### Next Steps

1. **Delete v2 workflows** (they won't work)
2. **Import v1 workflows** from `n8n-workflows/workflows/`
3. **Link credentials** in n8n UI:
   - Webhook nodes → No credential needed
   - HTTP Request (Backend API) → Backend API Key
   - HTTP Request (WhatsApp) → WhatsApp Business API
4. **Configure Meta webhook** with ngrok URL
5. **Test with real WhatsApp message**

### Import V1 Workflows

```bash
# Copy v1 workflows to Pi
scp n8n-workflows/workflows/*.json eform-kio@192.168.1.5:~/n8n-workflows/

# Import via n8n CLI
ssh eform-kio@192.168.1.5 "n8n import:workflow --separate --input=/home/eform-kio/n8n-workflows/"
```

### Meta App Credentials (for reference)

- **App ID:** 1311694093443416
- **App Secret:** 36e2f75cab508989d382282c71d205f0
- **Verify Token:** `spa_kiosk_webhook_verify_2024`

---

## Summary of What's Done

1. ✅ n8n installed and running on Pi
2. ✅ Backend API Key credential created
3. ✅ WhatsApp Business API credential created
4. ✅ Ngrok installed and configured
5. 🔴 **PENDING:** Import v1 workflows (delete v2)
6. 🔴 **PENDING:** Link credentials to v1 workflows
7. 🔴 **PENDING:** Configure Meta webhook with ngrok URL
