import Database from 'better-sqlite3';

export interface ConversationStateRecord {
  channel: string;
  customerId: string;
  activeTopic: string;
  activeTopicConfidence: number;
  topicSourceMessage: string | null;
  lastQuestionType: string;
  pendingCategories: string[];
  lastCustomerMessage: string;
  lastAssistantMessage: string | null;
  turnCount: number;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaveConversationStateParams {
  channel: string;
  customerId: string;
  activeTopic: string | null;
  activeTopicConfidence: number;
  topicSourceMessage?: string | null;
  lastQuestionType: string;
  pendingCategories: string[];
  lastCustomerMessage: string;
  lastAssistantMessage?: string | null;
  ttlMinutes?: number;
}

export class ConversationStateService {
  constructor(private db: Database.Database) {}

  getState(channel: string, customerId: string): ConversationStateRecord | null {
    try {
      const row = this.db.prepare(`
        SELECT
          channel,
          customer_id,
          active_topic,
          active_topic_confidence,
          topic_source_message,
          last_question_type,
          pending_categories,
          last_customer_message,
          last_assistant_message,
          turn_count,
          expires_at,
          created_at,
          updated_at
        FROM dm_conversation_state
        WHERE channel = ? AND customer_id = ?
      `).get(channel, customerId) as {
        channel: string;
        customer_id: string;
        active_topic: string;
        active_topic_confidence: number;
        topic_source_message: string | null;
        last_question_type: string;
        pending_categories: string;
        last_customer_message: string;
        last_assistant_message: string | null;
        turn_count: number;
        expires_at: string;
        created_at: string;
        updated_at: string;
      } | undefined;

      if (!row) {
        return null;
      }

      const expiresAtMs = new Date(row.expires_at).getTime();
      if (Number.isNaN(expiresAtMs) || expiresAtMs <= Date.now()) {
        this.clearState(channel, customerId);
        return null;
      }

      return {
        channel: row.channel,
        customerId: row.customer_id,
        activeTopic: row.active_topic,
        activeTopicConfidence: Number(row.active_topic_confidence) || 0,
        topicSourceMessage: row.topic_source_message,
        lastQuestionType: row.last_question_type || 'general',
        pendingCategories: this.parsePendingCategories(row.pending_categories),
        lastCustomerMessage: row.last_customer_message,
        lastAssistantMessage: row.last_assistant_message,
        turnCount: Number(row.turn_count) || 0,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch {
      return null;
    }
  }

  saveState(params: SaveConversationStateParams): void {
    if (!params.activeTopic) {
      this.clearState(params.channel, params.customerId);
      return;
    }

    const now = new Date();
    const ttlMinutes = Math.max(1, params.ttlMinutes ?? 15);
    const expiresAt = new Date(now.getTime() + (ttlMinutes * 60 * 1000)).toISOString();
    const currentState = this.getState(params.channel, params.customerId);
    const turnCount = (currentState?.turnCount || 0) + 1;
    const nowIso = now.toISOString();

    this.db.prepare(`
      INSERT INTO dm_conversation_state (
        channel,
        customer_id,
        active_topic,
        active_topic_confidence,
        topic_source_message,
        last_question_type,
        pending_categories,
        last_customer_message,
        last_assistant_message,
        turn_count,
        expires_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(channel, customer_id) DO UPDATE SET
        active_topic = excluded.active_topic,
        active_topic_confidence = excluded.active_topic_confidence,
        topic_source_message = excluded.topic_source_message,
        last_question_type = excluded.last_question_type,
        pending_categories = excluded.pending_categories,
        last_customer_message = excluded.last_customer_message,
        last_assistant_message = excluded.last_assistant_message,
        turn_count = excluded.turn_count,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at
    `).run(
      params.channel,
      params.customerId,
      params.activeTopic,
      params.activeTopicConfidence,
      params.topicSourceMessage || null,
      params.lastQuestionType || 'general',
      JSON.stringify(params.pendingCategories || []),
      params.lastCustomerMessage,
      params.lastAssistantMessage || null,
      turnCount,
      expiresAt,
      currentState?.createdAt || nowIso,
      nowIso,
    );
  }

  clearState(channel: string, customerId: string): void {
    try {
      this.db.prepare(`
        DELETE FROM dm_conversation_state
        WHERE channel = ? AND customer_id = ?
      `).run(channel, customerId);
    } catch {
      // Ignore cleanup errors on partial installs or during fallback tests.
    }
  }

  private parsePendingCategories(rawValue: string): string[] {
    try {
      const parsed = JSON.parse(rawValue);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .map(item => String(item).trim().toLowerCase())
        .filter(Boolean);
    } catch {
      return [];
    }
  }
}
