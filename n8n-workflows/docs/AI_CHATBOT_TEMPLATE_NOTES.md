# AI Chatbot Template Analysis

**Source:** ElevenLabs + InfraNodus Voice AI Chatbot Template (n8n template #4484)

## 🎯 Key Architecture Insights

### 1. Core Flow
```
Webhook (trigger) → AI Agent → Respond to Webhook
                      ↓
              [Multiple Expert Tools]
                      ↓
              [Chat Memory]
                      ↓
              [LLM Model]
```

### 2. Important Components

#### AI Agent Node (`@n8n/n8n-nodes-langchain.agent`)
- **Version:** 1.9
- **Input:** `{{ $json.body.prompt }}` - user's message from webhook
- **System Prompt:** Describes available tools and how to use them
- **Key Pattern:** Agent decides which tool(s) to call based on user query

#### Memory Node (`@n8n/n8n-nodes-langchain.memoryBufferWindow`)
- **Session Key:** `{{ $json.body.sessionId }}` - tracks conversation per user
- **Purpose:** Maintains context across messages
- **Version:** 1.3

#### LLM Model Options
- **Google Gemini Flash:** Faster response times
- **OpenAI GPT-4o:** More precise tool calling
- **Recommendation:** Gemini for speed, OpenAI for accuracy

#### HTTP Request Tools (`n8n-nodes-base.httpRequestTool`)
- **Version:** 4.2
- **Pattern:** Each "expert" is an HTTP tool that queries a knowledge base
- **Key Feature:** `$fromAI()` function for dynamic parameter injection

---

## 🔧 Patterns to Apply for SPA Chatbot

### 1. Multi-Expert Architecture
Instead of one monolithic bot, create specialized "experts":

| Expert | Purpose | Backend Endpoint |
|--------|---------|------------------|
| Kupon Uzmanı | Coupon operations | `/api/integrations/coupons/*` |
| Masaj Uzmanı | Massage info, pricing | `/api/kiosk/menu` |
| Randevu Uzmanı | Appointment booking | Future: `/api/appointments/*` |
| Genel Bilgi | SPA info, hours, location | Static knowledge |

### 2. Tool Description Pattern
```
toolDescription: "Kupon sistemi uzmanı. Kupon ekleme, bakiye sorgulama, 
ve ücretsiz masaj hakkı kullanma işlemlerini yapar. Şu konularda yardımcı olur:
- Kupon kodu ekleme (KUPON <KOD>)
- Bakiye sorgulama (DURUM, BAKIYE)
- Ücretsiz masaj kullanma (KUPON KULLAN)
- Kupon sistemi hakkında bilgi"
```

### 3. Session Memory for WhatsApp
```javascript
// Use phone number as session ID
sessionKey: "={{ $json.phone }}"
sessionIdType: "customKey"
```

### 4. System Prompt Template (Turkish)
```
Sen bir SPA merkezi asistanısın. Müşterilere Türkçe yardım ediyorsun.

Erişebildiğin uzmanlar:
1. kupon_expert - Kupon işlemleri (ekleme, bakiye, kullanma)
2. massage_expert - Masaj bilgileri ve fiyatlar
3. general_info - SPA hakkında genel bilgiler

Kullanıcının sorusuna göre uygun uzmanı seç ve sorgula.
Yanıtları kısa ve öz tut. Emoji kullan.
```

---

## 📋 Implementation Plan for SPA Chatbot

### Phase 1: Basic Multi-Tool Agent
```json
{
  "nodes": [
    "Webhook (WhatsApp)",
    "Parse Message",
    "AI Agent",
    "Coupon Tool",
    "Massage Info Tool", 
    "Simple Memory",
    "LLM (Gemini/OpenAI)",
    "Format Response",
    "Send WhatsApp"
  ]
}
```

### Phase 2: Add Knowledge Base
- Import massage descriptions to vector store
- Add FAQ knowledge base
- Enable semantic search for questions

### Phase 3: Voice Integration (Optional)
- ElevenLabs for voice responses
- Voice-to-text for audio messages

---

## 🔑 Key Takeaways

### 1. Use `$fromAI()` for Dynamic Tool Parameters
```javascript
// Let AI decide what to send to the tool
"prompt": "={{ $fromAI('query', 'User request adjusted for this context', 'string') }}"
```

### 2. Descriptive Tool Names Matter
- AI uses tool names and descriptions to decide which to call
- Be specific: "Kupon Bakiye Sorgulama" not just "API Call"

### 3. Memory is Essential for Conversations
- Without memory, each message is isolated
- Use phone number as session key for WhatsApp

### 4. System Prompt Guides Tool Selection
- List available tools explicitly
- Describe when to use each tool
- Set language and tone expectations

### 5. Response Format for Voice/Chat
- Keep responses concise for voice
- Use natural conversational language
- Avoid long lists or technical details

---

## 🚀 Next Steps

1. **Create SPA-specific tools:**
   - Coupon operations (existing API)
   - Massage menu query
   - Business hours/location info

2. **Build knowledge base:**
   - Import massage descriptions
   - Add FAQ content
   - SPA policies and info

3. **Test with WhatsApp:**
   - Use existing webhook
   - Add memory node
   - Test multi-turn conversations

4. **Optimize:**
   - Choose LLM (Gemini for speed)
   - Fine-tune system prompt
   - Add error handling

---

## 📝 Sample Workflow Structure

```
┌─────────────┐
│  Webhook    │ (WhatsApp POST)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Parse     │ (Extract phone, text, sessionId)
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────┐
│              AI Agent                    │
│  ┌─────────────────────────────────┐    │
│  │         System Prompt           │    │
│  │  "Sen SPA asistanısın..."       │    │
│  └─────────────────────────────────┘    │
│                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ Coupon   │ │ Massage  │ │ General  │ │
│  │  Tool    │ │  Tool    │ │  Tool    │ │
│  └──────────┘ └──────────┘ └──────────┘ │
│                                          │
│  ┌─────────────────────────────────┐    │
│  │         Memory Buffer           │    │
│  │    (sessionKey: phone)          │    │
│  └─────────────────────────────────┘    │
│                                          │
│  ┌─────────────────────────────────┐    │
│  │         LLM (Gemini)            │    │
│  └─────────────────────────────────┘    │
└──────────────────┬──────────────────────┘
                   │
                   ▼
            ┌─────────────┐
            │   Format    │
            └──────┬──────┘
                   │
                   ▼
            ┌─────────────┐
            │  Send WA    │
            └──────┬──────┘
                   │
                   ▼
            ┌─────────────┐
            │  Respond OK │
            └─────────────┘
```

---

**Date:** 2025-11-30
**Status:** Analysis Complete
**Next:** Implement SPA-specific AI chatbot workflow
