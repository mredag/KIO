## WhatsApp AI — OpenClaw Flow (Active)

**Status:** ✅ Full pipeline working. OpenClaw Baileys channel (QR code login, no Cloud API). Agent calls backend APIs via HTTP tools.
**Agent:** `whatsapp` with workspace `~/.openclaw/workspace-whatsapp`
**Model:** Dynamic — light/standard/advanced tier routing via `WhatsAppContextService`
**Channel:** Baileys (`dmPolicy: "open"`, `groupPolicy: "disabled"`)

```
WhatsApp Message → OpenClaw Baileys Channel
  → Agent receives message (workspace-whatsapp/AGENTS.md)
  → Check ignore list: GET /api/integrations/whatsapp/ignore-check/:phone
  → If ignored → skip processing
  → Detect intent (coupon keywords, appointment intent, general query)
  → If coupon keyword → call coupon API endpoints
  → If appointment intent → multi-turn collection → POST /appointment-requests → Telegram notification
  → Fetch KB: GET /api/integrations/knowledge/context?categories=X,Y
  → Generate response (direct from agent, using KB context)
  → POST /api/integrations/whatsapp/validate-response (policy validation)
  → If violation → correction retry (max 2) → fallback message
  → Send reply (OpenClaw handles via Baileys)
  → POST /api/integrations/whatsapp/interaction (log outbound + MC integration)
```

### WhatsApp Agent Config (openclaw.json)
- Agent: `whatsapp` with workspace `~/.openclaw/workspace-whatsapp`, model `openrouter/moonshotai/kimi-k2`
- Channel: WhatsApp via Baileys (`dmPolicy: "open"`, `groupPolicy: "disabled"`, `sendReadReceipts: true`)
- Binding: `{ agentId: "whatsapp", match: { channel: "whatsapp" } }`
- Lifecycle hook: `whatsapp-lifecycle` → `http://localhost:3001/webhook/openclaw/whatsapp`

### WhatsApp Pipeline Config (Dynamic)
Stored in `mc_policies` as `wa_pipeline_config` (same pattern as Instagram's `dm_pipeline_config`). Editable at runtime via API.

| API | Method | Purpose |
|-----|--------|---------|
| `/api/mc/dm-kontrol/wa-pipeline-config` | GET | Current WhatsApp pipeline config |
| `/api/mc/dm-kontrol/wa-pipeline-config` | PATCH | Partial update (deep merge) |
| `/api/mc/dm-kontrol/wa-pipeline-config/reset` | POST | Reset to defaults |

### WhatsApp Key Files
| File | Purpose |
|------|---------|
| `backend/src/services/WhatsAppContextService.ts` | Intent detection, model routing, ignore list, coupon/appointment detection |
| `backend/src/services/WhatsAppPipelineConfigService.ts` | Dynamic pipeline config in mc_policies |
| `backend/src/routes/whatsappIntegrationRoutes.ts` | All WhatsApp API routes (12 endpoints) |
| `backend/src/routes/whatsappLifecycleRoutes.ts` | OpenClaw lifecycle webhook |
| `openclaw-config/workspace-whatsapp/AGENTS.md` | WhatsApp agent instructions |
| `openclaw-config/workspace-whatsapp/TOOLS.md` | WhatsApp agent tool definitions |

---

