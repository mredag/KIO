# n8n Messaging Workflows

WhatsApp ve Instagram üzerinden kupon sistemi ve AI chatbot entegrasyonu için n8n workflow'ları.

## 📂 Yapı

```
n8n-workflows/
├── workflows-v2/
│   ├── whatsapp-final.json      ✅ Production (keyword-based)
│   ├── whatsapp-hybrid-v2.json  🆕 Keyword + AI fallback
│   ├── whatsapp-ai-agent.json   🆕 Full AI Agent (LangChain)
│   └── instagram-ai-agent.json  🆕 Instagram AI Chatbot
├── knowledge-base/
│   └── spa-info.md              📚 SPA bilgi tabanı (AI için)
├── templates/
│   └── openrouter-base.json     OpenRouter HTTP template
├── docs/
│   ├── instagram-setup.md       📱 Instagram kurulum rehberi
│   ├── WORKFLOW_COMPARISON.md   Workflow karşılaştırması
│   ├── TROUBLESHOOTING.md       Sorun giderme
│   ├── turkish-message-templates.md
│   └── ...
├── credentials/
│   └── credentials-template.json
└── deployment/
    ├── deploy-ai-workflows.sh
    └── ...
```

## 🚀 Hızlı Başlangıç

### Production (Önerilen)
```bash
# whatsapp-final.json zaten Pi'da aktif
ssh eform-kio@192.168.1.5 "n8n list:workflow"
```

### AI Test (Opsiyonel)
```bash
# Hybrid v2 - keyword öncelikli, AI fallback
scp workflows-v2/whatsapp-hybrid-v2.json eform-kio@192.168.1.5:~/
ssh eform-kio@192.168.1.5 "n8n import:workflow --input=~/whatsapp-hybrid-v2.json"
```

## 📊 Workflow Seçimi

### WhatsApp Workflows
| Senaryo | Workflow | Maliyet |
|---------|----------|---------|
| Production, güvenilir | `whatsapp-final.json` | $0 |
| AI denemek | `whatsapp-hybrid-v2.json` | ~$0.01/gün |
| Tam AI | `whatsapp-ai-agent.json` | ~$0.10/gün |

### Instagram Workflows
| Senaryo | Workflow | Maliyet |
|---------|----------|---------|
| AI Chatbot (Gemini) | `instagram-ai-agent.json` | ~$0.05/gün |

Detaylı karşılaştırma: [docs/WORKFLOW_COMPARISON.md](docs/WORKFLOW_COMPARISON.md)
Instagram kurulum: [docs/instagram-setup.md](docs/instagram-setup.md)

## 🔧 Gerekli Credentials

### Backend API
```
Name: Backend API
Type: Header Auth
Header: Authorization
Value: Bearer <YOUR_N8N_API_KEY>
```

### WhatsApp API
```
Name: WhatsApp API
Type: Header Auth
Header: Authorization
Value: Bearer <YOUR_WHATSAPP_ACCESS_TOKEN>
```

### OpenRouter API (AI için)
```
Name: OpenRouter API
Type: Header Auth
Header: Authorization
Value: Bearer sk-or-v1-xxxxx
```

## 📱 Desteklenen Komutlar

| Komut | Açıklama |
|-------|----------|
| `KUPON <KOD>` | Kupon ekle |
| `DURUM` / `BAKIYE` | Bakiye sorgula |
| `KUPON KULLAN` | 4 kupon = ücretsiz masaj |
| `YARDIM` | Yardım mesajı |
| `IPTAL` | Bildirimleri kapat |

## 🔗 İlgili Dosyalar

- Backend API: `backend/src/routes/integrationCouponRoutes.ts`
- Steering: `.kiro/steering/n8n-development.md`
- Spec: `.kiro/specs/whatsapp-coupon-system/`

---

**Son Güncelleme:** 2025-11-30
