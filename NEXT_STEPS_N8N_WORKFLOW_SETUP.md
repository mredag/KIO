# n8n Workflow Setup - Complete

**Date:** 2025-12-02  
**Status:** ✅ Production Ready

---

## ✅ All Steps Completed

- [x] WhatsApp Business API setup (permanent token)
- [x] Backend coupon system deployed on Pi
- [x] Database tables created (5 coupon tables)
- [x] n8n installed on Pi (v1.121.3)
- [x] n8n workflows configured and active
- [x] Cloudflare Tunnel configured (permanent webhook URL)
- [x] Meta webhook configured and verified
- [x] End-to-end testing completed

---

## 🔌 Pi Connection Info

### SSH Access
```bash
ssh eform-kio@192.168.1.5
```

### Service URLs
| Service | URL |
|---------|-----|
| Kiosk | http://192.168.1.5:3001 |
| Admin Panel | http://192.168.1.5:3001/admin |
| n8n Dashboard | http://192.168.1.5:5678 |
| Webhook (public) | https://webhook.eformspa.com |

### Service Management
```bash
# Check all services
ssh eform-kio@192.168.1.5 "pm2 status && systemctl status n8n --no-pager | head -5 && systemctl status cloudflared --no-pager | head -5"

# Restart all services
ssh eform-kio@192.168.1.5 "pm2 restart kiosk-backend && sudo systemctl restart n8n && sudo systemctl restart cloudflared"
```

---

## 🎯 Current Architecture

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
Backend (port 3001) → n8n (port 5678)
     │
     ▼
Coupon API → SQLite DB
     │
     ▼
WhatsApp Reply
```

---

## 📱 Supported Commands

| Command | Description |
|---------|-------------|
| `KUPON <code>` | Submit coupon code |
| `DURUM` / `BAKIYE` | Check balance |
| `KUPON KULLAN` | Redeem 4 coupons |
| `YARDIM` | Get help |
| `IPTAL` | Opt out |

---

## 🔧 Quick Troubleshooting

### Check Services
```bash
ssh eform-kio@192.168.1.5 "systemctl status cloudflared --no-pager | head -3"
ssh eform-kio@192.168.1.5 "systemctl status n8n --no-pager | head -3"
ssh eform-kio@192.168.1.5 "pm2 status"
```

### Test Webhook
```bash
curl -X POST https://webhook.eformspa.com/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{"entry":[{"changes":[{"value":{"messages":[{"from":"905551234567","text":{"body":"DURUM"}}]}}]}]}'
```

### Restart Everything
```bash
ssh eform-kio@192.168.1.5 "sudo systemctl restart cloudflared && sudo systemctl restart n8n && pm2 restart kiosk-backend"
```

---

## 📝 Credentials Reference

| Service | Credential |
|---------|------------|
| n8n Login | admin@spa-kiosk.local / Admin123! |
| Admin Panel | admin / admin123 |
| Backend API Key | `dwsQf8q0BpFWXPqMhwy2SGLG/wHIw1hKyjW8eI4Cgd8=` |
| WhatsApp Phone ID | `471153662739049` |

---

## 🔗 Documentation

- [WhatsApp Setup Progress](./WHATSAPP_SETUP_PROGRESS.md)
- [n8n Setup Continuation](./docs/WHATSAPP_N8N_SETUP_CONTINUATION.md)
- [Coupon Integration Guide](./docs/WHATSAPP_COUPON_INTEGRATION.md)

---

**Status:** ✅ Production Ready - No further setup needed
