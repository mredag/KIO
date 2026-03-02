import { describe, expect, it } from 'vitest';
import { ConversationStateService } from './ConversationStateService.js';

interface StateRow {
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
}

function createDb() {
  const rows = new Map<string, StateRow>();

  return {
    prepare(sql: string) {
      if (sql.includes('DELETE FROM dm_conversation_state')) {
        return {
          run(channel: string, customerId: string) {
            rows.delete(`${channel}:${customerId}`);
          },
        };
      }

      if (sql.includes('FROM dm_conversation_state')) {
        return {
          get(channel: string, customerId: string) {
            return rows.get(`${channel}:${customerId}`);
          },
        };
      }

      if (sql.includes('INSERT INTO dm_conversation_state')) {
        return {
          run(
            channel: string,
            customerId: string,
            activeTopic: string,
            activeTopicConfidence: number,
            topicSourceMessage: string | null,
            lastQuestionType: string,
            pendingCategories: string,
            lastCustomerMessage: string,
            lastAssistantMessage: string | null,
            turnCount: number,
            expiresAt: string,
            createdAt: string,
            updatedAt: string,
          ) {
            rows.set(`${channel}:${customerId}`, {
              channel,
              customer_id: customerId,
              active_topic: activeTopic,
              active_topic_confidence: activeTopicConfidence,
              topic_source_message: topicSourceMessage,
              last_question_type: lastQuestionType,
              pending_categories: pendingCategories,
              last_customer_message: lastCustomerMessage,
              last_assistant_message: lastAssistantMessage,
              turn_count: turnCount,
              expires_at: expiresAt,
              created_at: createdAt,
              updated_at: updatedAt,
            });
          },
        };
      }

      throw new Error(`Unexpected SQL in test: ${sql}`);
    },
  } as any;
}

describe('ConversationStateService', () => {
  it('saves and reloads active topic state', () => {
    const service = new ConversationStateService(createDb());

    service.saveState({
      channel: 'instagram',
      customerId: 'ig-user',
      activeTopic: 'reformer pilates',
      activeTopicConfidence: 0.9,
      topicSourceMessage: 'pilates var mi',
      lastQuestionType: 'service_topic',
      pendingCategories: ['services', 'pricing'],
      lastCustomerMessage: 'pilates var mi',
      lastAssistantMessage: 'Evet, mevcut.',
      ttlMinutes: 15,
    });

    const state = service.getState('instagram', 'ig-user');

    expect(state).not.toBeNull();
    expect(state?.activeTopic).toBe('reformer pilates');
    expect(state?.pendingCategories).toEqual(['services', 'pricing']);
    expect(state?.turnCount).toBe(1);
  });

  it('clears state when asked to save a null topic', () => {
    const service = new ConversationStateService(createDb());

    service.saveState({
      channel: 'instagram',
      customerId: 'ig-user',
      activeTopic: 'masaj hizmeti',
      activeTopicConfidence: 0.8,
      topicSourceMessage: 'masaj var mi',
      lastQuestionType: 'service_topic',
      pendingCategories: ['services'],
      lastCustomerMessage: 'masaj var mi',
      lastAssistantMessage: 'Evet.',
      ttlMinutes: 10,
    });

    service.saveState({
      channel: 'instagram',
      customerId: 'ig-user',
      activeTopic: null,
      activeTopicConfidence: 0,
      lastQuestionType: 'general',
      pendingCategories: [],
      lastCustomerMessage: 'tesekkur',
      lastAssistantMessage: 'Rica ederim.',
      ttlMinutes: 5,
    });

    expect(service.getState('instagram', 'ig-user')).toBeNull();
  });
});
