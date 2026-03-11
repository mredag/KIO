import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export type DmReviewStatus = 'queued' | 'running' | 'completed' | 'failed';
export type DmReviewFindingStatus = 'strong' | 'mixed' | 'weak' | 'critical';

export interface DmReviewConfig {
  daysBack: number;
  channel: 'instagram' | 'whatsapp' | 'both';
  threadGapMinutes: number;
  includeTestTraffic: boolean;
  minMessagesPerThread: number;
  maxThreadsPerRun: number;
  maxMessagesPerThread: number;
  model: string;
  maxTokens: number;
  temperature: number;
  concurrency: number;
  threadReviewPromptTemplate: string;
  runSummaryPromptTemplate: string;
}

export interface DmReviewRunInput extends Partial<DmReviewConfig> {
  targetCustomerId?: string | null;
}

export interface DmReviewPromptPreview {
  config: DmReviewConfig;
  targetCustomerId: string | null;
  threadReviewPrompt: string;
  runSummaryPrompt: string;
  sample: {
    mode: 'sample' | 'thread';
    channel: 'instagram' | 'whatsapp' | 'both';
    customerId: string | null;
    threadKey: string | null;
    note: string;
  };
  variables: {
    threadReview: string[];
    runSummary: string[];
  };
  defaults: {
    threadReviewPromptTemplate: string;
    runSummaryPromptTemplate: string;
  };
}

export interface DmReviewRun {
  id: string;
  status: DmReviewStatus;
  channel: string;
  daysBack: number;
  model: string;
  totalThreads: number;
  reviewedThreads: number;
  totalCustomers: number;
  totalMessages: number;
  totalTokens: number;
  totalCostUsd: number;
  progressMessage: string | null;
  error: string | null;
  summary: Record<string, any> | null;
  settings: Record<string, any> | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DmReviewFinding {
  id: string;
  runId: string;
  channel: 'instagram' | 'whatsapp';
  customerId: string;
  customerName: string | null;
  conversationId: string | null;
  threadKey: string;
  startedAt: string;
  endedAt: string;
  messageCount: number;
  overallScore: number;
  overallStatus: DmReviewFindingStatus;
  primaryNeed: string;
  flags: string[];
  transcript: {
    messages: Array<{
      id: string;
      direction: 'inbound' | 'outbound';
      text: string;
      createdAt: string;
      modelUsed?: string | null;
      responseTimeMs?: number | null;
      intent?: string | null;
    }>;
  };
  deterministicMetrics: Record<string, any>;
  groundingSummary: Record<string, any>;
  review: Record<string, any>;
  createdAt: string;
}

export function useDmReviewConfig() {
  return useQuery({
    queryKey: ['dm-review-config'],
    queryFn: async () => {
      const { data } = await api.get('/mc/dm-review/config');
      return data as DmReviewConfig;
    },
  });
}

export function useUpdateDmReviewConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<DmReviewConfig>) => {
      const { data } = await api.patch('/mc/dm-review/config', body);
      return data as { ok: boolean; config: DmReviewConfig };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dm-review-config'] });
    },
  });
}

export function useDmReviewRuns(limit = 20) {
  return useQuery({
    queryKey: ['dm-review-runs', limit],
    queryFn: async () => {
      const { data } = await api.get(`/mc/dm-review/runs?limit=${limit}`);
      return data as { runs: DmReviewRun[] };
    },
    refetchInterval: 10000,
  });
}

export function useDmReviewRun(runId: string | null, refetchInterval = 0) {
  return useQuery({
    queryKey: ['dm-review-run', runId],
    queryFn: async () => {
      const { data } = await api.get(`/mc/dm-review/runs/${runId}`);
      return data as DmReviewRun;
    },
    enabled: !!runId,
    refetchInterval: refetchInterval || false,
  });
}

export function useStartDmReviewRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: DmReviewRunInput) => {
      const { data } = await api.post('/mc/dm-review/runs', body);
      return data as { ok: boolean; runId: string; run: DmReviewRun };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dm-review-runs'] });
    },
  });
}

export function useDmReviewPromptPreview() {
  return useMutation({
    mutationFn: async (body: DmReviewRunInput) => {
      const { data } = await api.post('/mc/dm-review/prompt-preview', body);
      return data as { ok: boolean; preview: DmReviewPromptPreview };
    },
  });
}

export function useDmReviewFindings(
  runId: string | null,
  filters?: {
    status?: string;
    customerId?: string;
    flag?: string;
    unresolvedOnly?: boolean;
    hallucinationOnly?: boolean;
    repetitiveOnly?: boolean;
    limit?: number;
  },
  refetchInterval = 0,
) {
  return useQuery({
    queryKey: ['dm-review-findings', runId, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.customerId) params.set('customerId', filters.customerId);
      if (filters?.flag) params.set('flag', filters.flag);
      if (filters?.unresolvedOnly) params.set('unresolvedOnly', 'true');
      if (filters?.hallucinationOnly) params.set('hallucinationOnly', 'true');
      if (filters?.repetitiveOnly) params.set('repetitiveOnly', 'true');
      if (typeof filters?.limit === 'number') params.set('limit', String(filters.limit));
      const query = params.toString();
      const { data } = await api.get(`/mc/dm-review/runs/${runId}/findings${query ? `?${query}` : ''}`);
      return data as { findings: DmReviewFinding[] };
    },
    enabled: !!runId,
    refetchInterval: refetchInterval || false,
  });
}

export function useDmReviewFinding(runId: string | null, findingId: string | null) {
  return useQuery({
    queryKey: ['dm-review-finding', runId, findingId],
    queryFn: async () => {
      const { data } = await api.get(`/mc/dm-review/runs/${runId}/findings/${findingId}`);
      return data as DmReviewFinding;
    },
    enabled: !!runId && !!findingId,
  });
}

export function useCreateDmReviewJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { findingId: string; priority?: string; agentId?: string }) => {
      const { data } = await api.post(`/mc/dm-review/findings/${input.findingId}/jobs`, {
        priority: input.priority,
        agentId: input.agentId,
      });
      return data as { ok: boolean; job: { id: string; title: string; status: string } };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mc-workshop'] });
    },
  });
}

export function useLaunchDmReviewJarvis() {
  return useMutation({
    mutationFn: async (runId: string) => {
      const { data } = await api.post('/mc/jarvis/dm-review', { runId });
      return data as {
        sessionId: string;
        runId?: string;
        conversationCount?: number;
        message?: string;
      };
    },
  });
}
