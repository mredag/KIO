/**
 * DataBridgeService — Pre-fetches business data from the local DB
 * and packages it into structured context for OpenClaw agents.
 *
 * This solves the "blind agent" problem: OpenClaw agents can't access
 * localhost APIs (web_fetch blocked, exec NonInteractive), so we
 * pre-fetch the data and inject it into the spawn message.
 */
import Database from 'better-sqlite3';

export interface DMReviewContext {
  stats: {
    totalMessages: number;
    responsesGenerated: number;
    uniqueSenders: number;
    avgResponseTimeMs: number;
    totalTokens: number;
  };
  modelDistribution: { model: string; count: number }[];
  intentBreakdown: { intent: string; count: number }[];
  conversations: {
    customerId: string;
    name: string | null;
    messageCount: number;
    lastMessageAt: string;
    messages: {
      direction: string;
      text: string;
      intent: string | null;
      aiResponse: string | null;
      responseTimeMs: number | null;
      model: string | null;
      createdAt: string;
    }[];
  }[];
  knowledgeBase: { category: string; key: string; value: string }[];
}

export class DataBridgeService {
  constructor(private db: Database.Database) {}

  /**
   * Fetch comprehensive Instagram DM data for quality review.
   * Returns structured data that can be serialized into an agent prompt.
   */
  fetchDMReviewData(daysBack: number = 30, maxConversations: number = 20): DMReviewContext {
    const cutoff = new Date(Date.now() - daysBack * 86400000).toISOString();

    // Stats
    const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN direction = 'outbound' THEN 1 END) as responses,
        COUNT(DISTINCT instagram_id) as senders,
        AVG(CASE WHEN response_time_ms > 0 THEN response_time_ms END) as avg_rt,
        SUM(COALESCE(tokens_estimated, 0)) as tokens
      FROM instagram_interactions WHERE created_at >= ?
    `).get(cutoff) as any;

    // Model distribution
    const models = this.db.prepare(`
      SELECT model_used, COUNT(*) as count
      FROM instagram_interactions
      WHERE created_at >= ? AND model_used IS NOT NULL
      GROUP BY model_used ORDER BY count DESC
    `).all(cutoff) as any[];

    // Intent breakdown
    const intents = this.db.prepare(`
      SELECT intent, COUNT(*) as count
      FROM instagram_interactions
      WHERE created_at >= ? AND intent IS NOT NULL AND direction = 'inbound'
      GROUP BY intent ORDER BY count DESC LIMIT 15
    `).all(cutoff) as any[];

    // Recent conversations with messages
    const convos = this.db.prepare(`
      SELECT i.instagram_id, c.name, COUNT(*) as msg_count, MAX(i.created_at) as last_at
      FROM instagram_interactions i
      LEFT JOIN instagram_customers c ON i.instagram_id = c.instagram_id
      WHERE i.created_at >= ?
      GROUP BY i.instagram_id
      ORDER BY last_at DESC LIMIT ?
    `).all(cutoff, maxConversations) as any[];

    const conversations = convos.map((c: any) => {
      const msgs = this.db.prepare(`
        SELECT direction, message_text, intent, ai_response, response_time_ms, model_used, created_at
        FROM instagram_interactions
        WHERE instagram_id = ? AND created_at >= ?
        ORDER BY created_at ASC LIMIT 30
      `).all(c.instagram_id, cutoff) as any[];

      return {
        customerId: c.instagram_id,
        name: c.name,
        messageCount: c.msg_count,
        lastMessageAt: c.last_at,
        messages: msgs.map((m: any) => ({
          direction: m.direction,
          text: m.message_text,
          intent: m.intent,
          aiResponse: m.ai_response,
          responseTimeMs: m.response_time_ms,
          model: m.model_used,
          createdAt: m.created_at,
        })),
      };
    });

    // Knowledge base (for accuracy validation)
    const kb = this.db.prepare(`
      SELECT category, key_name, value FROM knowledge_base WHERE is_active = 1 ORDER BY category, key_name
    `).all() as any[];

    return {
      stats: {
        totalMessages: stats?.total || 0,
        responsesGenerated: stats?.responses || 0,
        uniqueSenders: stats?.senders || 0,
        avgResponseTimeMs: Math.round(stats?.avg_rt || 0),
        totalTokens: stats?.tokens || 0,
      },
      modelDistribution: models.map((m: any) => ({ model: m.model_used, count: m.count })),
      intentBreakdown: intents.map((i: any) => ({ intent: i.intent, count: i.count })),
      conversations,
      knowledgeBase: kb.map((k: any) => ({ category: k.category, key: k.key_name, value: k.value })),
    };
  }

  /**
   * Format DM review data into a structured prompt for the agent.
   * The agent receives ALL the data it needs — no API calls required.
   */
  formatDMReviewPrompt(data: DMReviewContext): string {
    const parts: string[] = [];

    parts.push('# Instagram DM Kalite Analizi — Veri Paketi');
    parts.push('');
    parts.push('Bu veri paketi KIO veritabanından doğrudan çekilmiştir. API çağrısı yapmanıza GEREK YOK.');
    parts.push('Tüm veriler aşağıda hazır. Sadece analiz yapın ve rapor oluşturun.');
    parts.push('');

    // Stats
    parts.push('## İstatistikler');
    parts.push(`- Toplam mesaj: ${data.stats.totalMessages}`);
    parts.push(`- Oluşturulan yanıt: ${data.stats.responsesGenerated}`);
    parts.push(`- Benzersiz gönderici: ${data.stats.uniqueSenders}`);
    parts.push(`- Ortalama yanıt süresi: ${data.stats.avgResponseTimeMs}ms`);
    parts.push(`- Toplam token: ${data.stats.totalTokens}`);
    parts.push('');

    // Model distribution
    if (data.modelDistribution.length > 0) {
      parts.push('## Model Dağılımı');
      data.modelDistribution.forEach(m => parts.push(`- ${m.model}: ${m.count} kullanım`));
      parts.push('');
    }

    // Intent breakdown
    if (data.intentBreakdown.length > 0) {
      parts.push('## Niyet (Intent) Dağılımı');
      data.intentBreakdown.forEach(i => parts.push(`- ${i.intent}: ${i.count}`));
      parts.push('');
    }

    // Conversations
    parts.push(`## Konuşmalar (${data.conversations.length} müşteri)`);
    data.conversations.forEach((conv, idx) => {
      parts.push(`### Konuşma ${idx + 1}: ${conv.name || conv.customerId} (${conv.messageCount} mesaj)`);
      conv.messages.forEach(msg => {
        const label = msg.direction === 'inbound' ? '👤 Müşteri' : '🤖 Asistan';
        const model = msg.model ? ` [${msg.model}]` : '';
        const rt = msg.responseTimeMs ? ` (${msg.responseTimeMs}ms)` : '';
        parts.push(`  ${label}${model}${rt}: ${msg.text || msg.aiResponse || '(boş)'}`);
      });
      parts.push('');
    });

    // Knowledge base (compact)
    parts.push('## Bilgi Bankası (Doğruluk Kontrolü İçin)');
    const grouped: Record<string, string[]> = {};
    data.knowledgeBase.forEach(k => {
      if (!grouped[k.category]) grouped[k.category] = [];
      grouped[k.category].push(`${k.key}: ${k.value}`);
    });
    Object.entries(grouped).forEach(([cat, entries]) => {
      parts.push(`### ${cat}`);
      entries.forEach(e => parts.push(`- ${e}`));
    });

    return parts.join('\n');
  }
}
