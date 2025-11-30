# WhatsApp Token Status

## ✅ Current Status: WORKING

**Last Verified:** 2024-11-30  
**Token Type:** System User Access Token  
**Expiration:** Never (permanent token)  
**Test Result:** Successfully sending messages

## Configuration

### Backend Environment Variables (backend/.env)
```env
# Permanent System User Token (never expires)
WHATSAPP_ACCESS_TOKEN=EAASoZBpRZBYVgBQI9tq7dTqVxCtB5SIHUKYZBcnsdGxpcU5xmmivOno8AUvQhsFLD0TiBEX71aCYP6NldygAA36fzuZCKK7ZApU7LBGXQiUTR0SLEnZC4AxZAvc6UD7qtkQMXGhZAEzrS6fFvooEu7As0AuqUBBDkJpRomKU3lJ4fQ5l8LCbg2clZAN0vegcX185tegZDZD
WHATSAPP_PHONE_NUMBER_ID=471153662739049
WHATSAPP_BUSINESS_ACCOUNT_ID=376093462264266
WHATSAPP_NUMBER=905067070403
```

### Token Permissions
- ✅ whatsapp_business_messaging
- ✅ whatsapp_business_management

## Testing

### Quick Test
```bash
node test-backend-whatsapp.js
```

**Expected Output:**
```
✅ SUCCESS! Message sent successfully
📱 Check your WhatsApp for the test message!
```

### Test Results (2024-11-30)
- ✅ Token validated in Graph API Explorer
- ✅ Message sent successfully via Graph API Explorer
- ✅ Backend test script successful
- ✅ Message received on WhatsApp (905067070403)

## Next Steps

### 1. Update n8n Credentials on Raspberry Pi

The n8n workflows on your Raspberry Pi need this new token:

```bash
# SSH to Pi
ssh eform-kio@192.168.1.5

# Access n8n UI
# Open browser: http://192.168.1.5:5678
# Login: admin@spa-kiosk.local / Admin123!

# Update credential:
# 1. Click "Credentials" in left sidebar
# 2. Find "WhatsApp Business API" credential
# 3. Update "Access Token" field with new token
# 4. Click "Save"
```

### 2. Activate n8n Workflows

Once credentials are updated, activate the workflows:

```bash
ssh eform-kio@192.168.1.5 "n8n update:workflow --all --active=true"
```

### 3. Test End-to-End

Send a test message to your WhatsApp Business number with a coupon code:
```
KUPON TEST123
```

Expected: You should receive a response from the bot.

## Troubleshooting

### If token stops working:

1. **Check token in Graph API Explorer**
   - Go to: https://developers.facebook.com/tools/explorer
   - Select your app
   - Try sending a test message

2. **Generate new token if needed**
   - Follow guide in: `docs/WHATSAPP_TOKEN_RENEWAL.md`

3. **Update both locations:**
   - Backend: `backend/.env`
   - n8n: Via n8n UI credentials

## Important Notes

- ⚠️ This is a **System User token** - it never expires
- ⚠️ Keep this token secret - never commit to git
- ⚠️ Token is already in `.gitignore` via `backend/.env`
- ✅ Token works for both backend API and n8n workflows
- ✅ Phone number format: No spaces, no +, just digits (e.g., 905067070403)

## Related Documentation

- Token renewal guide: `docs/WHATSAPP_TOKEN_RENEWAL.md`
- WhatsApp integration: `docs/WHATSAPP_COUPON_INTEGRATION.md`
- n8n setup: `.kiro/steering/n8n-development.md`

---

## Deployment Status (Raspberry Pi)

**Last Deployed:** 2025-11-30 02:05 AM

### n8n Workflow
- ✅ **Active Workflow:** WhatsApp Coupon Only - No Conflicts (with rate limiting)
- ✅ **Workflow ID:** eMgAIJOuqw3TgkDy
- ✅ **Status:** Active and running
- ✅ **Rate Limiting:** 1 message per second (prevents API errors)
- ✅ **Old workflows:** Deactivated to prevent conflicts
- ✅ **n8n service:** Running (systemd)

### Backend
- ✅ **Status:** Running (PM2)
- ✅ **Database:** Coupon tables exist
- ✅ **Token:** Updated in backend/.env

### Workflow Features
- ✅ Only responds to coupon-related keywords (KUPON, kupon, etc.)
- ✅ Ignores all other messages (no conflicts with Botpress)
- ✅ 100% Turkish messages
- ✅ Proper error handling and rate limiting

### Test on Pi
```bash
# Create test coupon on Pi
ssh eform-kio@192.168.1.5
cd ~/spa-kiosk
node -e "const db = require('better-sqlite3')('./data/kiosk.db'); const token = 'TEST' + Math.random().toString(36).substr(2, 9).toUpperCase(); db.prepare('INSERT INTO coupon_tokens (token, expires_at) VALUES (?, datetime(\"now\", \"+30 days\"))').run(token); console.log('Test token:', token); db.close();"
```

Then send to WhatsApp: `KUPON <token>`

---

**Status:** ✅ Deployed and ready for production  
**Last Updated:** 2025-11-30 02:05 AM
