# OpenRouter Integration Guide

## Overview

This guide explains how to integrate OpenRouter AI into n8n workflows for the SPA Digital Kiosk system. OpenRouter provides access to OpenAI models (gpt-4o-mini, gpt-4o) with graceful degradation to free models.

**Requirements Covered:** 6.1, 6.2

## Setup

### 1. Get OpenRouter API Key

1. Go to https://openrouter.ai/keys
2. Create a new API key
3. Copy the key (starts with `sk-or-v1-`)

### 2. Create n8n Credential

In n8n UI (http://192.168.1.5:5678):

1. Go to **Credentials** → **Add Credential**
2. Select **Header Auth**
3. Configure:
   - **Name:** `OpenRouter API`
   - **Header Name:** `Authorization`
   - **Header Value:** `Bearer sk-or-v1-xxxxx` (MUST include "Bearer " with space!)
4. Save

### 3. Test API Connectivity

```bash
# From command line
./n8n-workflows/deployment/test-openrouter.sh sk-or-v1-your-key

# Or import and run the test workflow
# n8n-workflows/workflows-v2/openrouter-test.json
```

## HTTP Request Node Configuration

### Required Headers

| Header | Value | Purpose |
|--------|-------|---------|
| Authorization | `Bearer sk-or-v1-xxx` | API authentication |
| HTTP-Referer | `https://spa-kiosk.local` | Required by OpenRouter |
| X-Title | `SPA Digital Kiosk` | App identification |

### Timeout Configuration

**Critical:** Set 3-second timeout for real-time requests to ensure graceful degradation.

```json
{
  "options": {
    "timeout": 3000,
    "response": {
      "response": {
        "neverError": true
      }
    }
  }
}
```

- `timeout: 3000` - 3 seconds max wait time
- `neverError: true` - Don't throw on HTTP errors, handle in Code node

### Model Selection

| Use Case | Model | Temperature | Max Tokens |
|----------|-------|-------------|------------|
| Intent Classification | `openai/gpt-4o-mini` | 0.1 | 20 |
| Sentiment Analysis | `openai/gpt-4o-mini` | 0.1 | 10 |
| Help Response | `openai/gpt-4o-mini` | 0.3 | 200 |
| Daily Summary | `openai/gpt-4o` | 0.5 | 500 |
| Fallback (Free) | `meta-llama/llama-3.2-3b-instruct:free` | 0.3 | 100 |

## Example: Intent Classification Node

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://openrouter.ai/api/v1/chat/completions",
    "authentication": "none",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        { "name": "Authorization", "value": "Bearer sk-or-v1-xxx" },
        { "name": "HTTP-Referer", "value": "https://spa-kiosk.local" },
        { "name": "X-Title", "value": "SPA Digital Kiosk" }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={\"model\":\"openai/gpt-4o-mini\",\"messages\":[{\"role\":\"system\",\"content\":\"Classify intent: balance_check, coupon_submit, redemption, help, complaint, other\"},{\"role\":\"user\",\"content\":\"{{ $json.message }}\"}],\"temperature\":0.1,\"max_tokens\":20}",
    "options": {
      "timeout": 3000,
      "response": { "response": { "neverError": true } }
    }
  },
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4
}
```

## Response Parsing

After the HTTP Request node, add a Code node to parse the response:

```javascript
const response = $input.first().json;

// Check for timeout or error
if (!response.choices || response.error) {
  return [{
    json: {
      useFallback: true,
      reason: response.error?.message || 'timeout',
      result: null
    }
  }];
}

// Extract AI response
const content = response.choices[0]?.message?.content?.trim().toLowerCase();

return [{
  json: {
    useFallback: false,
    result: content,
    model: response.model,
    tokens: response.usage?.total_tokens
  }
}];
```

## Error Handling

### Timeout (>3 seconds)
- Automatically handled by `timeout: 3000`
- Response will be empty or error
- Fall back to keyword matching

### Rate Limit (429)
- Check `response.error.code === 'rate_limit_exceeded'`
- Set cooldown flag in workflow static data
- Use fallback for 60 seconds

### Auth Error (401)
- Check `response.error.code === 'invalid_api_key'`
- Log critical error
- Use fallback

## Cost Monitoring

OpenRouter provides usage data in responses:

```javascript
const usage = response.usage;
console.log({
  promptTokens: usage.prompt_tokens,
  completionTokens: usage.completion_tokens,
  totalTokens: usage.total_tokens,
  estimatedCost: usage.total_tokens * 0.00000015 // gpt-4o-mini rate
});
```

## Templates

Pre-built node templates are available in:
- `n8n-workflows/templates/openrouter-base.json`

## Testing

1. **API Test Workflow:** `n8n-workflows/workflows-v2/openrouter-test.json`
2. **Shell Script:** `n8n-workflows/deployment/test-openrouter.sh`

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Missing "Bearer " prefix | Add "Bearer " with space before key |
| Timeout | Slow response | Fallback to keywords automatically |
| Empty response | Invalid JSON body | Use template syntax correctly |
| Rate limit | Too many requests | Implement cooldown mechanism |

---

**Last Updated:** 2025-11-30
**Status:** ✅ Ready for implementation
