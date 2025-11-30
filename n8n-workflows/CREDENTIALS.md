# n8n Credentials

## n8n Admin Access

| Field | Value |
|-------|-------|
| URL | http://192.168.1.5:5678 |
| Email | admin@spa-kiosk.local |
| Password | Admin123! |

## Pi SSH Access

| Field | Value |
|-------|-------|
| Host | 192.168.1.5 |
| User | eform-kio |

## Backend API Key

```
dwsQf8q0BpFWXPqMhwy2SGLG/wHIw1hKyjW8eI4Cgd8=
```

## WhatsApp Business API Token

```
EAA9xzHZBdKVUBQHDw2PZBHTV9pD6cZAZAYCiWnQXWvazBxxUdUBgi8Tqq5RZBduzKYhF9BZBixZAj5eATHrAoEZClh5jhgmYtwBQRCJUC1ayFku4Etvp9zZBiR3UtF2tToRcPYhziaoZAa7ySrDffCDskivZAkMXq3S6aAQYtMx9mDTvuuX6KvrgYg7T8aDF7XMninQKAZDZD
```

## OpenRouter API Key

```
YOUR_OPENROUTER_API_KEY_HERE
```

**Setup Instructions:**
1. Go to https://openrouter.ai/keys
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

## Imported Workflows

| Workflow | ID | Status |
|----------|-----|--------|
| WhatsApp Balance Check | Z7hznAe9tf5TzyGC | inactive |
| WhatsApp Claim Redemption | Ncgg7lbKWFUd00GT | inactive |
| WhatsApp Coupon Capture | MM0rlnDn2xOZQSbA | inactive |
| WhatsApp Opt-Out | qiCdgSvgQVnz5C3Z | inactive |
| OpenRouter API Test | - | new |

## Next Steps

1. Login to n8n at http://192.168.1.5:5678
2. Create credentials:
   - **Backend API Key** (Header Auth): `Authorization: Bearer dwsQf8q0BpFWXPqMhwy2SGLG/wHIw1hKyjW8eI4Cgd8=`
   - **WhatsApp Business API** (Header Auth): `Authorization: Bearer <token>`
   - **OpenRouter API** (Header Auth): `Authorization: Bearer sk-or-v1-xxxxx`
3. Link credentials to workflows
4. Activate workflows

## Testing OpenRouter API

Before deploying AI workflows, test the API connection:

```bash
# From local machine
./n8n-workflows/deployment/test-openrouter.sh sk-or-v1-your-key-here

# Or via SSH on Pi
ssh eform-kio@192.168.1.5 "curl -s --max-time 3 \
  -X POST 'https://openrouter.ai/api/v1/chat/completions' \
  -H 'Authorization: Bearer sk-or-v1-your-key-here' \
  -H 'HTTP-Referer: https://spa-kiosk.local' \
  -H 'X-Title: SPA Digital Kiosk' \
  -H 'Content-Type: application/json' \
  -d '{\"model\":\"openai/gpt-4o-mini\",\"messages\":[{\"role\":\"user\",\"content\":\"Say OK\"}],\"max_tokens\":10}'"
```

Expected response: `{"choices":[{"message":{"content":"OK"}}],...}`

---

**Last Updated:** 2025-11-30
**Status:** ✅ Workflows Imported + OpenRouter Template Added
