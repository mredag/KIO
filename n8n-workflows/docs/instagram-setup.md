# Instagram AI Agent Setup Guide

## 📋 Overview

### Workflow Versions

| Version | File | Features |
|---------|------|----------|
| v1 | `instagram-ai-agent.json` | Basic AI responses |
| v3 | `instagram-ai-agent-v3.json` | **Recommended** - Customer data + Interaction logging |

**Use v3 for production** - includes customer enrichment and marketing analytics.

---

This workflow creates an AI-powered Instagram DM chatbot that can:
- Answer questions about your SPA (location, prices, hours)
- Provide service information
- Direct customers to WhatsApp for coupon operations
- Maintain conversation context (memory)

## 🔧 Prerequisites

### Meta Developer Console
You've already completed:
- ✅ Instagram App created: `EformApp-IG` (ID: 1356323395834209)
- ✅ Permissions added: `instagram_business_basic`, `instagram_manage_comments`, `instagram_business_manage_messages`
- ✅ Access Token generated

### Required Credentials
1. **Instagram Access Token** (you have this):
   ```
   IGAATRkaY1kWFBZAGFvTnZACd0ZAMUy1peklsTUtWczVISjBRWjN0a2s2RnlIcUFreEM5WkRrT3VSNi13VHpUYzc0TUJnaHR2MTNvMTRsUXVpS1MxaWRBSlFvMEQwTENkVkhwRC1kUjQ1ZAUtzOEtqN083cmltYnRwUjN3b2I4WmgxUQZDZD
   ```

2. **Google Gemini API Key** (for AI):
   - Get from: https://makersuite.google.com/app/apikey
   - Create credential in n8n: Settings → Credentials → Google Gemini

## 🚀 Deployment Steps

### Step 1: Configure Webhook in Meta

In Meta Developer Console → Instagram API → Configure webhooks:

**Callback URL:**
```
https://webhook.eformspa.com/webhook/instagram
```

> **Note:** This URL goes through your backend (like WhatsApp), which then forwards to n8n.

**Verify Token:**
```
spa-kiosk-instagram-verify
```

**Subscribe to fields:**
- ✅ `messages`
- ✅ `messaging_postbacks`

### Step 2: Deploy Workflow to n8n

```bash
# Copy workflow to Pi
scp n8n-workflows/workflows-v2/instagram-ai-agent.json eform-kio@192.168.1.5:~/instagram-ai-agent.json

# SSH to Pi
ssh eform-kio@192.168.1.5

# Import workflow
n8n import:workflow --input=~/instagram-ai-agent.json

# Create Gemini credential (in n8n UI)
# Settings → Credentials → Add → Google Gemini API

# Activate workflow
n8n update:workflow --all --active=true

# Restart n8n
sudo systemctl restart n8n
```

### Step 3: Update Knowledge Base

Edit the workflow's AI Agent system prompt with your actual SPA information:

1. Open n8n UI: http://192.168.1.5:5678
2. Find "Instagram SPA AI Agent" workflow
3. Click "AI Agent" node
4. Update the System Message with your:
   - Actual address
   - Phone number
   - Current prices
   - Working hours
   - Special offers

### Step 4: Test

Send a DM to your Instagram Business account:
- "Neredesiniz?"
- "Fiyatlar ne kadar?"
- "Saat kaça kadar açıksınız?"

## 📊 Workflow Architecture

```
┌─────────────┐
│  Webhook    │ (Instagram POST /webhook/instagram)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Parse     │ (Extract senderId, text from IG format)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Router    │ → Verify (webhook verification)
│             │ → Process (actual messages)
│             │ → Ignore (read receipts, etc.)
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────┐
│              AI Agent                    │
│  ┌─────────────────────────────────┐    │
│  │    System Prompt (Knowledge)    │    │
│  │    - SPA info, prices, hours    │    │
│  │    - Response guidelines        │    │
│  └─────────────────────────────────┘    │
│                                          │
│  ┌─────────────────────────────────┐    │
│  │    Chat Memory (per user)       │    │
│  │    sessionKey: ig_{senderId}    │    │
│  └─────────────────────────────────┘    │
│                                          │
│  ┌─────────────────────────────────┐    │
│  │    Gemini 2.0 Flash             │    │
│  └─────────────────────────────────┘    │
└──────────────────┬──────────────────────┘
                   │
                   ▼
            ┌─────────────┐
            │   Format    │ (Clean markdown, limit length)
            └──────┬──────┘
                   │
                   ▼
            ┌─────────────┐
            │  Send IG    │ (POST to graph.facebook.com/me/messages)
            └──────┬──────┘
                   │
                   ▼
            ┌─────────────┐
            │  Respond OK │
            └─────────────┘
```

## 🔑 Key Differences from WhatsApp

| Aspect | WhatsApp | Instagram |
|--------|----------|-----------|
| Webhook object | `whatsapp_business_account` | `instagram` |
| Message location | `entry[0].changes[0].value.messages[0]` | `entry[0].messaging[0].message` |
| User ID | Phone number | Instagram-scoped ID (IGSID) |
| Send endpoint | `/PHONE_ID/messages` | `/me/messages` |
| Message format | `messaging_product: "whatsapp"` | `recipient: {id: "..."}` |

## ⚠️ Important Limitations

1. **24-Hour Window**: Can only reply within 24 hours of user's last message
2. **No Proactive Messaging**: Can't message users who haven't messaged first
3. **Rate Limits**: ~200 messages/hour for new apps
4. **Token Expiration**: Check token validity periodically

## 🔧 Customization

### Adding More Knowledge

Edit the system prompt to add:
- Seasonal promotions
- New services
- FAQ answers
- Booking policies

### Adding Tools (Advanced)

You can add HTTP Request Tools to:
- Query massage menu from database
- Check real-time availability
- Look up customer history

Example tool for massage menu:
```json
{
  "name": "masaj_listesi",
  "description": "Guncel masaj listesi ve fiyatlarini getirir",
  "method": "GET",
  "url": "http://localhost:3001/api/kiosk/menu",
  "authentication": "none"
}
```

## 🐛 Troubleshooting

### "Invalid OAuth access token"
- Token expired or invalid
- Regenerate in Meta Developer Console
- Update in workflow

### "Message failed to send"
- Check 24-hour window
- Verify recipient ID format
- Check rate limits

### "Webhook not receiving messages"
- Verify webhook URL in Meta Console
- Check Cloudflare Tunnel is running
- Verify n8n workflow is active

### AI responses are wrong
- Update knowledge base in system prompt
- Adjust temperature (lower = more consistent)
- Add more example responses

## 📝 Sample Conversations

**User:** Merhaba, neredesiniz?
**Bot:** Merhaba! 👋 Biz [ADRES] adresindeyiz. Hafta içi 10:00-22:00, Pazar 12:00-20:00 arası hizmetinizdeyiz. Randevu için 0532 XXX XX XX numarasını arayabilirsiniz! 💆‍♀️

**User:** Fiyatlar ne kadar?
**Bot:** İşte en popüler hizmetlerimiz 💆‍♀️
• Klasik Masaj (50dk): 800₺
• Aromaterapi (60dk): 1000₺
• Thai Masaj (60dk): 1200₺
Tüm hizmetler için bizi arayın: 0532 XXX XX XX

**User:** Kupon sistemini nasıl kullanıyorum?
**Bot:** Kupon sistemi WhatsApp üzerinden çalışıyor! 📱 0532 XXX XX XX numarasına "DURUM" yazarak bakiyenizi öğrenebilirsiniz. 4 kupon = 1 ücretsiz masaj! 🎁

---

## 🆕 V3 Features: Customer Data & Analytics

### New Backend API Endpoints

The v3 workflow uses these new API endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/integrations/instagram/customer/:id` | GET | Fetch customer data |
| `/api/integrations/instagram/interaction` | POST | Log interactions |
| `/api/integrations/instagram/analytics` | GET | Marketing analytics |
| `/api/integrations/instagram/export` | GET | Export to CSV |

### Customer Enrichment Flow

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Message    │────▶│ Fetch Customer   │────▶│ Enrich Context  │
│  Received   │     │ Data from DB     │     │ for AI          │
└─────────────┘     └──────────────────┘     └─────────────────┘
                           │
                           ▼
                    ┌──────────────────┐
                    │ Customer Info:   │
                    │ - isNewCustomer  │
                    │ - couponBalance  │
                    │ - interactionCnt │
                    └──────────────────┘
```

### Interaction Logging

Every message is logged with:
- `instagramId` - User's Instagram ID
- `direction` - inbound/outbound
- `messageText` - Original message
- `intent` - Detected intent (pricing, hours, booking, etc.)
- `sentiment` - positive/neutral/negative
- `aiResponse` - What the AI replied
- `responseTime` - Response latency in ms

### Marketing Analytics Dashboard

Access analytics via API:

```bash
# Get summary stats
curl http://192.168.1.5:3001/api/integrations/instagram/analytics \
  -H "Authorization: Bearer YOUR_API_KEY"

# Export to CSV for Google Sheets
curl "http://192.168.1.5:3001/api/integrations/instagram/export?format=csv" \
  -H "Authorization: Bearer YOUR_API_KEY" > instagram_data.csv
```

Response includes:
- Total interactions & unique users
- Intent breakdown (what customers ask about most)
- Sentiment analysis
- Daily interaction trends
- Average response time

### Database Tables (Auto-created)

```sql
-- Customer profiles
instagram_customers (
  instagram_id, phone, name, last_visit,
  interaction_count, created_at
)

-- Interaction logs
instagram_interactions (
  id, instagram_id, direction, message_text,
  intent, sentiment, ai_response, response_time_ms
)
```

### Deploy V3 Workflow

```bash
# Copy v3 workflow to Pi
scp n8n-workflows/workflows-v2/instagram-ai-agent-v3.json eform-kio@192.168.1.5:~/instagram-v3.json

# SSH and import
ssh eform-kio@192.168.1.5
n8n import:workflow --input=~/instagram-v3.json
n8n update:workflow --all --active=true
sudo systemctl restart n8n
```

### Credential Requirements for V3

1. **Google Gemini API** (same as v1)
2. **Instagram Business API** (same as v1)
3. **N8N API Key** (new) - For backend API calls:
   - Name: `N8N API Key`
   - Type: Header Auth
   - Header: `Authorization`
   - Value: `Bearer YOUR_N8N_API_KEY` (from backend .env)

---

**Last Updated:** 2025-12-05
**Status:** Ready for deployment
**Recommended Workflow:** `instagram-ai-agent-v3.json`
