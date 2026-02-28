import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

// ============================================================
// DM KONTROL MERKEZİ — Live Feed
// ============================================================

// GET /api/mc/dm-kontrol/feed?limit=50&offset=0
export function useDmFeed(limit: number = 50) {
  return useQuery({
    queryKey: ['dm-feed', limit],
    queryFn: async () => {
      const { data } = await api.get(`/mc/dm-kontrol/feed?limit=${limit}`);
      return data;
    },
    refetchInterval: 10000,
  });
}

// ============================================================
// DM KONTROL MERKEZİ — Conversation Thread
// ============================================================

// GET /api/mc/dm-kontrol/conversations/:instagramId
export function useDmConversation(instagramId: string | null) {
  return useQuery({
    queryKey: ['dm-conversation', instagramId],
    queryFn: async () => {
      const { data } = await api.get(`/mc/dm-kontrol/conversations/${instagramId}`);
      return data;
    },
    enabled: !!instagramId,
  });
}

// ============================================================
// DM KONTROL MERKEZİ — Pipeline Health
// ============================================================

// GET /api/mc/dm-kontrol/health?period=today
export function useDmHealth(period: string = 'today') {
  return useQuery({
    queryKey: ['dm-health', period],
    queryFn: async () => {
      const { data } = await api.get(`/mc/dm-kontrol/health?period=${period}`);
      return data;
    },
    refetchInterval: 15000,
  });
}

// ============================================================
// DM KONTROL MERKEZİ — Pipeline Errors
// ============================================================

// GET /api/mc/dm-kontrol/errors?stage=&startDate=&endDate=
export function useDmErrors(filters?: { stage?: string; startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ['dm-errors', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.stage) params.set('stage', filters.stage);
      if (filters?.startDate) params.set('startDate', filters.startDate);
      if (filters?.endDate) params.set('endDate', filters.endDate);
      const { data } = await api.get(`/mc/dm-kontrol/errors?${params.toString()}`);
      return data;
    },
    refetchInterval: 15000,
  });
}

// ============================================================
// DM KONTROL MERKEZİ — Model Routing Stats
// ============================================================

// GET /api/mc/dm-kontrol/model-stats?period=today
export function useDmModelStats(period: string = 'today') {
  return useQuery({
    queryKey: ['dm-model-stats', period],
    queryFn: async () => {
      const { data } = await api.get(`/mc/dm-kontrol/model-stats?period=${period}`);
      return data;
    },
    refetchInterval: 15000,
  });
}

// ============================================================
// DM KONTROL MERKEZİ — Test Mode
// ============================================================

// GET /api/mc/dm-kontrol/test-mode
export function useDmTestMode() {
  return useQuery({
    queryKey: ['dm-test-mode'],
    queryFn: async () => {
      const { data } = await api.get('/mc/dm-kontrol/test-mode');
      return data as { enabled: boolean; senderIds: string[] };
    },
  });
}

// PATCH /api/mc/dm-kontrol/test-mode
export function useToggleDmTestMode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { enabled?: boolean; senderIds?: string[] }) => {
      const { data } = await api.patch('/mc/dm-kontrol/test-mode', body);
      return data as { enabled: boolean; senderIds: string[] };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dm-test-mode'] }),
  });
}

// ============================================================
// DM KONTROL MERKEZİ — Pipeline Config (Dynamic Optimization)
// ============================================================

// GET /api/mc/dm-kontrol/pipeline-config
export function usePipelineConfig() {
  return useQuery({
    queryKey: ['pipeline-config'],
    queryFn: async () => {
      const { data } = await api.get('/mc/dm-kontrol/pipeline-config');
      return data;
    },
  });
}

// PATCH /api/mc/dm-kontrol/pipeline-config
export function useUpdatePipelineConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await api.patch('/mc/dm-kontrol/pipeline-config', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pipeline-config'] }),
  });
}

// POST /api/mc/dm-kontrol/pipeline-config/reset
export function useResetPipelineConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/mc/dm-kontrol/pipeline-config/reset');
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pipeline-config'] }),
  });
}

// ============================================================
// DM KONTROL MERKEZİ — Preview Routing (no API calls, just analysis)
// ============================================================

// POST /api/mc/dm-kontrol/preview-routing
export function usePreviewRouting() {
  return useMutation({
    mutationFn: async (body: { message: string; senderId?: string }) => {
      const { data } = await api.post('/mc/dm-kontrol/preview-routing', body);
      return data;
    },
  });
}
