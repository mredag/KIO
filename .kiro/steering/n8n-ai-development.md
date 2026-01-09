# n8n AI Development Guide

**Purpose:** Reference guide for implementing AI-powered workflows in n8n using OpenRouter with OpenAI models.

---

## 🎯 Core Principles

1. **OpenAI via OpenRouter** - Use gpt-4o-mini for routine tasks, gpt-4o for complex analysis
2. **Graceful Degradation** - Always have keyword-based fallback when AI unavailable
3. **3-Second Timeout** - Don't block operations waiting for AI
4. **Turkish Language** - All prompts and responses in Turkish
5. **Privacy First** - Never send full phone numbers to AI

---

## 🔧 OpenRouter Configuration

### API Endpoint
```
URL: https://openrouter.ai/api/v1/chat/completions
Method: POST
```

### Required Headers
```json
{
  "Authorization": "Bearer <OPENROUTER_API_KEY>",
  "Content-Type": "application/json",
  "HTTP-Referer": "https://spa-kiosk.local",
  "X-Title": "SPA Digital Kiosk"
}
```

### Model Selection
| Use Case | Model | Cost |
|----------|-------|------|
| Intent Classification | `openai/gpt-4o-mini` | ~$0.15/1M tokens |
| Sentiment Analysis | `openai/gpt-4o-mini` | ~$0.15/1M tokens |
| Complex Summarization | `openai/gpt-4o` | ~$2.50/1M tokens |
| Fallback (Free) | `meta-llama/llama-3.2-3b-instruct:free` | Free |

---

## 📋 n8n HTTP Request Node for OpenRouter

### Basic Configuration
```json
{
  "parameters": {
    "method": "POST",
    "url": "https://openrouter.ai/api/v1/chat/completions",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        { "name": "HTTP-Referer", "value": "https://spa-kiosk.local" },
        { "name": "X-Title", "value": "SPA Digital Kiosk" }
      ]
    },
    "sendBody": true,
    "bodyParameters": {
      "parameters": [
        {
          "name": "model",
          "value": "openai/gpt-4o-mini"
        },
        {
          "name": "messages",
          "value": "={{ JSON.stringify($json.messages) }}"
        },
        {
          "name": "temperature",
          "value": "0.3"
        },
        {
          "name": "max_tokens",
          "value": "150"
        }
      ]
    },
    "options": {
      "timeout": 3000
    }
  },
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2
}
```

### Credential Setup (Header Auth)
```
Name: OpenRouter API
Header Name: Authorization
Header Value: Bearer sk-or-v1-xxxxxxxxxxxxx
```

⚠️ **MUST include "Bearer " prefix with space!**

---

## 🤖 Intent Classification Pattern

### System Prompt (Turkish)
```
Sen bir spa resepsiyon asistanısın. Müşteri mesajlarını aşağıdaki kategorilere ayır:

- balance_check: Kupon bakiyesi sorgusu (örn: "kaç kuponum var", "bakiyem", "durum")
- coupon_submit: Kupon kodu gönderimi (örn: "KUPON ABC123", 8+ karakter kod içeren)
- redemption: Kupon kullanma isteği (örn: "kupon kullan", "hediye masaj", "kullanmak istiyorum")
- help: Yardım talebi (örn: "nasıl çalışıyor", "yardım", "bilgi")
- complaint: Şikayet (örn: "memnun değilim", "kötü", "şikayet")
- other: Diğer mesajlar

Sadece kategori adını döndür, başka bir şey yazma.
```

### Request Body
```json
{
  "model": "openai/gpt-4o-mini",
  "messages": [
    {
      "role": "system",
      "content": "Sen bir spa resepsiyon asistanısın..."
    },
    {
      "role": "user",
      "content": "{{ $json.message }}"
    }
  ],
  "temperature": 0.1,
  "max_tokens": 20
}
```

### Response Parsing
```javascript
// Code node to parse intent
const response = $json.choices?.[0]?.message?.content?.trim().toLowerCase();
const validIntents = ['balance_check', 'coupon_submit', 'redemption', 'help', 'complaint', 'other'];

return {
  intent: validIntents.includes(response) ? response : 'other',
  confidence: response ? 'high' : 'low',
  raw: response
};
```

---

## 😊 Sentiment Analysis Pattern

### System Prompt (Turkish)
```
Müşteri geri bildirimini analiz et ve duygu durumunu belirle.

Kategoriler:
- positive: Memnun, mutlu, teşekkür eden
- neutral: Nötr, bilgi veren, soru soran
- negative: Memnun olmayan, şikayet eden, kızgın

Sadece kategori adını döndür.
```

### Request Body
```json
{
  "model": "openai/gpt-4o-mini",
  "messages": [
    {
      "role": "system",
      "content": "Müşteri geri bildirimini analiz et..."
    },
    {
      "role": "user",
      "content": "{{ $json.surveyResponse }}"
    }
  ],
  "temperature": 0.1,
  "max_tokens": 10
}
```

---

## 📝 Daily Summary Pattern

### System Prompt (Turkish)
```
Aşağıdaki müşteri geri bildirimlerini özetle. Türkçe yaz.

Özet şunları içermeli:
- Toplam yanıt sayısı
- Genel memnuniyet oranı (pozitif/nötr/negatif yüzdeleri)
- En çok bahsedilen konular (3-5 madde)
- Dikkat edilmesi gereken noktalar

Kısa ve öz yaz, maksimum 200 kelime.
```

### Request Body
```json
{
  "model": "openai/gpt-4o",
  "messages": [
    {
      "role": "system",
      "content": "Aşağıdaki müşteri geri bildirimlerini özetle..."
    },
    {
      "role": "user",
      "content": "{{ $json.responses }}"
    }
  ],
  "temperature": 0.5,
  "max_tokens": 500
}
```

---

## 🆘 Help Response Pattern

### System Prompt (Turkish)
```
Sen bir spa kupon sistemi asistanısın. Müşterilere Türkçe yardım et.

Kupon Sistemi Bilgileri:
- Her masaj sonrası 1 kupon kazanılır
- 4 kupon = 1 ücretsiz masaj
- Kuponlar 24 saat içinde kullanılmalı
- "DURUM" yazarak bakiye öğrenilebilir
- "KUPON KULLAN" yazarak kullanılabilir
- "KUPON <KOD>" yazarak kupon eklenebilir

Kısa ve net cevaplar ver. Emoji kullan.
```

---

## ⚡ Graceful Degradation Pattern

### Timeout Handling (Code Node)
```javascript
// Before AI call - set timeout flag
const startTime = Date.now();
const TIMEOUT_MS = 3000;

// After AI call - check if timed out
const elapsed = Date.now() - startTime;
if (elapsed > TIMEOUT_MS || !$json.choices) {
  // Fallback to keyword matching
  return { useFallback: true, reason: 'timeout' };
}

return { useFallback: false, aiResponse: $json.choices[0].message.content };
```

### Keyword Fallback (Code Node)
```javascript
const message = $json.message.toLowerCase();

// Turkish keyword patterns
const patterns = {
  balance_check: /durum|bakiye|kaç kupon|kuponum/i,
  coupon_submit: /kupon\s+[a-z0-9]{8,}/i,
  redemption: /kupon kullan|kullanmak|hediye masaj/i,
  help: /yardım|nasıl|bilgi|help|\?/i,
  complaint: /şikayet|memnun değil|kötü|berbat|rezalet/i
};

for (const [intent, pattern] of Object.entries(patterns)) {
  if (pattern.test(message)) {
    return { intent, method: 'keyword' };
  }
}

return { intent: 'other', method: 'keyword' };
```

---

## 🔄 Caching Pattern

### Cache Check (Code Node)
```javascript
// Use workflow static data for caching
const cache = $workflow.staticData.aiCache || {};
const cacheKey = $json.message.toLowerCase().trim();
const now = Date.now();
const TTL = 5 * 60 * 1000; // 5 minutes

// Clean expired entries
Object.keys(cache).forEach(key => {
  if (cache[key].expires < now) delete cache[key];
});

// Check cache
if (cache[cacheKey] && cache[cacheKey].expires > now) {
  return { 
    cached: true, 
    response: cache[cacheKey].response 
  };
}

return { cached: false, cacheKey };
```

### Cache Store (Code Node)
```javascript
// After AI response
const cache = $workflow.staticData.aiCache || {};
cache[$json.cacheKey] = {
  response: $json.aiResponse,
  expires: Date.now() + (5 * 60 * 1000)
};
$workflow.staticData.aiCache = cache;

return $json;
```

---

## 📊 Error Handling

### Rate Limit Detection
```javascript
const statusCode = $json.statusCode || $response?.statusCode;
const error = $json.error?.message || '';

if (statusCode === 429 || error.includes('rate limit')) {
  // Set cooldown flag
  $workflow.staticData.aiCooldown = Date.now() + 60000; // 60 seconds
  return { error: 'rate_limit', useFallback: true };
}

if (statusCode === 401) {
  return { error: 'auth_failed', useFallback: true };
}

return { error: null };
```

### Cooldown Check
```javascript
const cooldownUntil = $workflow.staticData.aiCooldown || 0;
if (Date.now() < cooldownUntil) {
  return { 
    skipAI: true, 
    reason: 'cooldown',
    remainingSeconds: Math.ceil((cooldownUntil - Date.now()) / 1000)
  };
}
return { skipAI: false };
```

---

## 🔐 Privacy & Logging

### PII Masking (Code Node)
```javascript
// Mask phone numbers before logging
const phone = $json.phone || '';
const masked = phone.replace(/(\d{2})\d{6}(\d{2})/, '$1******$2');

// Log without full text
console.log({
  event: 'ai_request',
  intent: $json.intent,
  phone: masked,
  timestamp: new Date().toISOString()
});

return $json;
```

### Audit Logging
```javascript
// Log AI interactions for audit
return {
  ...$json,
  audit: {
    requestType: $json.requestType,
    responseTime: $json.responseTime,
    success: $json.success,
    fallbackUsed: $json.useFallback,
    timestamp: new Date().toISOString()
  }
};
```

---

## 🇹🇷 Turkish Message Templates

### Help Response
```
🎫 Kupon Sistemi Yardım

📌 Nasıl Çalışır:
• Her masaj = 1 kupon
• 4 kupon = 1 ücretsiz masaj

📱 Komutlar:
• DURUM - Bakiye sorgula
• KUPON <KOD> - Kupon ekle
• KUPON KULLAN - Hediye al

❓ Sorularınız için: YARDIM
```

### Balance Response
```
📊 Kupon Bakiyeniz

🎫 Mevcut: {{ balance }}/4 kupon
{{ remaining > 0 ? `📍 ${remaining} kupon daha = ücretsiz masaj!` : '🎉 Ücretsiz masaj hakkınız var!' }}

💡 Kullanmak için: KUPON KULLAN
```

### Complaint Acknowledgment
```
🙏 Geri bildiriminiz için teşekkürler.

Şikayetiniz ekibimize iletildi. En kısa sürede sizinle iletişime geçeceğiz.

📞 Acil durumlar için: Resepsiyona başvurun
```

---

## 🚀 Workflow Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Webhook   │────▶│ Cache Check  │────▶│  Cooldown   │
│  (Trigger)  │     │  (Code)      │     │   Check     │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                │
                    ┌───────────────────────────┼───────────────────────────┐
                    │ (cached)                  │ (not cached)              │ (cooldown)
                    ▼                           ▼                           ▼
              ┌───────────┐              ┌─────────────┐              ┌───────────┐
              │  Return   │              │  OpenRouter │              │  Keyword  │
              │  Cached   │              │  HTTP Req   │              │  Fallback │
              └───────────┘              └──────┬──────┘              └───────────┘
                                                │
                                    ┌───────────┼───────────┐
                                    │ (success) │ (timeout) │ (error)
                                    ▼           ▼           ▼
                              ┌───────────┐ ┌───────────┐ ┌───────────┐
                              │  Parse &  │ │  Keyword  │ │  Keyword  │
                              │  Cache    │ │  Fallback │ │  Fallback │
                              └───────────┘ └───────────┘ └───────────┘
```

---

## ✅ Implementation Checklist

### Before Starting
- [ ] OpenRouter API key obtained
- [ ] Credential created in n8n (Header Auth with "Bearer " prefix)
- [ ] Test API connectivity with simple request

### For Each AI Feature
- [ ] System prompt written in Turkish
- [ ] Keyword fallback implemented
- [ ] 3-second timeout configured
- [ ] Cache mechanism added
- [ ] Error handling for rate limits
- [ ] PII masking in logs
- [ ] Test with various inputs

### Testing
- [ ] Test AI response quality
- [ ] Test timeout fallback
- [ ] Test rate limit handling
- [ ] Test cache hit/miss
- [ ] Test Turkish language accuracy
- [ ] Verify no PII in logs

---

## 🔗 Related Documentation

- [OpenRouter API Docs](https://openrouter.ai/docs)
- [n8n HTTP Request Node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/)
- [n8n Code Node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.code/)
- [Existing n8n Steering](.kiro/steering/n8n-development.md)

---

**Last Updated:** 2025-11-30  
**Status:** ✅ Ready for implementation  
**Applies to:** n8n AI Automation feature
