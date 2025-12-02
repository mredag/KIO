# WhatsApp n8n Setup - Continuation Guide

**Last Updated:** 2025-12-02
**Status:** ✅ Production Ready with Cloudflare Tunnel

---

## Current Setup Status

### ✅ Completed

1. **n8n installed and running** on Raspberry Pi (192.168.1.5:5678)

2. **Cloudflare Tunnel configured** (permanent HTTPS URL):
   - **Webhook URL:** `https://webhook.eformspa.com/webhook/whatsapp`
   - **Status:** Running as systemd service
   - **No more URL changes!** ✅

3. **Backend webhook proxy** configured:
   - Meta sends webhooks to: `https://webhook.eformspa.com/api/whatsapp/webhook`
   - Backend forwards to n8n: `http://localhost:5678/webhook/whatsapp`

4. **Active workflow:**
   - WhatsApp Kupon Ultimate v1 (handles all commands)

5. **Credentials configured in n8n:**
   - Backend API Key (Header Auth)
   - WhatsApp Business API (Header Auth)

6. **Backend API verified working:**
   ```bash
   curl -s -X GET 'http://192.168.1.5:3001/api/integrations/coupons/wallet/905551234567' \
     -H 'Authorization: Bearer dwsQf8q0BpFWXPqMhwy2SGLG/wHIw1hKyjW8eI4Cgd8='
   # Returns: {"phone":"+905551234567","couponCount":0,...}
   ```

---

## Architecture

```
WhatsApp User
     │
     ▼
Meta WhatsApp API
     │
     ▼ (webhook POST)
https://webhook.eformspa.com/api/whatsapp/webhook
     │
     ▼ (Cloudflare Tunnel)
Raspberry Pi Backend (port 3001)
     │
     ▼ (forward to n8n)
n8n (port 5678) /webhook/whatsapp
     │
     ├─► Process command (KUPON, DURUM, KULLAN, etc.)
     │
     ▼
Backend API (port 3001) - Coupon operations
     │
     ▼
WhatsApp Reply via Meta API
```

---

## Cloudflare Tunnel Configuration

### Service Status
```bash
# Check tunnel status
ssh eform-kio@192.168.1.5 "systemctl status cloudflared --no-pager"

# View tunnel logs
ssh eform-kio@192.168.1.5 "journalctl -u cloudflared -n 50 --no-pager"

# Restart tunnel if needed
ssh eform-kio@192.168.1.5 "sudo systemctl restart cloudflared"
```

### Tunnel Config Location
- Config file: `/home/eform-kio/.cloudflared/config.yml`
- Credentials: `/home/eform-kio/.cloudflared/credentials.json`

### Config Content
```yaml
tunnel: spa-webhook
credentials-file: /home/eform-kio/.cloudflared/credentials.json
ingress:
  - hostname: webhook.eformspa.com
    service: http://localhost:3001
  - service: http_status:404
```

---

## Meta Webhook Configuration

### Current Settings
- **Callback URL:** `https://webhook.eformspa.com/api/whatsapp/webhook`
- **Verify Token:** `spa-kiosk-verify-token`
- **Subscribed Fields:** `messages` ✅

### To Update (if needed)
1. Go to: https://developers.facebook.com/apps/1311694093443416/whatsapp-business/wa-settings/
2. Edit Webhook section
3. Update Callback URL if changed
4. Click "Verify and Save"

---

## Quick Commands Reference

### Check all services
```bash
# Cloudflare Tunnel
ssh eform-kio@192.168.1.5 "systemctl status cloudflared --no-pager | head -5"

# n8n
ssh eform-kio@192.168.1.5 "systemctl status n8n --no-pager | head -5"

# Backend
ssh eform-kio@192.168.1.5 "pm2 status"
```

### Test webhook endpoint
```bash
# Test from local machine
curl -X POST https://webhook.eformspa.com/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{"entry":[{"changes":[{"value":{"messages":[{"from":"905551234567","text":{"body":"DURUM"}}]}}]}]}'
```

### Restart services
```bash
# Restart all
ssh eform-kio@192.168.1.5 "sudo systemctl restart cloudflared && sudo systemctl restart n8n && pm2 restart kiosk-backend"
```

---

## Test Messages

Send these to WhatsApp Business number (+90 536 510 05 58):

| Action | Message |
|--------|---------|
| Add coupon | `KUPON ABC123DEF456` |
| Check balance | `DURUM` or `bakiye` |
| Claim redemption | `KUPON KULLAN` |
| Get help | `YARDIM` |
| Opt out | `IPTAL` |

---

## Credentials Reference

### n8n Access
- **URL:** http://192.168.1.5:5678
- **Email:** admin@spa-kiosk.local
- **Password:** Admin123!

### Backend API Key
- **Header:** `Authorization: Bearer dwsQf8q0BpFWXPqMhwy2SGLG/wHIw1hKyjW8eI4Cgd8=`

### WhatsApp Business
- **Phone Number:** +90 536 510 05 58
- **Phone Number ID:** 471153662739049
- **Access Token:** (configured in n8n credentials)

### Meta App
- **App ID:** 1311694093443416
- **App Secret:** 36e2f75cab508989d382282c71d205f0

---

## Troubleshooting

### Webhook not receiving messages
1. Check Cloudflare Tunnel: `systemctl status cloudflared`
2. Check backend is running: `pm2 status`
3. Check n8n is running: `systemctl status n8n`
4. Verify Meta webhook URL is correct

### n8n workflow errors
- Check n8n Executions tab for error details
- Verify credentials are linked to HTTP Request nodes

### Tunnel not connecting
```bash
# Restart tunnel
ssh eform-kio@192.168.1.5 "sudo systemctl restart cloudflared"

# Check logs
ssh eform-kio@192.168.1.5 "journalctl -u cloudflared -n 20"
```

---

## Migration from ngrok (Completed)

We migrated from ngrok to Cloudflare Tunnel because:
- ✅ **Permanent URL** - No more URL changes on restart
- ✅ **Free** - No paid plan needed
- ✅ **Reliable** - Runs as systemd service
- ✅ **Secure** - HTTPS with valid certificate

The ngrok setup has been removed and is no longer needed.

---

**Status:** ✅ Production Ready
**Last Verified:** 2025-12-02
