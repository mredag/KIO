import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

// ============================================================
// Types
// ============================================================
export interface JarvisSession {
  id: string;
  status: 'planning' | 'awaiting_confirmation' | 'confirmed' | 'running' | 'completed' | 'failed';
  title: string;
  summary?: string;
  agent_id?: string;
  job_id?: string;
  openclaw_session_key?: string;
  execution_session_key?: string;
  created_at: string;
  updated_at: string;
  agent?: any;
  job?: any;
}

export interface JarvisMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: string;
  created_at: string;
}

// ============================================================
// SESSIONS
// ============================================================
export function useJarvisSessions() {
  return useQuery<JarvisSession[]>({
    queryKey: ['jarvis', 'sessions'],
    queryFn: async () => {
      const { data } = await api.get('/mc/jarvis/sessions');
      return data;
    },
    refetchInterval: 10000,
  });
}

export function useJarvisSession(id: string | undefined) {
  return useQuery<JarvisSession>({
    queryKey: ['jarvis', 'sessions', id],
    queryFn: async () => {
      const { data } = await api.get(`/mc/jarvis/sessions/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ============================================================
// MESSAGES
// ============================================================
export function useJarvisMessages(sessionId: string | undefined) {
  return useQuery<JarvisMessage[]>({
    queryKey: ['jarvis', 'messages', sessionId],
    queryFn: async () => {
      const { data } = await api.get(`/mc/jarvis/sessions/${sessionId}/messages`);
      return data;
    },
    enabled: !!sessionId,
  });
}

// ============================================================
// MUTATIONS
// ============================================================
export function useCreateJarvisSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (title?: string) => {
      const { data } = await api.post('/mc/jarvis/sessions', { title });
      return data as JarvisSession;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jarvis', 'sessions'] }),
  });
}

export function useSendJarvisMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, content }: { sessionId: string; content: string }) => {
      const { data } = await api.post(`/mc/jarvis/sessions/${sessionId}/messages`, { content });
      return data as JarvisMessage;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['jarvis', 'messages', variables.sessionId] });
      qc.invalidateQueries({ queryKey: ['jarvis', 'sessions'] });
    },
  });
}

export function useConfirmJarvisSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data } = await api.post(`/mc/jarvis/sessions/${sessionId}/confirm`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jarvis'] });
    },
  });
}


// ============================================================
// DM REVIEW — Data Bridge Quick Action
// ============================================================
export interface DMReviewResult {
  sessionId: string;
  title: string;
  stats: {
    totalMessages: number;
    responsesGenerated: number;
    uniqueSenders: number;
    avgResponseTimeMs: number;
    totalTokens: number;
  };
  conversationCount: number;
  message: string;
}

export function useStartDMReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (daysBack?: number) => {
      const { data } = await api.post('/mc/jarvis/dm-review', { daysBack: daysBack || 30 });
      return data as DMReviewResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jarvis', 'sessions'] });
    },
  });
}
