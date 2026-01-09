# n8n Credentials Template

**⚠️ IMPORTANT:** Copy this file to `CREDENTIALS.md` and fill in your actual credentials. Never commit `CREDENTIALS.md` to git!

```bash
cp n8n-workflows/CREDENTIALS.template.md n8n-workflows/CREDENTIALS.md
```

---

## n8n Admin Access

| Field | Value |
|-------|-------|
| URL | http://192.168.1.5:5678 |
| Email | admin@spa-kiosk.local |
| Password | (set during n8n installation) |

## Pi SSH Access

| Field | Value |
|-------|-------|
| Host | 192.168.1.5 |
| User | eform-kio |
| Password | (use SSH key authentication) |

## Backend API Key

**Location:** Stored in `backend/.env` as `N8N_API_KEY`

```
N8N_API_KEY=<your-api-key-here>
```

**Generate with:**
```bash
openssl rand -base64 32
```

## WhatsApp Business API Token

**Location:** Stored in `backend/.env` as `WHATSAPP_ACCESS_TOKEN`

```
WHATSAPP_ACCESS_TOKEN=<your-whatsapp-token-here>
```

**How to get:**
1. Go to [Meta Developer Console](https://developers.facebook.com/)
2. Navigate to WhatsApp > API Setup
3. Copy the temporary or permanent access token
4. Add to backend `.env` file

## Instagram Business API Token

**Location:** Stored in `backend/.env` as `INSTAGRAM_ACCESS_TOKEN`

```
INSTAGRAM_ACCESS_TOKEN=<your-instagram-token-here>
```

**How to get:**
1. Go to [Meta Developer Console](https://developers.facebook.com/)
2. Navigate to Instagram > Basic Display
3. Generate access token
4. Add to backend `.env` file

## Google Gemini API Key

**Location:** Create in n8n credential system (not in files)

```
<your-gemini-api-key-here>
```

**How to get:**
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create API key
3. Add to n8n as "Google Gemini API" credential

## OpenRouter API Key (Optional)

**Location:** Create in n8n credential system (not in files)

```
sk-or-v1-<your-key-here>
```

**How to get:**
1. Go to [OpenRouter](https://openrouter.ai/keys)
2. Create a new API key
3. Copy the key (starts with `sk-or-v1-`)
4. In n8n, create Header Auth credential:
   - Name: `OpenRouter API`
   - Header Name: `Authorization`
   - Header Value: `Bearer sk-or-v1-xxxxx` (MUST include "Bearer " prefix with space!)

**Models Used:**
- `openai/gpt-4o-mini` - Default for intent classification, sentiment analysis (~$0.15/1M tokens)
- `openai/gpt-4o` - Complex analysis like daily summaries (~$2.50/1M tokens)
- `meta-llama/llama-3.2-3b-instruct:free` - Free fallback model

---

## n8n Credential Setup

### 1. Backend API Key (Header Auth)

In n8n UI:
1. Go to **Credentials** > **New**
2. Select **Header Auth**
3. Fill in:
   - **Name:** `Backend API Key`
   - **Header Name:** `Authorization`
   - **Header Value:** `Bearer <your-api-key-from-backend-env>`
4. Click **Save**

### 2. WhatsApp Business API (Header Auth)

In n8n UI:
1. Go to **Credentials** > **New**
2. Select **Header Auth**
3. Fill in:
   - **Name:** `WhatsApp Business API`
   - **Header Name:** `Authorization`
   - **Header Value:** `Bearer <your-whatsapp-token>`
4. Click **Save**

### 3. Instagram Business API (Header Auth)

In n8n UI:
1. Go to **Credentials** > **New**
2. Select **Header Auth**
3. Fill in:
   - **Name:** `Instagram Business API`
   - **Header Name:** `Authorization`
   - **Header Value:** `Bearer <your-instagram-token>`
4. Click **Save**

### 4. Google Gemini API

In n8n UI:
1. Go to **Credentials** > **New**
2. Select **Google Gemini API**
3. Fill in:
   - **Name:** `Google Gemini API`
   - **API Key:** `<your-gemini-api-key>`
4. Click **Save**

---

## Testing Credentials

### Test Backend API

```bash
curl -H "Authorization: Bearer <your-api-key>" \
  http://localhost:3001/api/integrations/knowledge/context
```

Expected: JSON response with knowledge base data

### Test WhatsApp API

```bash
curl -H "Authorization: Bearer <your-whatsapp-token>" \
  https://graph.facebook.com/v18.0/me
```

Expected: JSON response with account info

### Test Instagram API

```bash
curl -H "Authorization: Bearer <your-instagram-token>" \
  https://graph.facebook.com/v18.0/me
```

Expected: JSON response with account info

### Test Gemini API

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Say OK"}]}]}' \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=<your-key>"
```

Expected: JSON response with "OK"

---

## Security Best Practices

1. ✅ Never commit `CREDENTIALS.md` to git (it's in `.gitignore`)
2. ✅ Use environment variables for backend credentials
3. ✅ Store n8n credentials in n8n's encrypted credential system
4. ✅ Use SSH key authentication for Pi access
5. ✅ Rotate tokens regularly (every 60-90 days)
6. ✅ Use permanent tokens (not temporary) for production
7. ✅ Limit token permissions to minimum required

---

**Last Updated:** 2025-12-07  
**Status:** ✅ Template ready for use
