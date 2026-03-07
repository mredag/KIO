# PROJECT MAP — Eform Spor Merkezi Codebase

Machine-readable project intelligence for AI agents.

## Paths
- **Pi (Production):** `/home/eform-kio/kio-new/`
- **Windows (Dev):** `D:\PERSONEL\Eform-Resepsion-Kiosk-ClawBot`
- **Database (Pi):** `/home/eform-kio/kio-new/data/kiosk.db`
- **Database (Windows):** `D:\PERSONEL\Eform-Resepsion-Kiosk-ClawBot\backend\data\kiosk.db`

## Route → File Mapping (Frontend)

| URL Path | Component File | Description |
|----------|---------------|-------------|
| `/` | `frontend/src/pages/kiosk/KioskHomePage.tsx` | Kiosk home (public) |
| `/survey/:id` | `frontend/src/pages/kiosk/SurveyPage.tsx` | Kiosk survey |
| `/admin/login` | `frontend/src/pages/admin/LoginPage.tsx` | Admin login |
| `/admin` | `frontend/src/pages/admin/DashboardPage.tsx` | Main dashboard (NOT MCDashboardPage) |
| `/admin/massages` | `frontend/src/pages/admin/MassagesPage.tsx` | Massage list |
| `/admin/knowledge-base` | `frontend/src/pages/admin/KnowledgeBasePage.tsx` | KB editor |
| `/admin/ai-prompts` | `frontend/src/pages/admin/AIPromptsPage.tsx` | AI prompts (removed from sidebar) |
| `/admin/interactions` | `frontend/src/pages/admin/InteractionsPage.tsx` | DM interactions |
| `/admin/workflow-test` | `frontend/src/pages/admin/WorkflowTestPage.tsx` | DM Simulator |
| `/admin/mc` | REDIRECT → `/admin` | Redirects to DashboardPage |
| `/admin/mc/workshop` | `frontend/src/pages/admin/mc/MCWorkshopPage.tsx` | Job kanban |
| `/admin/mc/agents` | `frontend/src/pages/admin/mc/MCAgentsPage.tsx` | Agent management |
| `/admin/mc/jarvis` | `frontend/src/pages/admin/mc/MCJarvisPage.tsx` | Jarvis chat UI |
| `/admin/mc/conversations` | `frontend/src/pages/admin/mc/MCConversationsPage.tsx` | Conversations |
| `/admin/mc/costs` | `frontend/src/pages/admin/mc/MCCostsPage.tsx` | Cost analytics |
| `/admin/mc/policies` | `frontend/src/pages/admin/mc/MCPoliciesPage.tsx` | Policies |
| `/admin/mc/autopilot` | `frontend/src/pages/admin/mc/MCAutoPilotPage.tsx` | AutoPilot engine control |
| `/admin/mc/activity` | `frontend/src/pages/admin/mc/MCActivityPage.tsx` | Real-time activity feed |
| `/admin/mc/dm-kontrol` | `frontend/src/pages/admin/mc/MCDMKontrolPage.tsx` | Unified DM pipeline monitoring (Instagram + WhatsApp) |
| `/admin/mc/documents` | `frontend/src/pages/admin/mc/MCDocumentsPage.tsx` | Vector docs (removed from sidebar) |
| `/admin/mc/approvals` | `frontend/src/pages/admin/mc/MCApprovalsPage.tsx` | Approval quality gates (removed from sidebar) |
| `/admin/mc/comms` | `frontend/src/pages/admin/mc/MCCommsPage.tsx` | Agent comms & boards (removed from sidebar) |
| `/admin/mc/gateways` | `frontend/src/pages/admin/mc/MCGatewaysPage.tsx` | Gateway management (removed from sidebar) |
| `/admin/mc/skills` | `frontend/src/pages/admin/mc/MCSkillsPage.tsx` | Skills marketplace (removed from sidebar) |
| `/admin/mc/tags` | `frontend/src/pages/admin/mc/MCTagsPage.tsx` | Tags + custom fields (removed from sidebar) |

CRITICAL: `/admin/mc` redirects to `/admin`. The main dashboard is `DashboardPage.tsx`, NOT `MCDashboardPage.tsx`.

## API Route → File Mapping (Backend)

| Route Prefix | File | Pattern |
|-------------|------|---------|
| `/api/admin/*` | `backend/src/routes/adminRoutes.ts` | Session auth |
| `/api/kiosk/*` | `backend/src/routes/kioskRoutes.ts` | Public |
| `/api/integrations/*` | `backend/src/routes/integrationRoutes.ts` + `instagramIntegrationRoutes.ts` | API key auth |
| `/api/mc/*` | `backend/src/routes/missionControlRoutes.ts` | Factory: `createMissionControlRoutes(db)` |
| `/api/mc/jarvis/*` | `backend/src/routes/jarvisRoutes.ts` | Factory: `createJarvisRoutes(db)` |
| `/api/mc/comms/*`, `/api/mc/boards/*` | `backend/src/routes/agentCommsRoutes.ts` | Factory: `createAgentCommsRoutes(db)` |
| `/api/mc/autopilot/*` | `backend/src/routes/autopilotRoutes.ts` | Factory: `createAutoPilotRoutes(db)` + `setAutoPilotService()` |
| `/api/mc/activity/*` | `backend/src/routes/activityRoutes.ts` | Factory: `createActivityRoutes(db)` |
| `/api/mc/dm-kontrol/*` | `backend/src/routes/dmKontrolRoutes.ts` | Factory: `createDmKontrolRoutes(db)` — unified DM feed, health, errors, model-stats, test-mode, wa-pipeline-config |
| `/api/mc/audit/*` | `backend/src/routes/auditRoutes.ts` | Factory: `createAuditRoutes(db)` + `setAuditService()` |
| `/api/mc/hardware/*` | `backend/src/routes/hardwareRoutes.ts` | Factory: `createHardwareRoutes(db)` + `setHardwareWatchdogService()` |
| `/api/mc/gateways/*` | `backend/src/routes/gatewayRoutes.ts` | Factory: `createGatewayRoutes(db)` |
| `/api/mc/tags/*`, `/api/mc/custom-fields/*` | `backend/src/routes/tagsRoutes.ts` | Factory: `createTagsRoutes(db)` |
| `/webhook/instagram` | `backend/src/routes/instagramWebhookRoutes.ts` | Factory pattern |
| `/api/integrations/whatsapp/*` | `backend/src/routes/whatsappIntegrationRoutes.ts` | Factory: `createWhatsappIntegrationRoutes(db)`, API key auth |
| `/webhook/openclaw/whatsapp` | `backend/src/routes/whatsappLifecycleRoutes.ts` | Factory: `createWhatsappLifecycleRoutes(db)` |

## Key Services

| Service | File | Purpose |
|---------|------|---------|
| InstagramContextService | `backend/src/services/InstagramContextService.ts` | DM intent detection, model routing |
| OpenClawClientService | `backend/src/services/OpenClawClientService.ts` | WebSocket RPC to OpenClaw |
| DataBridgeService | `backend/src/services/DataBridgeService.ts` | Packages DB data for agents |
| JarvisSSEManager | `backend/src/services/JarvisSSEManager.ts` | Real-time UI updates |
| CommsSSEManager | `backend/src/services/CommsSSEManager.ts` | Board-scoped real-time updates |
| VectorStoreService | `backend/src/services/VectorStoreService.ts` | Vectra vector store |
| AutoPilotService | `backend/src/services/AutoPilotService.ts` | Autonomous agent engine (cron scanner, 4 triggers) |
| AgentDispatchService | `backend/src/services/AgentDispatchService.ts` | OpenClaw session dispatch + JSONL polling |
| AutoPilotSSEManager | `backend/src/services/AutoPilotSSEManager.ts` | Global SSE for AutoPilot events |
| ActivitySSEManager | `backend/src/services/ActivitySSEManager.ts` | SSE for activity feed |
| AgentLifecycleService | `backend/src/services/AgentLifecycleService.ts` | Agent provisioning, check-in, reconciliation |
| HardwareWatchdogService | `backend/src/services/HardwareWatchdogService.ts` | Pi 5 hardware monitoring (CPU temp, RAM, disk, fan, load) + Telegram alerts |
| WhatsAppContextService | `backend/src/services/WhatsAppContextService.ts` | WhatsApp intent detection, model routing, coupon/appointment detection, ignore list |
| WhatsAppPipelineConfigService | `backend/src/services/WhatsAppPipelineConfigService.ts` | Dynamic WhatsApp pipeline config in mc_policies |
| DatabaseService | `backend/src/database/DatabaseService.ts` | SQLite wrapper |

## Frontend Shared Components

| Component | File | Used By |
|-----------|------|---------|
| AdminLayout | `frontend/src/layouts/AdminLayout.tsx` | All admin pages |
| Sidebar | `frontend/src/components/admin/Sidebar.tsx` | Navigation |
| Header | `frontend/src/components/admin/Header.tsx` | Top bar |
| GlassCard | `frontend/src/components/mc/GlassCard.tsx` | MC pages |
| CommandPalette | `frontend/src/components/mc/CommandPalette.tsx` | Ctrl+K search |

## React Hooks

| Hook | File | Purpose |
|------|------|---------|
| useMissionControlApi | `frontend/src/hooks/useMissionControlApi.ts` | All MC API calls |
| useJarvisApi | `frontend/src/hooks/useJarvisApi.ts` | Jarvis CRUD |
| useJarvisSSE | `frontend/src/hooks/useJarvisSSE.ts` | Real-time updates |
| useAgentCommsApi | `frontend/src/hooks/useAgentCommsApi.ts` | Boards, messages, delegation, memory |
| useCommsSSE | `frontend/src/hooks/useCommsSSE.ts` | Real-time board updates |
| useAutoPilotApi | `frontend/src/hooks/useAutoPilotApi.ts` | AutoPilot CRUD + control |
| useAutoPilotSSE | `frontend/src/hooks/useAutoPilotSSE.ts` | Real-time AutoPilot updates |
| useActivityApi | `frontend/src/hooks/useActivityApi.ts` | Activity feed API calls |
| useActivitySSE | `frontend/src/hooks/useActivitySSE.ts` | Real-time activity updates |
| useGatewayApi | `frontend/src/hooks/useGatewayApi.ts` | Gateway CRUD + health check |
| useTagsApi | `frontend/src/hooks/useTagsApi.ts` | Tags + custom fields CRUD |
| useDmKontrolApi | `frontend/src/hooks/useDmKontrolApi.ts` | DM Kontrol feed, health, errors, model-stats, test-mode, wa-pipeline-config |
| useDmKontrolSSE | `frontend/src/hooks/useDmKontrolSSE.ts` | Real-time DM pipeline updates |

## Database

| Table | Purpose |
|-------|---------|
| knowledge_base | AI context (categories: services, pricing, hours, policies, contact, faq, general) |
| instagram_interactions | DM log with intent/sentiment/model_used |
| whatsapp_interactions | WhatsApp message log with model_used/tokens/tier/pipeline_trace/media_type |
| whatsapp_appointment_requests | Appointment requests (phone, service, date/time, status, staff_notes) |
| whatsapp_ignore_list | Numbers to skip AI processing (staff, suppliers, family) |
| mc_agents | AI agent registry |
| mc_jobs | Work items (queued→running→completed→failed) |
| mc_jarvis_sessions | Jarvis planning sessions |
| mc_jarvis_messages | Chat messages per session |
| mc_approvals | Confidence-based quality gates |
| mc_boards | Agent collaboration boards |
| mc_board_agents | Board membership |
| mc_agent_messages | Inter-agent messages |
| mc_shared_memory | Board-scoped key-value store |
| mc_task_deps | Task dependency graph |
| mc_gateways | OpenClaw gateway registry (url, status, config) |
| mc_tags | Tag definitions (name, color, description) |
| mc_tag_assignments | Tag ↔ entity many-to-many |
| mc_custom_fields | Custom field definitions (name, type, entity_type) |
| mc_custom_field_values | Custom field values per entity |

Schema: `backend/src/database/schema.sql` + `backend/src/database/mission-control-schema.sql` + `backend/src/database/agent-comms-schema.sql`

## Architecture Patterns

1. Factory routes: `createXxxRoutes(db)` — receives raw SQLite db, NOT DatabaseService
2. React Query: All API calls go through custom hooks in `frontend/src/hooks/`
3. i18n: Turkish primary, keys in `frontend/src/locales/tr/`
4. Styling: Tailwind CSS, dark theme with glassmorphism on MC pages
5. State: Zustand stores in `frontend/src/stores/`

## File Naming Conventions

- React pages: PascalCase (`DashboardPage.tsx`)
- React components: PascalCase (`GlassCard.tsx`)
- Hooks: camelCase with `use` prefix (`useMissionControlApi.ts`)
- Routes: camelCase (`jarvisRoutes.ts`)
- Services: PascalCase (`DataBridgeService.ts`)

## OpenClaw Agent Workspaces

| Workspace | Path | Agent | Purpose |
|-----------|------|-------|---------|
| Main (Jarvis/Telegram) | `openclaw-config/workspace/` | `main` | Jarvis chat, Telegram, Instagram hooks |
| WhatsApp | `openclaw-config/workspace-whatsapp/` | `whatsapp` | WhatsApp DM via Baileys channel |
| Forge | `openclaw-config/workspaces/forge/` | `forge` | Code analysis, KB management |
| Instagram | `openclaw-config/workspaces/instagram/` | `instagram` | Instagram-focused analysis and hook support |

Config: `openclaw-config/openclaw.json` → `~/.openclaw/openclaw.json`
Sessions: `~/.openclaw/agents/main/sessions/` (main agent), `~/.openclaw/agents/whatsapp/sessions/` (WhatsApp agent)
