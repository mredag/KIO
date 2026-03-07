import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type Database from 'better-sqlite3';
import { OpenClawClientService } from '../services/OpenClawClientService.js';
import { JarvisSSEManager } from '../services/JarvisSSEManager.js';
import { DataBridgeService } from '../services/DataBridgeService.js';
import { checkApprovalGate, extractConfidence } from './missionControlRoutes.js';
import { PipelineConfigService } from '../services/PipelineConfigService.js';
import { HardwareWatchdogService } from '../services/HardwareWatchdogService.js';

const OPENCLAW_SESSIONS_DIR = join(homedir(), '.openclaw', 'agents', 'main', 'sessions');

let _db: Database.Database | null = null;
let _hardwareWatchdog: HardwareWatchdogService | null = null;

export function setJarvisHardwareWatchdog(service: HardwareWatchdogService): void {
  _hardwareWatchdog = service;
}

export function createJarvisRoutes(db: Database.Database) {
  _db = db;
  return router;
}

const router = Router();

function getDb(): Database.Database {
  if (!_db) throw new Error('Jarvis routes not initialized');
  return _db;
}

function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Lazily connect the OpenClaw client if not already connected.
 * Returns the client if connected, null otherwise.
 */
async function getOpenClawClient(): Promise<OpenClawClientService | null> {
  if (process.env.OPENCLAW_JARVIS_ENABLED !== 'true') return null;
  try {
    const client = OpenClawClientService.getInstance();
    if (!client.isConnected()) {
      await client.connect();
    }
    return client;
  } catch (err: any) {
    console.warn('[Jarvis] OpenClaw client connect failed:', err.message);
    return null;
  }
}

function emitEvent(entityType: string, entityId: string, eventType: string, message: string, fromState?: string, toState?: string, metadata?: any) {
  const db = getDb();
  db.prepare(`INSERT INTO mc_events (entity_type, entity_id, event_type, from_state, to_state, message, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    entityType, entityId, eventType, fromState || null, toState || null, message, metadata ? JSON.stringify(metadata) : null
  );
}

// ============================================================
// JSONL POLLING — Read agent responses from OpenClaw session files
// ============================================================

/**
 * Poll OpenClaw session JSONL for the agent's final text response.
 * Same proven pattern as instagramWebhookRoutes.ts pollAgentResponse.
 * Returns the last assistant text message or null after timeout.
 * 
 * @param sessionKey - The OpenClaw session key (e.g. "agent:main:jarvis:jarvis:{id}")
 * @param maxWaitMs - Maximum time to wait for a response
 * @param skipLines - Number of JSONL lines to skip (lines from previous turns)
 */
type AgentPhase = 'connecting' | 'waiting_session' | 'agent_thinking' | 'agent_responding' | 'finalizing';
type StatusCallback = (phase: AgentPhase, detail?: string) => void;

/**
 * Detect OpenClaw heartbeat responses that leak into Jarvis sessions.
 * Heartbeat fires on "last" session of main agent — if that's a Jarvis session,
 * the response pollutes the JSONL. Filter these out.
 */
function isHeartbeatResponse(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t === 'heartbeat_ok' || t === 'heartbeat_ok.') return true;
  if (t.includes('heartbeat_ok') && t.length < 100) return true;
  if (t.includes('heartbeat.md') && t.includes('follow it strictly')) return true;
  if (t.includes('missing_api_key') && t.includes('heartbeat')) return true;
  return false;
}

interface PollResult {
  text: string | null;
  usedTools: boolean;
}

async function pollJarvisResponse(sessionKey: string, maxWaitMs = 60000, skipLines = 0, onStatus?: StatusCallback): Promise<PollResult> {
  const pollInterval = 2000;
  const startTime = Date.now();
  let lastLineCount = 0;
  let stableAt = 0;
  let lastPhase: AgentPhase | null = null;
  let sawToolUse = false;

  function emitPhase(phase: AgentPhase, detail?: string) {
    if (phase !== lastPhase) {
      lastPhase = phase;
      onStatus?.(phase, detail);
    }
  }

  emitPhase('connecting');

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const sessionsFile = join(OPENCLAW_SESSIONS_DIR, 'sessions.json');
      if (!existsSync(sessionsFile)) {
        emitPhase('waiting_session');
        await new Promise(r => setTimeout(r, pollInterval));
        continue;
      }
      const sessionsData = JSON.parse(readFileSync(sessionsFile, 'utf-8'));
      const sessionInfo = sessionsData[sessionKey];
      if (!sessionInfo?.sessionId) {
        emitPhase('waiting_session');
        await new Promise(r => setTimeout(r, pollInterval));
        continue;
      }

      const jsonlFile = join(OPENCLAW_SESSIONS_DIR, `${sessionInfo.sessionId}.jsonl`);
      if (!existsSync(jsonlFile)) {
        emitPhase('agent_thinking');
        await new Promise(r => setTimeout(r, pollInterval));
        continue;
      }

      const allLines = readFileSync(jsonlFile, 'utf-8').trim().split('\n');
      // Only consider lines after skipLines (new content from this turn)
      const lines = allLines.slice(skipLines);

      if (lines.length !== lastLineCount) {
        lastLineCount = lines.length;
        stableAt = Date.now();
        // Lines are growing — agent is actively responding
        emitPhase('agent_responding', `${lines.length} satır işlendi`);
      } else if (lines.length === 0) {
        emitPhase('agent_thinking');
      }

      // Track tool usage across all new lines
      if (!sawToolUse) {
        for (const line of lines) {
          try {
            const e = JSON.parse(line);
            if (e.type === 'message' && e.message?.role === 'assistant' && e.message?.stopReason === 'toolUse') {
              sawToolUse = true;
              break;
            }
          } catch { /* skip */ }
        }
      }

      // Look for a clean stopReason=stop assistant message in new lines
      // Skip heartbeat responses — OpenClaw heartbeat fires on "last" session
      // and can pollute Jarvis sessions with HEARTBEAT_OK or confused replies
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const entry = JSON.parse(lines[i]);
          if (entry.type === 'message' && entry.message?.role === 'assistant' && entry.message?.stopReason === 'stop') {
            const content = entry.message.content;
            let text = '';
            if (Array.isArray(content)) {
              const textPart = content.find((c: { type: string }) => c.type === 'text');
              text = textPart?.text || '';
            } else if (typeof content === 'string') {
              text = content.trim();
            }
            // Filter out heartbeat responses
            if (text && !isHeartbeatResponse(text)) {
              emitPhase('finalizing');
              return { text, usedTools: sawToolUse };
            }
          }
        } catch { /* skip malformed lines */ }
      }

      // Fallback: if stable for 8s (agent stuck in tool loop), grab last assistant text from new lines
      const stableDuration = Date.now() - stableAt;
      if (stableAt > 0 && stableDuration > 8000) {
        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            const entry = JSON.parse(lines[i]);
            if (entry.type === 'message' && entry.message?.role === 'assistant') {
              const content = entry.message.content;
              if (Array.isArray(content)) {
                const textPart = content.find((c: { type: string }) => c.type === 'text');
                if (textPart?.text && textPart.text.length > 20 && !isHeartbeatResponse(textPart.text)) {
                  console.log('[Jarvis Poll] Using fallback text (agent stable for 8s)');
                  emitPhase('finalizing');
                  return { text: textPart.text, usedTools: sawToolUse };
                }
              }
            }
          } catch { /* skip */ }
        }
      }
    } catch (err: any) {
      console.error('[Jarvis Poll] Error:', err.message);
    }
    await new Promise(r => setTimeout(r, pollInterval));
  }
  return { text: null, usedTools: sawToolUse };
}

/**
 * Get the current line count of a session's JSONL file.
 * Used to snapshot the "before" state so polling only sees new lines.
 */
function getSessionLineCount(sessionKey: string): number {
  try {
    const sessionsFile = join(OPENCLAW_SESSIONS_DIR, 'sessions.json');
    if (!existsSync(sessionsFile)) return 0;
    const sessionsData = JSON.parse(readFileSync(sessionsFile, 'utf-8'));
    const sessionInfo = sessionsData[sessionKey];
    if (!sessionInfo?.sessionId) return 0;
    const jsonlFile = join(OPENCLAW_SESSIONS_DIR, `${sessionInfo.sessionId}.jsonl`);
    if (!existsSync(jsonlFile)) return 0;
    return readFileSync(jsonlFile, 'utf-8').trim().split('\n').length;
  } catch {
    return 0;
  }
}

/**
 * Background poll for a Jarvis session response.
 * After chat.send, this polls the JSONL file, persists the response,
 * checks for task_summary, and pushes SSE events.
 */
function startResponsePolling(sessionId: string, sessionKey: string, maxWaitMs = 60000, skipLines = 0): void {
  const sseManager = JarvisSSEManager.getInstance();

  // Push typing indicator
  sseManager.pushEvent(sessionId, { type: 'typing', data: {} });

  const statusCallback: StatusCallback = (phase, detail) => {
    sseManager.pushEvent(sessionId, {
      type: 'agent_status',
      data: { phase, detail: detail || null, startedAt: Date.now() },
    });
  };

  pollJarvisResponse(sessionKey, maxWaitMs, skipLines, statusCallback).then((result) => {
    try {
      const db = getDb();
      const { text: responseText, usedTools } = result;

      if (!responseText) {
        console.warn('[Jarvis Poll] No response after timeout for session', sessionId);
        sseManager.pushEvent(sessionId, {
          type: 'error',
          data: { error: 'Jarvis yanıt zaman aşımına uğradı.' },
        });
        return;
      }

      console.log('[Jarvis Poll] Response received for session %s (%d chars, usedTools=%s)', sessionId, responseText.length, usedTools);

      // Persist assistant message
      const messageId = generateId();
      db.prepare(`INSERT INTO mc_jarvis_messages (id, session_id, role, content) VALUES (?, ?, 'assistant', ?)`).run(
        messageId, sessionId, responseText
      );
      db.prepare(`UPDATE mc_jarvis_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(sessionId);

      // Check for task_summary
      const summary = extractTaskSummary(responseText);
      const session = db.prepare('SELECT status FROM mc_jarvis_sessions WHERE id = ?').get(sessionId) as any;

      if (summary && session?.status === 'planning') {
        db.prepare(`UPDATE mc_jarvis_sessions SET status = 'awaiting_confirmation', summary = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
          JSON.stringify(summary), sessionId
        );
        sseManager.pushEvent(sessionId, {
          type: 'status',
          data: { status: 'awaiting_confirmation', summary },
        });
      } else if (!summary && session?.status === 'planning' && usedTools) {
        // Operational task completed — agent used exec tools and returned a result
        // without producing a task_summary (no code change needed, just API calls)
        console.log('[Jarvis Poll] Operational task completed for session %s', sessionId);
        db.prepare(`UPDATE mc_jarvis_sessions SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(sessionId);
        emitEvent('jarvis_session', sessionId, 'operational_complete', 'Operasyonel görev tamamlandı', 'planning', 'completed');
        sseManager.pushEvent(sessionId, {
          type: 'status',
          data: { status: 'completed' },
        });
      }

      // Push message to SSE
      sseManager.pushEvent(sessionId, {
        type: 'message_complete',
        data: { id: messageId, role: 'assistant', content: responseText },
      });
    } catch (err: any) {
      console.error('[Jarvis Poll] Error persisting response:', err.message);
    }
  }).catch((err) => {
    console.error('[Jarvis Poll] Unexpected error:', err);
  });
}

// ============================================================
// SESSIONS — CRUD
// ============================================================

// POST /sessions — Create new planning session
router.post('/sessions', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const id = generateId();
    const title = req.body.title || 'Yeni Görev';

    // Try to create an OpenClaw session for planning chat
    let openclawSessionKey: string | null = null;
    try {
      const ocClient = await getOpenClawClient();
      if (ocClient) {
        const sessionInfo = await ocClient.createSession('jarvis', `jarvis:${id}`);
        openclawSessionKey = sessionInfo.id;
      }
    } catch (err: any) {
      // OpenClaw may not be available — session still works, just no AI chat
      console.warn('[Jarvis] OpenClaw session creation failed:', err.message);
    }

    db.prepare(`INSERT INTO mc_jarvis_sessions (id, status, title, openclaw_session_key) VALUES (?, 'planning', ?, ?)`).run(
      id, title, openclawSessionKey
    );

    const session = db.prepare('SELECT * FROM mc_jarvis_sessions WHERE id = ?').get(id);
    res.status(201).json(session);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /sessions — List sessions ordered by updated_at DESC
router.get('/sessions', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const sessions = db.prepare('SELECT * FROM mc_jarvis_sessions ORDER BY updated_at DESC').all();
    res.json(sessions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /sessions/:id — Session detail with joined agent and job info
router.get('/sessions/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const session = db.prepare('SELECT * FROM mc_jarvis_sessions WHERE id = ?').get(req.params.id) as any;
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    let agent = null;
    let job = null;
    if (session.agent_id) {
      agent = db.prepare('SELECT * FROM mc_agents WHERE id = ?').get(session.agent_id);
    }
    if (session.job_id) {
      job = db.prepare('SELECT * FROM mc_jobs WHERE id = ?').get(session.job_id);
    }

    res.json({ ...session, agent, job });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /sessions/:id/messages — Messages ordered by created_at ASC
router.get('/sessions/:id/messages', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const session = db.prepare('SELECT id FROM mc_jarvis_sessions WHERE id = ?').get(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const messages = db.prepare('SELECT * FROM mc_jarvis_messages WHERE session_id = ? ORDER BY created_at ASC').all(req.params.id);
    res.json(messages);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /sessions/:id/stream — SSE endpoint
router.get('/sessions/:id/stream', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const session = db.prepare('SELECT id FROM mc_jarvis_sessions WHERE id = ?').get(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const sseManager = JarvisSSEManager.getInstance();
    sseManager.addClient(req.params.id, res);

    // Send initial connected event
    res.write(`data: ${JSON.stringify({ type: 'status', data: { connected: true } })}\n\n`);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// ============================================================
// PLANNING SYSTEM PROMPT
// ============================================================

const PLANNING_SYSTEM_PROMPT = `Sen Jarvis, bir görev planlama ve yürütme asistanısın. İki tür görev var:

## 1. OPERASYONel GÖREVLER (Ayar değişikliği, config, prompt, API çağrısı)
Kullanıcı bir AYAR DEĞİŞTİRMEK, CONFIG GÜNCELLEMEK, PROMPT/TEMPLATE DEĞİŞTİRMEK, DM YANITLARINI DEĞİŞTİRMEK veya API ÇAĞRISI yapmak istiyorsa:
- ASLA soru SORMA, HEMEN YÜRÜT — kullanıcı ne istediğini zaten söyledi
- exec tool ile PowerShell komutu çalıştır (login → GET mevcut → PATCH değişiklik → GET doğrula)
- Sonucu Türkçe olarak kullanıcıya bildir
- "Şöyle cevap ver", "bunu söyleme", "prompt'a ekle" gibi istekler OPERASYONel görevdir

### DM Pipeline Config (En Sık Kullanılan)
Pipeline ayarlarını değiştirmek için TOOLS.md'deki "DM Pipeline Config API" bölümüne bak.
Önce session auth al, sonra PATCH çağrısı yap:

\`\`\`powershell
# 1. Login (session cookie al)
$loginBody = '{"username":"admin","password":"admin123"}'
$loginResp = Invoke-WebRequest -Uri "http://localhost:3001/api/admin/login" -Method POST -ContentType "application/json" -Body $loginBody -SessionVariable session

# 2. Mevcut config'i oku
Invoke-RestMethod -Uri "http://localhost:3001/api/mc/dm-kontrol/pipeline-config" -Method GET -WebSession $session

# 3. Değişiklik yap (partial merge)
Invoke-RestMethod -Uri "http://localhost:3001/api/mc/dm-kontrol/pipeline-config" -Method PATCH -ContentType "application/json" -Body '{"directResponse":{"tiers":{"standard":{"enabled":true}}}}' -WebSession $session
\`\`\`

### Operasyonel Görev Örnekleri
- "Standard tier'ı direkt yanıta geçir" → PATCH pipeline-config
- "Policy validation'ı kapat" → PATCH pipeline-config
- "Light tier modelini değiştir" → PATCH pipeline-config
- "Test modunu aç" → PATCH test-mode
- "Polling interval'ı 1.5 saniyeye düşür" → PATCH pipeline-config
- "Ayarları sıfırla" → POST pipeline-config/reset
- "Mesaj yönlendirmesini test et" → POST preview-routing
- "Prompt'u güncelle / şunu ekle / böyle cevap ver" → PATCH pipeline-config (directPrompt.systemTemplate)
- "Uygunsuz mesajlara şöyle cevap ver" → PATCH pipeline-config (directPrompt.systemTemplate'e kural ekle)
- "Fiyat soranlar için özel prompt yaz" → PATCH pipeline-config (directPrompt.systemTemplate güncelle)

### ÇOK ÖNEMLİ — PROMPT/TEMPLATE DEĞİŞİKLİKLERİ
Kullanıcı DM yanıt metnini, prompt'u veya asistan davranışını değiştirmek istiyorsa:
- Bu bir OPERASYONel görevdir, KOD görevi DEĞİL
- directPrompt.systemTemplate alanını PATCH ile güncelle
- Mevcut template'i önce GET ile oku, sonra kullanıcının istediği kuralı/metni EKLE
- Mevcut kuralları KORU, sadece yeni kural ekle veya istenen değişikliği yap
- Soru SORMA — kullanıcı ne istediğini zaten söyledi, hemen yap

Bu tür görevlerde task_summary JSON'u OLUŞTURMA. Doğrudan exec ile komutu çalıştır.

### KARAR AĞACI (Her mesajda bunu takip et)
1. Kullanıcı config/ayar/prompt/template/tier/model/policy değiştirmek istiyor mu? → OPERASYONel → exec ile HEMEN yap
2. Kullanıcı DM yanıt davranışını değiştirmek istiyor mu? (ör: "şöyle cevap ver", "bunu söyleme") → OPERASYONel → systemTemplate PATCH
3. Kullanıcı kod dosyası düzenlemek istiyor mu? → KOD görevi → task_summary oluştur

## 2. KOD GÖREVLERİ (Dosya düzenleme, yeni özellik, bug fix)
Kullanıcı KOD DEĞİŞİKLİĞİ istiyorsa (yeni özellik, bug fix, UI değişikliği):
- Kısa ve net sorular sor (1-3 soru yeterli)
- Türkçe yanıt ver, kısa ve öz ol
- KRİTİK: Görev hangi dosyaları etkileyecekse, MUTLAKA targetFiles listesine ekle
- Yeterli bilgi topladığında, aşağıdaki JSON formatında bir görev özeti oluştur:

\`\`\`json
{
  "type": "task_summary",
  "title": "Görev başlığı",
  "objective": "Görevin amacı — TAM ve AÇIK yaz, belirsizlik bırakma",
  "targetFiles": ["frontend/src/pages/admin/DashboardPage.tsx"],
  "constraints": ["Kısıt 1", "Kısıt 2"],
  "deliverables": ["Çıktı 1", "Çıktı 2"],
  "verificationSteps": ["Dosyayı oku ve değişikliği doğrula", "Tarayıcıda kontrol et"],
  "suggestedModel": "openai/gpt-4.1",
  "suggestedRole": "developer"
}
\`\`\`

## targetFiles Kuralları (ÇOK ÖNEMLİ)
- Her görev için etkilenecek dosyaların TAM yolunu belirt (frontend/src/... veya backend/src/...)
- UI değişiklikleri: Doğru sayfa dosyasını bul. DİKKAT: /admin ana dashboard = DashboardPage.tsx (MCDashboardPage DEĞİL)
- Backend değişiklikleri: İlgili route veya service dosyasını belirt
- DB değişiklikleri: İlgili migration veya seed dosyasını belirt
- Emin değilsen, birden fazla aday dosya listele

## Proje Yapısı Özeti
- /admin → frontend/src/pages/admin/DashboardPage.tsx (ana dashboard)
- /admin/mc → /admin'e REDIRECT eder (MCDashboardPage KULLANILMAZ)
- /admin/mc/workshop → MCWorkshopPage.tsx
- /admin/mc/agents → MCAgentsPage.tsx
- /admin/mc/jarvis → MCJarvisPage.tsx
- Backend routes: backend/src/routes/ (factory pattern)
- Services: backend/src/services/
- DB: backend/data/kiosk.db (SQLite WAL)

## Ajan İletişim Sistemi
Bu proje tam bir ajan-ajan iletişim sistemi içerir:
- Ajanlar (mc_agents): AI ajan kaydı (isim, rol, model, durum)
- Panolar (mc_boards): İşbirliği panoları (amaç, lider ajan, üyeler)
- Mesajlaşma (mc_agent_messages): Ajanlar arası mesaj (nudge, delegation, status_update, context_share, query, response)
- Görev Delegasyonu: Bağımlılık grafiği ile görev atama (DFS döngü kontrolü)
- Paylaşılan Hafıza (mc_shared_memory): Pano kapsamlı key-value store
- Onay Sistemi (mc_approvals): Güven puanı bazlı kalite kapıları

Eğer kullanıcı ajan oluşturma, pano yönetimi, görev delegasyonu veya mesajlaşma ile ilgili bir görev tanımlıyorsa:
- targetFiles'a backend/src/routes/agentCommsRoutes.ts ve/veya missionControlRoutes.ts ekle
- API endpoint'lerini kullanarak görev planla (doğrudan DB sorgusu YAPMA)
- Pano route: /admin/mc/comms (frontend/src/pages/admin/mc/MCCommsPage.tsx)

Model seçenekleri:
- openai/gpt-4.1: Komutanlık, planlama, araştırma, genel görevler
- openai-codex/gpt-5.3-codex: Kod değişikliği, debugging, çok dosyalı geliştirme
- openai/gpt-4o-mini: Basit/hızlı görevler`;

// ============================================================
// SYSTEM CONTEXT ENRICHMENT — Auto-inject DB data for planning
// ============================================================

/**
 * Detects what the user is asking about and fetches relevant system data.
 * This solves the "blind agent" problem for planning chat — the agent
 * gets real data to reason about instead of trying to run SQL queries.
 */
function buildSystemContext(userMessage: string): string {
  const db = getDb();
  const msg = userMessage.toLowerCase();
  const parts: string[] = [];

  // Pipeline config context
  if (msg.match(/pipeline|config|ayar|setting|tier|light|standard|advanced|direkt|direct|model|polling|policy|fallback/)) {
    try {
      const pipelineConfig = new PipelineConfigService(db);
      const config = pipelineConfig.getConfig();
      parts.push('## ⚙️ DM Pipeline Mevcut Ayarlar');
      parts.push(`- Master switch: ${config.directResponse.enabled ? 'AÇIK' : 'KAPALI'}`);
      parts.push(`- Light tier: ${config.directResponse.tiers.light.enabled ? '✅ Direkt' : '❌ OpenClaw'} — model: ${config.directResponse.tiers.light.modelId} — policy skip: ${config.directResponse.tiers.light.skipPolicyValidation}`);
      parts.push(`- Standard tier: ${config.directResponse.tiers.standard.enabled ? '✅ Direkt' : '❌ OpenClaw'} — model: ${config.directResponse.tiers.standard.modelId} — policy skip: ${config.directResponse.tiers.standard.skipPolicyValidation}`);
      parts.push(`- Advanced tier: ${config.directResponse.tiers.advanced.enabled ? '✅ Direkt' : '❌ OpenClaw'} — model: ${config.directResponse.tiers.advanced.modelId} — policy skip: ${config.directResponse.tiers.advanced.skipPolicyValidation}`);
      parts.push(`- Policy: ${config.policy.enabled ? 'AÇIK' : 'KAPALI'} — max retries: ${config.policy.maxRetries} — validation model: ${config.policy.validationModel}`);
      parts.push(`- Polling: interval ${config.polling.intervalMs}ms, max wait ${config.polling.maxWaitMs}ms`);
      parts.push(`- Fallback: "${config.fallbackMessage.substring(0, 80)}..."`);
      parts.push('');
      parts.push('Bu ayarları değiştirmek için exec ile PATCH /api/mc/dm-kontrol/pipeline-config çağır. TOOLS.md\'deki örneklere bak.');
    } catch (err: any) {
      console.warn('[Jarvis] Failed to fetch pipeline config context:', err.message);
    }
  }

  // Instagram DM context
  if (msg.match(/instagram|dm|mesaj|ajan|agent|sağlık|health|durum|status/)) {
    try {
      const bridge = new DataBridgeService(db);
      const data = bridge.fetchDMReviewData(30, 5); // last 30 days, 5 conversations max
      parts.push('## 📊 Instagram DM Ajan Verileri (Son 30 Gün)');
      parts.push(`- Toplam mesaj: ${data.stats.totalMessages}`);
      parts.push(`- Yanıt üretilen: ${data.stats.responsesGenerated}`);
      parts.push(`- Benzersiz gönderici: ${data.stats.uniqueSenders}`);
      parts.push(`- Ort. yanıt süresi: ${data.stats.avgResponseTimeMs}ms`);
      parts.push(`- Toplam token: ${data.stats.totalTokens}`);
      if (data.modelDistribution.length > 0) {
        parts.push('### Model Dağılımı');
        data.modelDistribution.forEach(m => parts.push(`  - ${m.model}: ${m.count}`));
      }
      if (data.intentBreakdown.length > 0) {
        parts.push('### Niyet Dağılımı');
        data.intentBreakdown.slice(0, 8).forEach(i => parts.push(`  - ${i.intent}: ${i.count}`));
      }

      // Son 20 mesaj — sub-agent spawn'a gerek kalmadan direkt enjekte
      const recentDMs = db.prepare(`
        SELECT direction, instagram_id, message_text, ai_response, intent, sentiment,
               model_used, model_tier, response_time_ms, tokens_estimated, 
               pipeline_error, created_at
        FROM instagram_interactions
        ORDER BY created_at DESC LIMIT 20
      `).all() as any[];
      if (recentDMs.length > 0) {
        parts.push('### Son 20 Mesaj');
        recentDMs.forEach((m: any) => {
          const dir = m.direction === 'inbound' ? '📥' : '📤';
          const model = m.model_used ? ` [${m.model_used}]` : '';
          const rt = m.response_time_ms ? ` ${m.response_time_ms}ms` : '';
          const tier = m.model_tier ? ` (${m.model_tier})` : '';
          const error = m.pipeline_error ? ` ⚠️ ${m.pipeline_error}` : '';
          const text = m.direction === 'inbound' ? (m.message_text || '').substring(0, 100) : (m.ai_response || '').substring(0, 100);
          parts.push(`  - ${dir}${model}${tier}${rt} ${m.instagram_id}: ${text}${error} (${m.created_at})`);
        });
      }

      // DM Pipeline health (son 7 gün)
      const healthStats = db.prepare(`
        SELECT 
          COUNT(CASE WHEN direction = 'outbound' AND pipeline_error IS NULL THEN 1 END) as success,
          COUNT(CASE WHEN direction = 'outbound' AND pipeline_error IS NOT NULL THEN 1 END) as errors,
          COUNT(CASE WHEN direction = 'outbound' THEN 1 END) as total_outbound,
          AVG(CASE WHEN direction = 'outbound' AND response_time_ms > 0 THEN response_time_ms END) as avg_rt,
          MIN(CASE WHEN direction = 'outbound' AND response_time_ms > 0 THEN response_time_ms END) as min_rt,
          MAX(CASE WHEN direction = 'outbound' AND response_time_ms > 0 THEN response_time_ms END) as max_rt,
          COUNT(CASE WHEN direction = 'outbound' AND response_time_ms > 10000 THEN 1 END) as slow_count
        FROM instagram_interactions
        WHERE created_at >= datetime('now', '-7 days')
      `).get() as any;
      if (healthStats && healthStats.total_outbound > 0) {
        const successRate = ((healthStats.success / healthStats.total_outbound) * 100).toFixed(1);
        parts.push('### Pipeline Sağlık (Son 7 Gün)');
        parts.push(`  - Başarı oranı: %${successRate} (${healthStats.success}/${healthStats.total_outbound})`);
        parts.push(`  - Yanıt süresi: ort ${Math.round(healthStats.avg_rt || 0)}ms, min ${healthStats.min_rt || 0}ms, max ${healthStats.max_rt || 0}ms`);
        parts.push(`  - Yavaş yanıt (>10s): ${healthStats.slow_count}`);
        parts.push(`  - Hata: ${healthStats.errors}`);
      }
    } catch (err: any) {
      console.warn('[Jarvis] Failed to fetch Instagram context:', err.message);
    }
  }

  // WhatsApp data injection
  const waKeywords = /whatsapp|wa\b|mesaj/i;
  if (waKeywords.test(msg)) {
    try {
      // Last 30 days WhatsApp stats
      const waStats = db.prepare(`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN direction = 'outbound' THEN 1 END) as responses,
          AVG(CASE WHEN direction = 'outbound' AND response_time_ms > 0 THEN response_time_ms END) as avg_rt
        FROM whatsapp_interactions
        WHERE created_at >= datetime('now', '-30 days')
      `).get() as any;

      parts.push('## 📱 WhatsApp Verileri (Son 30 Gün)');
      parts.push(`- Toplam mesaj: ${waStats?.total || 0}`);
      parts.push(`- Yanıt üretilen: ${waStats?.responses || 0}`);
      parts.push(`- Ort. yanıt süresi: ${Math.round(waStats?.avg_rt || 0)}ms`);

      // Model distribution
      const waModels = db.prepare(`
        SELECT model_used, COUNT(*) as count
        FROM whatsapp_interactions
        WHERE model_used IS NOT NULL AND created_at >= datetime('now', '-30 days')
        GROUP BY model_used ORDER BY count DESC
      `).all() as any[];
      if (waModels.length > 0) {
        parts.push('### Model Dağılımı');
        waModels.forEach((m: any) => parts.push(`  - ${m.model_used}: ${m.count}`));
      }

      // Last 20 WhatsApp messages
      const waRecent = db.prepare(`
        SELECT direction, phone, message_text, ai_response, intent,
               model_used, model_tier, response_time_ms, tokens_estimated,
               pipeline_error, created_at
        FROM whatsapp_interactions
        ORDER BY created_at DESC LIMIT 20
      `).all() as any[];
      if (waRecent.length > 0) {
        parts.push('### Son 20 WhatsApp Mesajı');
        waRecent.forEach((m: any) => {
          const dir = m.direction === 'inbound' ? '📥' : '📤';
          const model = m.model_used ? ` [${m.model_used}]` : '';
          const rt = m.response_time_ms ? ` ${m.response_time_ms}ms` : '';
          const tier = m.model_tier ? ` (${m.model_tier})` : '';
          const error = m.pipeline_error ? ` ⚠️ ${m.pipeline_error}` : '';
          const text = m.direction === 'inbound' ? (m.message_text || '').substring(0, 100) : (m.ai_response || '').substring(0, 100);
          parts.push(`  - ${dir}${model}${tier}${rt} ${m.phone}: ${text}${error} (${m.created_at})`);
        });
      }

      // Pending appointment requests
      const pendingAppts = db.prepare(`
        SELECT id, phone, service_requested, preferred_date, preferred_time, created_at
        FROM whatsapp_appointment_requests
        WHERE status = 'pending'
        ORDER BY created_at DESC
      `).all() as any[];
      if (pendingAppts.length > 0) {
        parts.push('### Bekleyen Randevu Talepleri');
        pendingAppts.forEach((a: any) => {
          parts.push(`  - ${a.phone}: ${a.service_requested || '-'} — ${a.preferred_date || '?'} ${a.preferred_time || '?'} (${a.created_at}) [id: ${a.id}]`);
        });
      } else {
        parts.push('### Bekleyen Randevu Talepleri: Yok');
      }

      // Ignore list summary
      const ignoreCount = (db.prepare('SELECT COUNT(*) as c FROM whatsapp_ignore_list').get() as any)?.c || 0;
      const recentIgnored = db.prepare(`
        SELECT phone, label, added_by, created_at
        FROM whatsapp_ignore_list
        ORDER BY created_at DESC LIMIT 5
      `).all() as any[];
      parts.push(`### Engel Listesi: ${ignoreCount} numara`);
      if (recentIgnored.length > 0) {
        recentIgnored.forEach((i: any) => {
          parts.push(`  - ${i.phone} (${i.label || '-'}) — ekleyen: ${i.added_by || '-'} (${i.created_at})`);
        });
      }
      parts.push('');
    } catch (err: any) {
      console.warn('[Jarvis] Failed to fetch WhatsApp context:', err.message);
    }
  }

  // Phone number auto-detection — fetch WhatsApp conversation without explicit "WhatsApp" mention
  const phoneMatch = msg.match(/(?:\+?90|0)?5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/);
  if (phoneMatch) {
    try {
      const normalizedPhone = phoneMatch[0].replace(/[\s.-]/g, '').replace(/^0/, '90').replace(/^\+/, '');

      // Full WhatsApp conversation history for this phone
      const phoneConvo = db.prepare(`
        SELECT direction, message_text, ai_response, intent, model_used,
               model_tier, response_time_ms, pipeline_error, created_at
        FROM whatsapp_interactions
        WHERE phone LIKE ?
        ORDER BY created_at ASC
      `).all(`%${normalizedPhone}%`) as any[];

      if (phoneConvo.length > 0) {
        parts.push(`## 📞 WhatsApp Konuşma Geçmişi: ${normalizedPhone} (${phoneConvo.length} mesaj)`);
        phoneConvo.forEach((m: any) => {
          const dir = m.direction === 'inbound' ? '📥' : '📤';
          const model = m.model_used ? ` [${m.model_used}]` : '';
          const rt = m.response_time_ms ? ` ${m.response_time_ms}ms` : '';
          const error = m.pipeline_error ? ` ⚠️ ${m.pipeline_error}` : '';
          const text = m.direction === 'inbound' ? (m.message_text || '').substring(0, 150) : (m.ai_response || '').substring(0, 150);
          parts.push(`  - ${dir}${model}${rt} ${text}${error} (${m.created_at})`);
        });
      }

      // Pending appointment requests for this phone
      const phoneAppts = db.prepare(`
        SELECT id, service_requested, preferred_date, preferred_time, status, staff_notes, created_at
        FROM whatsapp_appointment_requests
        WHERE phone LIKE ?
        ORDER BY created_at DESC
      `).all(`%${normalizedPhone}%`) as any[];
      if (phoneAppts.length > 0) {
        parts.push(`### Randevu Talepleri (${normalizedPhone})`);
        phoneAppts.forEach((a: any) => {
          parts.push(`  - ${a.service_requested || '-'} — ${a.preferred_date || '?'} ${a.preferred_time || '?'} — durum: ${a.status} — not: ${a.staff_notes || '-'} (${a.created_at}) [id: ${a.id}]`);
        });
      }

      // Ignore list status for this phone
      const ignoreStatus = db.prepare(`
        SELECT phone, label, added_by, created_at
        FROM whatsapp_ignore_list
        WHERE phone LIKE ?
      `).get(`%${normalizedPhone}%`) as any;
      if (ignoreStatus) {
        parts.push(`### ⛔ Engel Listesinde: ${ignoreStatus.phone} (${ignoreStatus.label || '-'}) — ekleyen: ${ignoreStatus.added_by || '-'} (${ignoreStatus.created_at})`);
      } else {
        parts.push(`### Engel Listesi: ${normalizedPhone} listede DEĞİL`);
      }
      parts.push('');
    } catch (err: any) {
      console.warn('[Jarvis] Failed to fetch phone context:', err.message);
    }
  }

  // MC system overview
  if (msg.match(/sistem|system|genel|overview|dashboard|mc|mission|kontrol|rapor|report/)) {
    try {
      const agentCount = (db.prepare('SELECT COUNT(*) as c FROM mc_agents').get() as any).c;
      const jobStats = db.prepare(`
        SELECT status, COUNT(*) as c FROM mc_jobs GROUP BY status
      `).all() as any[];
      const recentEvents = db.prepare(`
        SELECT event_type, message, created_at FROM mc_events ORDER BY created_at DESC LIMIT 10
      `).all() as any[];

      parts.push('## 🖥️ Mission Control Genel Durum');
      parts.push(`- Kayıtlı ajan: ${agentCount}`);
      if (jobStats.length > 0) {
        parts.push('### İş Durumları');
        jobStats.forEach(j => parts.push(`  - ${j.status}: ${j.c}`));
      }
      if (recentEvents.length > 0) {
        parts.push('### Son Olaylar');
        recentEvents.slice(0, 5).forEach(e => parts.push(`  - [${e.event_type}] ${e.message} (${e.created_at})`));
      }
    } catch (err: any) {
      console.warn('[Jarvis] Failed to fetch MC context:', err.message);
    }
  }

  // Approval queue
  if (msg.match(/onay|approval|bekleyen|pending|kalite|quality/)) {
    try {
      const pending = db.prepare(`
        SELECT a.id, a.job_id, a.confidence_score, j.title, a.created_at
        FROM mc_approvals a JOIN mc_jobs j ON a.job_id = j.id
        WHERE a.status = 'pending' ORDER BY a.created_at DESC LIMIT 5
      `).all() as any[];
      if (pending.length > 0) {
        parts.push('## ⏳ Bekleyen Onaylar');
        pending.forEach(p => parts.push(`  - "${p.title}" — güven: %${Math.round((p.confidence_score || 0) * 100)} (${p.created_at})`));
      } else {
        parts.push('## ⏳ Bekleyen Onaylar: Yok (tümü işlenmiş)');
      }
    } catch (err: any) {
      console.warn('[Jarvis] Failed to fetch approval context:', err.message);
    }
  }

  // Hardware / system health context
  if (msg.match(/hardware|donanım|sıcaklık|temp|ram|memory|bellek|disk|fan|cpu|load|yük|uptime|ssd|health|sağlık/)) {
    try {
      if (_hardwareWatchdog) {
        const snap = _hardwareWatchdog.collectSnapshot();
        parts.push('## 🖥️ Donanım Durumu (Canlı)');
        parts.push(`- Platform: ${snap.platform}`);
        parts.push(`- Node: ${snap.nodeVersion}`);
        parts.push(`- Hostname: ${snap.network.hostname} (${snap.network.interfaces.map(i => `${i.name}: ${i.ip}`).join(', ')})`);
        parts.push(`- Uptime: ${snap.uptime.formatted}`);
        parts.push('');
        parts.push('### CPU');
        parts.push(`  - Sıcaklık: ${snap.cpu.tempCelsius !== null ? snap.cpu.tempCelsius + '°C' : 'okunamadı'}`);
        parts.push(`  - Yük (1m/5m/15m): ${snap.cpu.load1m} / ${snap.cpu.load5m} / ${snap.cpu.load15m}`);
        parts.push(`  - Çekirdek: ${snap.cpu.cores}, Yük %: ${snap.cpu.loadPercent}`);
        parts.push('');
        parts.push('### Bellek (RAM)');
        parts.push(`  - Toplam: ${snap.memory.totalMB}MB`);
        parts.push(`  - Kullanılan: ${snap.memory.usedMB}MB (%${snap.memory.usedPercent})`);
        parts.push(`  - Boş: ${snap.memory.freeMB}MB`);
        parts.push('');
        parts.push('### Disk');
        parts.push(`  - Yol: ${snap.disk.path}`);
        parts.push(`  - Toplam: ${snap.disk.totalGB}GB`);
        parts.push(`  - Kullanılan: ${snap.disk.usedGB}GB (%${snap.disk.usedPercent})`);
        parts.push(`  - Boş: ${snap.disk.freeGB}GB`);
        if (snap.fan.driverLoaded) {
          parts.push('');
          parts.push('### Fan');
          parts.push(`  - RPM: ${snap.fan.rpm ?? 'okunamadı'}`);
          parts.push(`  - Durum: ${snap.fan.state ?? 'bilinmiyor'} (0=kapalı, 1-4=kademe)`);
          parts.push(`  - Sürücü: yüklü ✅`);
        } else {
          parts.push('');
          parts.push('### Fan: Sürücü yüklü değil (Windows veya fan overlay eksik)');
        }

        // Recent alerts
        const recentAlerts = _hardwareWatchdog.getAlertHistory(5);
        if (recentAlerts.length > 0) {
          parts.push('');
          parts.push('### Son Donanım Uyarıları');
          recentAlerts.forEach((a: any) => parts.push(`  - ${a.message} (${a.created_at})`));
        }

        // Thresholds
        const cfg = _hardwareWatchdog.getConfig();
        parts.push('');
        parts.push('### Eşik Değerleri');
        parts.push(`  - CPU kritik: ${cfg.thresholds.cpuTempCritical}°C, uyarı: ${cfg.thresholds.cpuTempWarning}°C`);
        parts.push(`  - RAM: %${cfg.thresholds.ramUsedPercent}`);
        parts.push(`  - Disk: %${cfg.thresholds.diskUsedPercent}`);
        parts.push(`  - Yük/çekirdek: ${cfg.thresholds.loadPerCore}`);
        parts.push(`  - Fan min RPM: ${cfg.thresholds.fanRpmMin}`);
      } else {
        parts.push('## 🖥️ Donanım İzleyici: Başlatılmamış');
      }
    } catch (err: any) {
      console.warn('[Jarvis] Failed to fetch hardware context:', err.message);
    }
  }

  // Agent comms & boards context
  if (msg.match(/board|pano|ajan|agent|iletişim|comms|delegat|hafıza|memory|mesaj|message|görev.?ata|task.?assign/)) {
    try {
      // Active boards with members
      const boards = db.prepare(`
        SELECT b.id, b.name, b.objective, b.status, b.lead_agent_id,
          (SELECT GROUP_CONCAT(a.name, ', ') FROM mc_board_agents ba JOIN mc_agents a ON ba.agent_id = a.id WHERE ba.board_id = b.id) as members
        FROM mc_boards b WHERE b.status != 'archived' ORDER BY b.created_at DESC LIMIT 10
      `).all() as any[];

      // All registered agents
      const agents = db.prepare(`SELECT id, name, role, status, model FROM mc_agents ORDER BY status DESC, name ASC`).all() as any[];

      // Recent messages
      const recentMessages = db.prepare(`
        SELECT m.message_type, m.content, m.delivery_status, m.created_at,
          s.name as sender_name, r.name as recipient_name, b.name as board_name
        FROM mc_agent_messages m
        LEFT JOIN mc_agents s ON m.sender_id = s.id
        LEFT JOIN mc_agents r ON m.recipient_id = r.id
        LEFT JOIN mc_boards b ON m.board_id = b.id
        ORDER BY m.created_at DESC LIMIT 10
      `).all() as any[];

      // Shared memory items
      const memoryItems = db.prepare(`
        SELECT sm.key, sm.memory_type, sm.tags, sm.board_id, b.name as board_name
        FROM mc_shared_memory sm
        LEFT JOIN mc_boards b ON sm.board_id = b.id
        ORDER BY sm.updated_at DESC LIMIT 10
      `).all() as any[];

      parts.push('## 🤝 Ajan İletişim Sistemi');

      if (agents.length > 0) {
        parts.push('### Kayıtlı Ajanlar');
        agents.forEach(a => parts.push(`  - ${a.name} (${a.role || 'genel'}) — ${a.status} — model: ${a.model || 'varsayılan'} — id: ${a.id}`));
      } else {
        parts.push('### Kayıtlı Ajanlar: Henüz yok');
      }

      if (boards.length > 0) {
        parts.push('### Aktif Panolar');
        boards.forEach(b => parts.push(`  - "${b.name}" — amaç: ${b.objective || '-'} — lider: ${b.lead_agent_id || '-'} — üyeler: ${b.members || 'yok'} — durum: ${b.status} — id: ${b.id}`));
      } else {
        parts.push('### Aktif Panolar: Henüz yok');
      }

      if (recentMessages.length > 0) {
        parts.push('### Son Mesajlar');
        recentMessages.slice(0, 5).forEach(m => parts.push(`  - [${m.message_type}] ${m.sender_name} → ${m.recipient_name}: ${(m.content || '').substring(0, 80)}${m.content?.length > 80 ? '...' : ''} (${m.delivery_status}, ${m.created_at})`));
      }

      if (memoryItems.length > 0) {
        parts.push('### Paylaşılan Hafıza');
        memoryItems.slice(0, 5).forEach(m => parts.push(`  - [${m.memory_type}] ${m.board_name || 'global'}: ${m.key} (tags: ${m.tags || '-'})`));
      }

      // Inject the protocol reference
      parts.push(`### 📋 Ajan Protokolü (API Referansı)
Aşağıdaki API'ler ile ajan sistemi yönetilir (Base: http://localhost:3001/api/mc):

**Ajan CRUD:**
- POST /agents — Yeni ajan oluştur: { name, role, model, status, objective }
- GET /agents — Tüm ajanları listele
- PATCH /agents/:id — Ajan güncelle
- DELETE /agents/:id — Ajan sil

**Pano (Board) Yönetimi:**
- POST /boards — Yeni pano: { name, objective, lead_agent_id }
- GET /boards — Panoları listele (?status=active)
- PATCH /boards/:id — Pano güncelle (status: active/paused/completed/archived)
- POST /boards/:id/agents — Üye ekle: { agent_id }
- DELETE /boards/:id/agents — Üye çıkar: { agent_id }

**Mesajlaşma:**
- POST /comms/send — Mesaj gönder: { sender_id, recipient_id, message_type, content, board_id? }
  message_type: nudge | delegation | status_update | context_share | query | response
- GET /comms/messages — Mesajları listele (?sender_id, ?recipient_id, ?message_type, ?board_id)
- POST /comms/broadcast — Tüm pano üyelerine: { board_id, sender_id, content }

**Görev Delegasyonu:**
- POST /comms/delegate — Görev ata: { board_id, title, description, assigned_agent_id, depends_on?: string[] }
  Otomatik DFS döngü kontrolü yapar. mc_jobs + mc_task_deps oluşturur.
- POST /comms/task-completed — Görev tamamlandı bildirimi: { job_id, summary }

**Paylaşılan Hafıza:**
- POST /comms/memory — Hafıza yaz: { board_id, key, value, memory_type, tags? }
  memory_type: context | decision | artifact | reference
- GET /comms/memory — Hafıza oku (?board_id, ?memory_type, ?key)
- DELETE /comms/memory — Hafıza sil: { board_id, key }

**Tipik İş Akışı:**
1. POST /agents ile yeni ajan oluştur
2. POST /boards ile pano oluştur (lead_agent_id belirt)
3. POST /boards/:id/agents ile üyeleri ekle
4. POST /comms/delegate ile görevleri ata (depends_on ile bağımlılık belirt)
5. POST /comms/send ile ajanlar arası mesaj gönder
6. POST /comms/memory ile paylaşılan bilgi yaz
7. POST /comms/task-completed ile görev tamamlandı bildir`);
    } catch (err: any) {
      console.warn('[Jarvis] Failed to fetch agent comms context:', err.message);
    }
  }

  if (parts.length === 0) return '';

  return '\n\n---\n\n# 📋 Sistem Bağlamı (Otomatik Enjekte Edildi)\nBu veriler KIO veritabanından doğrudan çekildi. API çağrısı yapmanıza GEREK YOK.\n\n' + parts.join('\n');
}

// ============================================================
// TASK SUMMARY DETECTION
// ============================================================

/**
 * Attempts to extract a task_summary JSON block from an assistant message.
 * Returns the parsed summary or null if not found/invalid.
 */
export function extractTaskSummary(content: string): Record<string, unknown> | null {
  // Try to find JSON block in markdown code fence
  const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : null;

  if (!jsonStr) return null;

  try {
    const parsed = JSON.parse(jsonStr);
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.type === 'task_summary' &&
      typeof parsed.title === 'string' &&
      typeof parsed.objective === 'string' &&
      Array.isArray(parsed.deliverables) &&
      typeof parsed.suggestedModel === 'string'
    ) {
      // Ensure targetFiles is always an array (even if missing)
      if (!Array.isArray(parsed.targetFiles)) {
        parsed.targetFiles = [];
      }
      if (!Array.isArray(parsed.verificationSteps)) {
        parsed.verificationSteps = [];
      }
      return parsed;
    }
  } catch {
    // Not valid JSON — treat as normal message
  }

  return null;
}

// ============================================================
// MESSAGES — Send with OpenClaw integration
// ============================================================

// POST /sessions/:id/messages — Send user message, forward to OpenClaw
router.post('/sessions/:id/messages', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const sessionId = req.params.id;
    const { content } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({ error: 'Message content is required' });
      return;
    }

    // Validate session exists and is in a valid state for messaging
    const session = db.prepare('SELECT * FROM mc_jarvis_sessions WHERE id = ?').get(sessionId) as any;
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    if (session.status !== 'planning' && session.status !== 'awaiting_confirmation') {
      res.status(400).json({ error: `Cannot send messages in session with status "${session.status}"` });
      return;
    }

    // Persist user message (persist-first pattern)
    const messageId = generateId();
    db.prepare(`INSERT INTO mc_jarvis_messages (id, session_id, role, content) VALUES (?, ?, 'user', ?)`).run(
      messageId, sessionId, content.trim()
    );

    // Update session timestamp
    db.prepare(`UPDATE mc_jarvis_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(sessionId);

    // Forward to OpenClaw if connected
    if (session.openclaw_session_key) {
      try {
        const ocClient = await getOpenClawClient();
        if (ocClient) {
          // Check if this is the first message — include planning system prompt
          const messageCount = (db.prepare('SELECT COUNT(*) as count FROM mc_jarvis_messages WHERE session_id = ? AND role = ?').get(sessionId, 'user') as any).count;
          // Auto-enrich with system context based on message content
          const systemContext = buildSystemContext(content.trim());
          const messageToSend = messageCount <= 1
            ? `${PLANNING_SYSTEM_PROMPT}${systemContext}\n\n---\n\nKullanıcı görevi: ${content.trim()}`
            : `${content.trim()}${systemContext}`;

          // Snapshot JSONL line count before sending (so polling only sees new lines)
          const linesBefore = getSessionLineCount(session.openclaw_session_key);

          await ocClient.sendMessage(session.openclaw_session_key, messageToSend);

          // Start background polling for the response
          startResponsePolling(sessionId, session.openclaw_session_key, 60000, linesBefore);
        } else {
          // OpenClaw client returned null (disabled or failed to init)
          const errMsg = '⚠️ OpenClaw bağlantısı kurulamadı. Gateway\'in çalıştığından emin olun (`openclaw gateway --port 18789`).';
          const errId = generateId();
          db.prepare(`INSERT INTO mc_jarvis_messages (id, session_id, role, content) VALUES (?, ?, 'assistant', ?)`).run(errId, sessionId, errMsg);
          const sseManager = JarvisSSEManager.getInstance();
          sseManager.pushEvent(sessionId, { type: 'error', data: { message: errMsg } });
        }
      } catch (err: any) {
        console.warn('[Jarvis] Failed to forward message to OpenClaw:', err.message);
        const errMsg = `⚠️ OpenClaw hatası: ${err.message}`;
        const errId = generateId();
        db.prepare(`INSERT INTO mc_jarvis_messages (id, session_id, role, content) VALUES (?, ?, 'assistant', ?)`).run(errId, sessionId, errMsg);
        const sseManager = JarvisSSEManager.getInstance();
        sseManager.pushEvent(sessionId, { type: 'error', data: { message: errMsg } });
      }
    } else {
      // No OpenClaw session key — gateway was offline when session was created
      const errMsg = '⚠️ OpenClaw bağlantısı yok. Oturum oluşturulurken gateway erişilemezdi. Yeni bir oturum oluşturun veya gateway\'i başlatın (`openclaw gateway --port 18789`).';
      const errId = generateId();
      db.prepare(`INSERT INTO mc_jarvis_messages (id, session_id, role, content) VALUES (?, ?, 'assistant', ?)`).run(errId, sessionId, errMsg);
      const sseManager = JarvisSSEManager.getInstance();
      sseManager.pushEvent(sessionId, { type: 'error', data: { message: errMsg } });
    }

    res.status(202).json({ id: messageId, session_id: sessionId, role: 'user', content: content.trim() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// OPENCLAW CHAT EVENT HANDLER (DEPRECATED — replaced by JSONL polling)
// ============================================================
// The WebSocket chat event listener was unreliable because:
// 1. OpenClaw doesn't push chat events back over WebSocket for hook/session responses
// 2. The singleton was created before dotenv, so the listener was set up pre-connect
// Response polling via JSONL files (startResponsePolling) is now the primary mechanism.


// ============================================================
// MODEL SELECTION MAP
// ============================================================

const MODEL_MAP: Record<string, string> = {
  developer: 'openai-codex/gpt-5.3-codex',
  researcher: 'openai/gpt-4.1',
  analyst: 'openai/gpt-4.1',
  general: 'openai/gpt-4.1',
  simple: 'openai/gpt-4o-mini',
};

const FALLBACK_MODEL = 'openai/gpt-4.1';

function selectModel(suggestedModel?: string, suggestedRole?: string): string {
  if (suggestedModel && typeof suggestedModel === 'string') {
    return suggestedModel;
  }
  if (suggestedRole && MODEL_MAP[suggestedRole]) {
    return MODEL_MAP[suggestedRole];
  }
  return FALLBACK_MODEL;
}

// ============================================================
// CONFIRM — Agent creation + task dispatch
// ============================================================

// POST /sessions/:id/confirm — Confirm planning, create agent, dispatch task
router.post('/sessions/:id/confirm', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const sessionId = req.params.id;
    const sseManager = JarvisSSEManager.getInstance();

    // Validate session exists and is awaiting confirmation
    const session = db.prepare('SELECT * FROM mc_jarvis_sessions WHERE id = ?').get(sessionId) as any;
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    if (session.status !== 'awaiting_confirmation') {
      res.status(400).json({ error: `Session must be in "awaiting_confirmation" status, currently "${session.status}"` });
      return;
    }

    // Parse the planning summary
    let summary: Record<string, any>;
    try {
      summary = JSON.parse(session.summary);
    } catch {
      res.status(400).json({ error: 'Session has no valid planning summary' });
      return;
    }

    const model = selectModel(summary.suggestedModel, summary.suggestedRole);
    const agentId = generateId();
    const jobId = generateId();

    // 1. Create mc_agents record
    db.prepare(`INSERT INTO mc_agents (id, name, role, objective, model, provider, status, capabilities) VALUES (?, ?, ?, ?, ?, 'openrouter', 'idle', ?)`).run(
      agentId,
      summary.title || 'Jarvis Agent',
      summary.suggestedRole || 'developer',
      summary.objective || null,
      model,
      summary.deliverables ? JSON.stringify(summary.deliverables) : null
    );

    // Emit agent creation event
    emitEvent('agent', agentId, 'created', `Agent created from Jarvis planning session ${sessionId}`, undefined, 'idle', {
      sessionId,
      model,
      role: summary.suggestedRole,
    });

    // 2. Create mc_jobs record
    db.prepare(`INSERT INTO mc_jobs (id, title, source, status, agent_id, payload) VALUES (?, ?, 'admin', 'queued', ?, ?)`).run(
      jobId,
      summary.title || 'Jarvis Task',
      agentId,
      JSON.stringify(summary)
    );

    // Emit job creation event
    emitEvent('job', jobId, 'created', `Job created from Jarvis planning session ${sessionId}`, undefined, 'queued', {
      sessionId,
      agentId,
    });

    // 3. Create OpenClaw execution session and dispatch task
    let executionSessionKey: string | null = null;
    try {
      const ocClient = await getOpenClawClient();
      if (ocClient) {
        // Create a new execution session
        const execSession = await ocClient.createSession('jarvis-exec', `jarvis-exec:${jobId}`);
        executionSessionKey = execSession.id;

        // Build task instructions from summary
        const taskInstructions = buildTaskInstructions(summary);

        // Snapshot JSONL line count before sending
        const linesBefore = getSessionLineCount(executionSessionKey);

        // Send task to the execution session
        await ocClient.sendMessage(executionSessionKey, taskInstructions);

        // Dispatch acknowledged — update job to running
        db.prepare(`UPDATE mc_jobs SET status = 'running', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(jobId);

        // Create mc_runs record
        const runId = generateId();
        db.prepare(`INSERT INTO mc_runs (id, job_id, agent_id, status, model) VALUES (?, ?, ?, 'running', ?)`).run(
          runId, jobId, agentId, model
        );

        // Emit dispatch event
        emitEvent('job', jobId, 'status_change', 'Task dispatched to OpenClaw', 'queued', 'running', {
          executionSessionKey,
          runId,
        });

        sseManager.pushEvent(sessionId, {
          type: 'status',
          data: { status: 'confirmed', jobId, agentId, executionSessionKey },
        });

        // Start monitoring the execution session for completion/timeout
        startExecutionMonitoring(sessionId, executionSessionKey, jobId, agentId, model, linesBefore);
      }
    } catch (err: any) {
      // Dispatch failed — mark job as failed
      console.error('[Jarvis] Dispatch error:', err.message);
      db.prepare(`UPDATE mc_jobs SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
        err.message, jobId
      );

      emitEvent('job', jobId, 'status_change', `Dispatch failed: ${err.message}`, 'queued', 'failed', {
        error: err.message,
      });

      sseManager.pushEvent(sessionId, {
        type: 'error',
        data: { error: `Görev gönderimi başarısız: ${err.message}` },
      });
    }

    // 4. Update session status to confirmed
    db.prepare(`UPDATE mc_jarvis_sessions SET status = 'confirmed', agent_id = ?, job_id = ?, execution_session_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
      agentId, jobId, executionSessionKey, sessionId
    );

    // Return the full result
    const updatedSession = db.prepare('SELECT * FROM mc_jarvis_sessions WHERE id = ?').get(sessionId);
    const agent = db.prepare('SELECT * FROM mc_agents WHERE id = ?').get(agentId);
    const job = db.prepare('SELECT * FROM mc_jobs WHERE id = ?').get(jobId);

    res.json({ session: updatedSession, agent, job });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function buildTaskInstructions(summary: Record<string, any>): string {
  const parts: string[] = [];

  // --- Section 1: Identity & Mandate ---
  parts.push(`Sen bir görev yürütme ajanısın. Bu görev ONAYLANMIŞ — gerçek değişiklikler yapmalısın.
Sadece plan yapma, YÜRÜT. İşin bitince ne yaptığını kısaca özetle.`);

  // --- Section 2: Task Details (FIRST — most important) ---
  parts.push(`# GÖREV`);
  parts.push(`Başlık: ${summary.title || 'Bilinmeyen görev'}`);
  if (summary.objective) parts.push(`Amaç: ${summary.objective}`);

  // Target files — the KEY improvement
  if (summary.targetFiles?.length) {
    parts.push(`\n## Hedef Dosyalar (BUNLARI düzenle)`);
    summary.targetFiles.forEach((f: string) => parts.push(`- ${f}`));
    parts.push(`ÖNEMLİ: Yukarıdaki dosyaları düzenle. Başka dosyalara DOKUNMA (gerekmedikçe).`);
  }

  if (summary.constraints?.length) parts.push(`\nKısıtlar:\n${summary.constraints.map((c: string) => `- ${c}`).join('\n')}`);
  if (summary.deliverables?.length) parts.push(`\nBeklenen çıktılar:\n${summary.deliverables.map((d: string) => `- ${d}`).join('\n')}`);

  // Verification steps
  if (summary.verificationSteps?.length) {
    parts.push(`\n## Doğrulama Adımları (İŞ BİTTİKTEN SONRA yap)`);
    summary.verificationSteps.forEach((v: string, i: number) => parts.push(`${i + 1}. ${v}`));
  } else {
    parts.push(`\n## Doğrulama (İŞ BİTTİKTEN SONRA yap)
1. Değiştirdiğin dosyayı oku ve değişikliğin doğru uygulandığını kontrol et
2. Eğer TypeScript dosyası değiştirdiysen, derleme hatası olmadığını doğrula`);
  }

  // --- Section 2.5: Agent Comms Protocol (if task involves agents) ---
  const taskText = `${summary.title || ''} ${summary.objective || ''} ${(summary.targetFiles || []).join(' ')}`.toLowerCase();
  if (taskText.match(/agent|ajan|board|pano|comms|iletişim|delegat|memory|hafıza|mesaj|message/)) {
    parts.push(`# AJAN İLETİŞİM PROTOKOLÜ
Bu görev ajan sistemi ile ilgili. API çağrıları için:
Base URL: http://localhost:3001/api/mc

Ajan CRUD: POST/GET /agents, PATCH/DELETE /agents/:id
Pano: POST/GET /boards, PATCH/DELETE /boards/:id, POST/DELETE /boards/:id/agents
Mesaj: POST /comms/send { sender_id, recipient_id, message_type, content, board_id? }
Broadcast: POST /comms/broadcast { board_id, sender_id, content }
Delegasyon: POST /comms/delegate { board_id, title, description, assigned_agent_id, depends_on? }
Tamamlama: POST /comms/task-completed { job_id, summary }
Hafıza: POST/GET/DELETE /comms/memory { board_id, key, value, memory_type, tags? }

message_type: nudge | delegation | status_update | context_share | query | response
memory_type: context | decision | artifact | reference

Auth: Session auth (admin panel cookies) — Authorization Bearer kullanma, session cookie kullan.`);
  }

  // --- Section 3: Environment (compact) ---
  parts.push(`# ORTAM
- OS: Windows + PowerShell
- Codebase: D:\\\\PERSONEL\\\\Eform-Resepsion-Kiosk-ClawBot
- npm workspaces: frontend/ (React+Vite+Tailwind) ve backend/ (Express+SQLite)
- DB: backend/data/kiosk.db (SQLite WAL, better-sqlite3)
- Backend API: http://localhost:3001 (/api/integrations/* => Authorization: Bearer <KIO_API_KEY>, /api/mc/* => session auth)
- Node 18 gerekli (fnm use 18) — backend/DB komutlarından ÖNCE geçiş yap
- tsconfig.json'ı DEĞİŞTİRME`);

  // --- Section 4: Execution Methods (compact) ---
  parts.push(`# YÜRÜTME YÖNTEMLERİ

## Kod Değişiklikleri → Codex CLI
bash pty:true workdir:D:\\\\PERSONEL\\\\Eform-Resepsion-Kiosk-ClawBot command:"codex exec --yolo 'GÖREV AÇIKLAMASI'"
- MUTLAKA --yolo kullan (--full-auto read-only sandbox'tur)
- Codex'e TAM bağlam ver: hangi dosya, ne değişecek, neden

## API Çağrıları → PowerShell
Invoke-RestMethod -Uri "URL" -Method GET -Headers @{ "Authorization" = "Bearer <KIO_API_KEY>" }
DİKKAT: curl KULLANMA (PowerShell'de Invoke-WebRequest'e alias'lıdır)

## DB Sorguları → Node.js (sqlite3 CLI YOK)
node -e "const Database = require('better-sqlite3'); const db = new Database('D:\\\\PERSONEL\\\\Eform-Resepsion-Kiosk-ClawBot\\\\backend\\\\data\\\\kiosk.db'); console.log(JSON.stringify(db.prepare('SQL').all())); db.close();"

## TS Derleme (tek dosya)
npx tsc src/routes/<dosya>.ts --outDir dist --rootDir src --esModuleInterop --module nodenext --moduleResolution nodenext --target es2020 --skipLibCheck --declaration false`);

  // --- Section 5: Project Map (injected from file if available) ---
  try {
    const projectMapPath = join(homedir(), '.openclaw', 'workspace', 'PROJECT_MAP.md');
    if (existsSync(projectMapPath)) {
      const projectMap = readFileSync(projectMapPath, 'utf-8');
      parts.push(`# PROJE HARİTASI\n${projectMap}`);
    }
  } catch { /* Project map not available — not critical */ }

  parts.push(`\n---\nŞimdi bu görevi YÜRÜT. Hedef dosyaları düzenle, sonra doğrulama adımlarını uygula.`);

  return parts.join('\n\n');
}



// ============================================================
// EXECUTION MONITORING & COMPLETION
// ============================================================

const EXECUTION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes default

/**
 * Sets up execution monitoring for a confirmed session.
 * Uses JSONL file polling (same pattern as planning chat and Instagram webhook).
 * Polls for the agent's response, handles completion and timeout.
 */
export function startExecutionMonitoring(sessionId: string, executionSessionKey: string, jobId: string, agentId: string, model: string, skipLines = 0): void {
  const sseManager = JarvisSSEManager.getInstance();

  // Push typing indicator
  sseManager.pushEvent(sessionId, { type: 'typing', data: {} });

  const statusCallback: StatusCallback = (phase, detail) => {
    sseManager.pushEvent(sessionId, {
      type: 'agent_status',
      data: { phase, detail: detail || null, context: 'execution', startedAt: Date.now() },
    });
  };

  // Poll for execution response (5 min timeout for execution tasks)
  pollJarvisResponse(executionSessionKey, EXECUTION_TIMEOUT_MS, skipLines, statusCallback).then((result) => {
    try {
      const db = getDb();
      const responseText = result.text;

      if (!responseText) {
        // Timeout — no response received
        handleExecutionTimeout(sessionId, jobId, agentId);
        return;
      }

      console.log('[Jarvis Exec] Response received for session %s (%d chars)', sessionId, responseText.length);

      // Persist as assistant message in the planning session
      const messageId = generateId();
      db.prepare(`INSERT INTO mc_jarvis_messages (id, session_id, role, content) VALUES (?, ?, 'assistant', ?)`).run(
        messageId, sessionId, responseText
      );

      // Push message via SSE
      sseManager.pushEvent(sessionId, {
        type: 'message_complete',
        data: { id: messageId, role: 'assistant', content: responseText },
      });

      // Complete the job
      handleExecutionComplete(sessionId, jobId, agentId, model, responseText);
    } catch (err: any) {
      console.error('[Jarvis Exec] Error handling response:', err.message);
    }
  }).catch((err) => {
    console.error('[Jarvis Exec] Unexpected error:', err);
    handleExecutionTimeout(sessionId, jobId, agentId);
  });
}

function handleExecutionComplete(sessionId: string, jobId: string, agentId: string, model: string, resultText: string): void {
  try {
    const db = getDb();
    const sseManager = JarvisSSEManager.getInstance();

    // Extract confidence from agent response
    const confidenceResult = extractConfidence(resultText);
    const confidence = confidenceResult?.confidence ?? 0.0; // Fail-safe: default to 0.0
    const rubricScores = confidenceResult?.rubricScores ?? null;

    // Update mc_runs with duration, response, and confidence
    const run = db.prepare('SELECT * FROM mc_runs WHERE job_id = ? ORDER BY created_at DESC LIMIT 1').get(jobId) as any;
    if (run) {
      const durationMs = Date.now() - new Date(run.created_at).getTime();
      db.prepare(`UPDATE mc_runs SET status = 'completed', duration_ms = ?, response_text = ?, confidence = ?, rubric_scores = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
        durationMs, resultText, confidence, rubricScores ? JSON.stringify(rubricScores) : null, run.id
      );

      // Record cost in mc_cost_ledger
      db.prepare(`INSERT INTO mc_cost_ledger (run_id, agent_id, model, provider, job_source) VALUES (?, ?, ?, 'openrouter', 'admin')`).run(
        run.id, agentId, model
      );
    }

    // Increment agent total_runs and update last_active_at
    db.prepare(`UPDATE mc_agents SET total_runs = total_runs + 1, last_active_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(agentId);

    // Check approval gate
    const gateResult = checkApprovalGate(jobId, agentId, confidence, rubricScores, 'complete');

    if (gateResult.approved) {
      // Approved — proceed with normal completion
      db.prepare(`UPDATE mc_jobs SET status = 'completed', result = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
        resultText, jobId
      );
      db.prepare(`UPDATE mc_jarvis_sessions SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(sessionId);
      emitEvent('job', jobId, 'status_change', 'Job completed', 'running', 'completed', { agentId, sessionId });
      sseManager.pushEvent(sessionId, {
        type: 'status',
        data: { status: 'completed', jobId },
      });
    } else {
      // Not approved — set to waiting_input, session to awaiting_approval
      db.prepare(`UPDATE mc_jobs SET status = 'waiting_input', result = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
        resultText, jobId
      );
      db.prepare(`UPDATE mc_jarvis_sessions SET status = 'awaiting_approval', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(sessionId);
      emitEvent('job', jobId, 'status_change', 'Job awaiting approval', 'running', 'waiting_input', { agentId, sessionId, approvalId: gateResult.approvalId });
      sseManager.pushEvent(sessionId, {
        type: 'status',
        data: { status: 'awaiting_approval', approvalId: gateResult.approvalId, jobId },
      });
    }
  } catch (err: any) {
    console.error('[Jarvis] Error handling execution complete:', err.message);
  }
}


async function handleExecutionTimeout(sessionId: string, jobId: string, agentId: string): Promise<void> {
  try {
    const db = getDb();
    const sseManager = JarvisSSEManager.getInstance();

    // Try to abort the OpenClaw session
    const session = db.prepare('SELECT execution_session_key FROM mc_jarvis_sessions WHERE id = ?').get(sessionId) as any;
    if (session?.execution_session_key) {
      try {
        const ocClient = await getOpenClawClient();
        if (ocClient) {
          ocClient.call('chat.abort', { sessionKey: session.execution_session_key }).catch(() => {});
        }
      } catch {
        // Best effort
      }
    }

    // Mark job as failed
    db.prepare(`UPDATE mc_jobs SET status = 'failed', error = 'Execution timeout (5 min)', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(jobId);

    // Update run
    const run = db.prepare('SELECT * FROM mc_runs WHERE job_id = ? ORDER BY created_at DESC LIMIT 1').get(jobId) as any;
    if (run) {
      const durationMs = Date.now() - new Date(run.created_at).getTime();
      db.prepare(`UPDATE mc_runs SET status = 'failed', duration_ms = ?, error = 'Timeout', completed_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
        durationMs, run.id
      );
    }

    // Update session
    db.prepare(`UPDATE mc_jarvis_sessions SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(sessionId);

    // Emit events
    emitEvent('job', jobId, 'status_change', 'Job failed: execution timeout', 'running', 'failed', { agentId, sessionId, reason: 'timeout' });

    // Push SSE error
    sseManager.pushEvent(sessionId, {
      type: 'error',
      data: { error: 'Görev zaman aşımına uğradı (5 dakika)', status: 'failed' },
    });
  } catch (err: any) {
    console.error('[Jarvis] Error handling execution timeout:', err.message);
  }
}


// ============================================================
// DATA BRIDGE — Pre-fetch business data for agent tasks
// ============================================================

/**
 * POST /dm-review — One-click DM quality review
 * 
 * This is the "data bridge" that solves the blind agent problem:
 * 1. Fetches all Instagram DM data from the local DB
 * 2. Creates a Jarvis session
 * 3. Sends the data-enriched task to Jarvis via OpenClaw
 * 4. Jarvis spawns the instagram sub-agent with ALL data pre-loaded
 * 
 * The sub-agent never needs to call any API — everything is in the prompt.
 */
router.post('/dm-review', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const daysBack = Number(req.body.daysBack) || 30;

    // 1. Fetch all DM data via DataBridgeService
    const bridge = new DataBridgeService(db);
    const data = bridge.fetchDMReviewData(daysBack);
    const dataPrompt = bridge.formatDMReviewPrompt(data);

    if (data.conversations.length === 0) {
      res.status(400).json({ error: 'Analiz edilecek konuşma bulunamadı.' });
      return;
    }

    // 2. Create a Jarvis session
    const sessionId = generateId();
    let openclawSessionKey: string | null = null;
    try {
      const ocClient = await getOpenClawClient();
      if (ocClient) {
        const sessionInfo = await ocClient.createSession('jarvis', `jarvis:${sessionId}`);
        openclawSessionKey = sessionInfo.id;
      }
    } catch (err: any) {
      console.warn('[Jarvis DM Review] OpenClaw session creation failed:', err.message);
    }

    db.prepare(`INSERT INTO mc_jarvis_sessions (id, status, title, openclaw_session_key) VALUES (?, 'planning', ?, ?)`).run(
      sessionId, 'DM Kalite Analizi', openclawSessionKey
    );

    // 3. Build the enriched task message for Jarvis
    const taskMessage = [
      'Instagram DM yanıtlarımızın kalitesini analiz etmeni istiyorum.',
      'Bu görevi instagram alt-ajanına (sub-agent) delege et.',
      '',
      'ÖNEMLI: Aşağıdaki veri paketi KIO veritabanından doğrudan çekilmiştir.',
      'Alt-ajana bu veriyi AYNEN ilet. Alt-ajanın API çağrısı yapmasına GEREK YOK.',
      '',
      'Alt-ajandan istenen analiz:',
      '1. Her konuşmayı 3 kritere göre değerlendir (1-10):',
      '   - Doğruluk: Yanıtlar bilgi bankasındaki gerçek verilerle uyumlu mu?',
      '   - Ton: Profesyonel, sıcak, Eform marka sesine uygun mu?',
      '   - Yardımseverlik: Müşterinin sorusuna tam cevap verilmiş mi?',
      '2. En iyi ve en kötü yanıt örneklerini göster',
      '3. İyileştirme alanlarını belirle',
      '4. Müşteri soru kalıpları vs yanıt kalitesi arasındaki boşlukları analiz et',
      '',
      'Alt-ajanın raporunu aldıktan sonra SEN (Jarvis) bulguları değerlendir ve',
      'DM yanıt kalitemizi artırmak için somut iyileştirme önerileri sun.',
      '',
      '---',
      '',
      dataPrompt,
    ].join('\n');

    // 4. Persist user message
    const userMsgId = generateId();
    db.prepare(`INSERT INTO mc_jarvis_messages (id, session_id, role, content) VALUES (?, ?, 'user', ?)`).run(
      userMsgId, sessionId, `DM Kalite Analizi başlatıldı (son ${daysBack} gün, ${data.conversations.length} konuşma, ${data.stats.totalMessages} mesaj)`
    );

    // 5. Send to OpenClaw (Jarvis will receive this and spawn instagram sub-agent)
    if (openclawSessionKey) {
      try {
        const ocClient = await getOpenClawClient();
        if (ocClient) {
          const fullMessage = `${PLANNING_SYSTEM_PROMPT}\n\n---\n\n${taskMessage}`;

          // Snapshot JSONL line count before sending (new session, should be 0)
          const linesBefore = getSessionLineCount(openclawSessionKey);

          await ocClient.sendMessage(openclawSessionKey, fullMessage);

          // Start background polling for the response (longer timeout for DM review)
          startResponsePolling(sessionId, openclawSessionKey, 90000, linesBefore);
        }
      } catch (err: any) {
        console.warn('[Jarvis DM Review] Failed to send to OpenClaw:', err.message);
      }
    }

    // 6. Update session
    db.prepare(`UPDATE mc_jarvis_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(sessionId);

    // Emit event
    emitEvent('job', sessionId, 'dm_review_started', `DM quality review started (${data.conversations.length} conversations, ${daysBack} days)`, undefined, undefined, {
      conversationCount: data.conversations.length,
      totalMessages: data.stats.totalMessages,
      daysBack,
    });

    res.status(201).json({
      sessionId,
      title: 'DM Kalite Analizi',
      stats: data.stats,
      conversationCount: data.conversations.length,
      message: `${data.conversations.length} konuşma ve ${data.stats.totalMessages} mesaj ile analiz başlatıldı.`,
    });
  } catch (err: any) {
    console.error('[Jarvis DM Review] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /data-bridge/instagram — Fetch packaged Instagram data
 * Useful for the frontend to preview what data will be sent to agents,
 * or for manual inspection of the data bridge output.
 */
router.get('/data-bridge/instagram', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const bridge = new DataBridgeService(db);
    const data = bridge.fetchDMReviewData(30);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
