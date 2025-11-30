# n8n AI Automation Plan for SPA Digital Kiosk

## Executive Summary

This plan outlines how to leverage n8n's AI nodes to enhance the SPA Digital Kiosk project automation. The focus is on improving customer experience, automating administrative tasks, and providing intelligent insights from collected data.

---

## 🎯 Project Context

### Current System Components
1. **Kiosk Application** - Digital menu, surveys, QR codes, coupon display
2. **WhatsApp Coupon System** - Token issuance, collection, redemption via n8n
3. **Admin Panel** - Content management, analytics, customer support
4. **Survey System** - Customer feedback collection with rating/choice questions

### Existing n8n Workflows
- Coupon Capture (KUPON <TOKEN>)
- Balance Check (DURUM)
- Claim Redemption (KUPON KULLAN)
- Opt-Out (IPTAL)

---

## 🤖 AI Enhancement Opportunities

### Phase 1: Survey Intelligence (High Impact)

#### 1.1 Survey Response Sentiment Analysis
**Use Case:** Automatically analyze customer survey responses to detect satisfaction levels.

**n8n AI Nodes:**
- `Sentiment Analysis Node` - Categorize responses as Positive/Neutral/Negative
- `Text Classifier Node` - Categorize feedback into topics (service, cleanliness, staff, price)

**Workflow:**
```
Survey Response Webhook → Sentiment Analysis → Text Classifier → 
  ├─ Positive → Log + Optional Thank You Message
  ├─ Neutral → Log for Review
  └─ Negative → Alert Staff + Priority Flag
```

**Implementation:**
```json
{
  "nodes": [
    {
      "type": "n8n-nodes-langchain.sentimentAnalysis",
      "parameters": {
        "text": "={{ $json.answers }}",
        "options": {
          "sentimentCategories": "Çok Memnun, Memnun, Nötr, Memnun Değil, Çok Memnun Değil"
        }
      }
    }
  ]
}
```

**Benefits:**
- Real-time customer satisfaction monitoring
- Immediate alerts for negative feedback
- Trend analysis over time

---

#### 1.2 Survey Response Summarization
**Use Case:** Generate daily/weekly summaries of survey responses for management.

**n8n AI Nodes:**
- `Basic LLM Chain` - Summarize multiple responses
- `Summarization Chain` - Create executive summaries

**Workflow:**
```
Scheduled Trigger (Daily 9 AM) → Fetch Survey Responses → 
Summarization Chain → Format Turkish Message → Send to Admin WhatsApp
```

**Turkish Prompt Template:**
```
Aşağıdaki müşteri geri bildirimlerini özetle:
- Toplam yanıt sayısı
- Genel memnuniyet oranı
- En çok bahsedilen konular
- Dikkat edilmesi gereken noktalar

Geri bildirimler:
{{ $json.responses }}
```

---

### Phase 2: WhatsApp AI Assistant (Medium Impact)

#### 2.1 Intelligent Message Routing
**Use Case:** Use AI to understand customer intent beyond exact keyword matching.

**Current Problem:** Only exact matches work (KUPON, DURUM, KULLAN, IPTAL)

**AI Solution:**
- `Text Classifier Node` - Classify intent from natural language
- Handle variations: "kuponum var mı?", "bakiyem ne kadar?", "hediye masaj istiyorum"

**Categories:**
```javascript
const categories = [
  { name: "balance_check", description: "Müşteri kupon bakiyesini öğrenmek istiyor" },
  { name: "coupon_submit", description: "Müşteri kupon kodu gönderiyor" },
  { name: "redemption", description: "Müşteri kuponlarını kullanmak istiyor" },
  { name: "help", description: "Müşteri yardım istiyor veya soru soruyor" },
  { name: "complaint", description: "Müşteri şikayet ediyor" },
  { name: "other", description: "Diğer mesajlar" }
];
```

**Workflow:**
```
WhatsApp Webhook → Text Classifier → Switch Node →
  ├─ balance_check → Balance API
  ├─ coupon_submit → Extract Token → Consume API
  ├─ redemption → Claim API
  ├─ help → AI Help Response
  ├─ complaint → Alert Staff + AI Empathy Response
  └─ other → Ignore or Generic Response
```

---

#### 2.2 AI-Powered Help Responses
**Use Case:** Answer common customer questions automatically.

**n8n AI Nodes:**
- `AI Agent` with custom tools
- `Basic LLM Chain` for simple Q&A

**Knowledge Base (Turkish):**
```
- Kupon sistemi nasıl çalışır?
- Kaç kupon lazım ücretsiz masaj için?
- Kuponlarım ne zaman sona erer?
- Nasıl kupon kazanırım?
- Masaj fiyatları nedir?
```

**System Prompt:**
```
Sen bir spa resepsiyon asistanısın. Müşterilere kupon sistemi hakkında 
Türkçe olarak yardımcı ol. Kısa ve net cevaplar ver.

Kupon Sistemi:
- Her masaj sonrası 1 kupon kazanılır
- 4 kupon = 1 ücretsiz masaj
- Kuponlar 24 saat içinde kullanılmalı
- "DURUM" yazarak bakiye öğrenilebilir
- "KUPON KULLAN" yazarak kullanılabilir
```

---

### Phase 3: Admin Intelligence (Medium Impact)

#### 3.1 Daily Operations Summary
**Use Case:** AI-generated daily summary for spa management.

**Data Sources:**
- Survey responses (sentiment + topics)
- Coupon statistics (issued, used, redeemed)
- System health metrics

**Workflow:**
```
Scheduled Trigger (8 PM Daily) → 
  Parallel:
    ├─ Fetch Survey Stats
    ├─ Fetch Coupon Stats
    └─ Fetch System Logs
  → Merge → Summarization Chain → Format Report → Send WhatsApp
```

**Output Format (Turkish):**
```
📊 Günlük Özet - {{ $now.format('DD.MM.YYYY') }}

👥 Müşteri Memnuniyeti:
- Toplam anket: X
- Memnuniyet: %Y
- Öne çıkan: [AI özet]

🎫 Kupon Aktivitesi:
- Verilen: X kupon
- Kullanılan: Y kupon
- Bekleyen kullanım: Z

⚠️ Dikkat Edilecekler:
[AI tarafından belirlenen önemli noktalar]
```

---

#### 3.2 Anomaly Detection
**Use Case:** Detect unusual patterns that might indicate issues or fraud.

**Patterns to Detect:**
- Sudden drop in survey satisfaction
- Unusual coupon redemption patterns
- High rate limit hits from same phone
- System errors spike

**Workflow:**
```
Scheduled Trigger (Hourly) → Fetch Metrics → 
AI Analysis (Compare to baseline) → 
  ├─ Normal → Log
  └─ Anomaly → Alert Staff with AI Explanation
```

---

### Phase 4: Content Enhancement (Lower Priority)

#### 4.1 Massage Description Enhancement
**Use Case:** AI-assisted content creation for massage descriptions.

**Workflow:**
```
Admin Input (basic info) → AI Enhancement → 
Preview → Admin Approval → Save to Database
```

**Prompt:**
```
Aşağıdaki masaj bilgilerini kullanarak çekici bir Türkçe açıklama yaz:
- İsim: {{ $json.name }}
- Süre: {{ $json.duration }}
- Temel bilgi: {{ $json.basicInfo }}

Açıklama şunları içermeli:
- Faydaları
- Kime uygun
- Beklentiler
```

---

#### 4.2 Survey Question Optimization
**Use Case:** AI suggestions for better survey questions based on response patterns.

**Analysis:**
- Questions with low response rates
- Questions with uniform answers (not discriminating)
- Suggested improvements

---

## 📋 Implementation Priority

| Phase | Feature | Impact | Effort | Priority |
|-------|---------|--------|--------|----------|
| 1.1 | Survey Sentiment Analysis | High | Low | ⭐⭐⭐⭐⭐ |
| 1.2 | Survey Summarization | High | Medium | ⭐⭐⭐⭐ |
| 2.1 | Intelligent Message Routing | High | Medium | ⭐⭐⭐⭐ |
| 2.2 | AI Help Responses | Medium | Medium | ⭐⭐⭐ |
| 3.1 | Daily Operations Summary | Medium | Low | ⭐⭐⭐⭐ |
| 3.2 | Anomaly Detection | Medium | High | ⭐⭐ |
| 4.1 | Content Enhancement | Low | Low | ⭐⭐ |
| 4.2 | Survey Optimization | Low | High | ⭐ |

---

## 🔧 Technical Requirements

### n8n AI Node Dependencies
```
Required Nodes:
- n8n-nodes-langchain.sentimentAnalysis
- n8n-nodes-langchain.textClassifier
- n8n-nodes-langchain.basicLlmChain
- n8n-nodes-langchain.summarizationChain
- n8n-nodes-langchain.agent (optional for advanced)
```

### LLM Provider Options
1. **OpenAI** (Recommended)
   - GPT-4o-mini for cost-effective operations
   - GPT-4o for complex analysis
   
2. **Ollama** (Self-hosted, Free)
   - Llama 3.1 for local processing
   - No API costs, but requires more resources

3. **Anthropic Claude** (Alternative)
   - Good for Turkish language support

### Credential Setup
```json
{
  "openAiApi": {
    "apiKey": "${OPENAI_API_KEY}"
  }
}
```

---

## 🚀 Implementation Roadmap

### Week 1-2: Foundation
- [ ] Set up OpenAI credentials in n8n
- [ ] Create test workflow with Sentiment Analysis node
- [ ] Test Turkish language support
- [ ] Validate with sample survey data

### Week 3-4: Survey Intelligence
- [ ] Implement Survey Sentiment Analysis workflow
- [ ] Add Text Classifier for topic categorization
- [ ] Create staff alert workflow for negative feedback
- [ ] Test end-to-end with real survey responses

### Week 5-6: WhatsApp Enhancement
- [ ] Implement intelligent message routing
- [ ] Add AI help response capability
- [ ] Update existing workflows to use AI classification
- [ ] Test with various message formats

### Week 7-8: Admin Intelligence
- [ ] Create daily summary workflow
- [ ] Implement anomaly detection (basic)
- [ ] Set up scheduled reports
- [ ] Fine-tune prompts based on feedback

---

## 📊 Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Message understanding rate | ~60% (exact match) | 90%+ |
| Negative feedback response time | Manual review | < 5 minutes |
| Daily summary generation | Manual | Automated |
| Customer query resolution | N/A | 70% auto-resolved |

---

## ⚠️ Considerations

### Cost Management
- Use GPT-4o-mini for routine tasks (~$0.15/1M tokens)
- Reserve GPT-4o for complex analysis
- Implement caching for repeated queries
- Monitor token usage

### Turkish Language
- Test all prompts with Turkish text
- Use explicit Turkish instructions in system prompts
- Validate sentiment categories work for Turkish

### Privacy
- Never send full phone numbers to AI
- Mask PII before AI processing
- Log AI interactions for audit

### Fallback Strategy
- Always have non-AI fallback paths
- Don't block operations if AI fails
- Alert on AI service failures

---

## 📁 File Structure

```
n8n-workflows/
├── workflows-v2/
│   ├── whatsapp-final.json          # Existing
│   ├── survey-sentiment.json        # NEW
│   ├── survey-summary.json          # NEW
│   ├── intelligent-routing.json     # NEW
│   └── daily-summary.json           # NEW
├── docs/
│   ├── ai-workflows.md              # NEW
│   └── turkish-ai-prompts.md        # NEW
└── credentials/
    └── openai-template.json         # NEW
```

---

## 🔗 Related Documentation

- [n8n AI Nodes Documentation](https://docs.n8n.io/integrations/builtin/cluster-nodes/)
- [Sentiment Analysis Node](https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.sentimentanalysis/)
- [Text Classifier Node](https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.text-classifier/)
- [Basic LLM Chain](https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.chainllm/)

---

**Created:** 2024-11-30  
**Status:** Planning  
**Next Step:** Phase 1.1 - Survey Sentiment Analysis Implementation
