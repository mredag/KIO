import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

// ============================================================
// DASHBOARD
// ============================================================
export function useMCDashboard() {
  return useQuery({
    queryKey: ['mc', 'dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/mc/dashboard');
      return data;
    },
    refetchInterval: 10000,
  });
}

// ============================================================
// AGENTS
// ============================================================
export function useMCAgents() {
  return useQuery({
    queryKey: ['mc', 'agents'],
    queryFn: async () => {
      const { data } = await api.get('/mc/agents');
      return data;
    },
  });
}

export function useMCAgent(id: string | undefined) {
  return useQuery({
    queryKey: ['mc', 'agents', id],
    queryFn: async () => {
      const { data } = await api.get(`/mc/agents/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateMCAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (agent: any) => {
      const { data } = await api.post('/mc/agents', agent);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mc', 'agents'] }),
  });
}

export function useUpdateMCAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { data } = await api.patch(`/mc/agents/${id}`, updates);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mc', 'agents'] }),
  });
}

export function useDeleteMCAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/mc/agents/${id}`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mc', 'agents'] }),
  });
}

export function useSyncMCAgents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/mc/agents/sync');
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mc', 'agents'] }),
  });
}

// ============================================================
// JOBS (Workshop)
// ============================================================
export function useMCJobs(filters?: { status?: string; source?: string; agent_id?: string }) {
  return useQuery({
    queryKey: ['mc', 'jobs', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.source) params.set('source', filters.source);
      if (filters?.agent_id) params.set('agent_id', filters.agent_id);
      const { data } = await api.get(`/mc/jobs?${params.toString()}`);
      return data;
    },
    refetchInterval: 5000,
  });
}

export function useCreateMCJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (job: any) => {
      const { data } = await api.post('/mc/jobs', job);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mc'] }),
  });
}

export function useUpdateMCJobStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, error }: { id: string; status: string; error?: string }) => {
      const { data } = await api.patch(`/mc/jobs/${id}/status`, { status, error });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mc'] }),
  });
}

// ============================================================
// CONVERSATIONS
// ============================================================
export function useMCConversations(filters?: { channel?: string; status?: string }) {
  return useQuery({
    queryKey: ['mc', 'conversations', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.channel) params.set('channel', filters.channel);
      if (filters?.status) params.set('status', filters.status);
      const { data } = await api.get(`/mc/conversations?${params.toString()}`);
      return data;
    },
    refetchInterval: 10000,
  });
}

export function useUpdateMCConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { data } = await api.patch(`/mc/conversations/${id}`, updates);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mc', 'conversations'] }),
  });
}

// ============================================================
// EVENTS
// ============================================================
export function useMCEvents(filters?: { entity_type?: string; entity_id?: string; limit?: number }) {
  return useQuery({
    queryKey: ['mc', 'events', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.entity_type) params.set('entity_type', filters.entity_type);
      if (filters?.entity_id) params.set('entity_id', filters.entity_id);
      if (filters?.limit) params.set('limit', String(filters.limit));
      const { data } = await api.get(`/mc/events?${params.toString()}`);
      return data;
    },
    refetchInterval: 10000,
  });
}

// ============================================================
// COSTS
// ============================================================
export function useMCCosts(filters?: { period?: string; agent_id?: string }) {
  return useQuery({
    queryKey: ['mc', 'costs', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.period) params.set('period', filters.period);
      if (filters?.agent_id) params.set('agent_id', filters.agent_id);
      const { data } = await api.get(`/mc/costs?${params.toString()}`);
      return data;
    },
  });
}

// ============================================================
// DOCUMENTS
// ============================================================
export function useMCDocuments() {
  return useQuery({
    queryKey: ['mc', 'documents'],
    queryFn: async () => {
      const { data } = await api.get('/mc/documents');
      return data;
    },
  });
}

export function useIngestMCDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: { title: string; content: string; content_type?: string; tags?: string[] }) => {
      const { data } = await api.post('/mc/documents/ingest', doc);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mc', 'documents'] }),
  });
}

export function useQueryMCDocuments() {
  return useMutation({
    mutationFn: async (params: { query: string; max_documents?: number; max_tokens?: number }) => {
      const { data } = await api.post('/mc/documents/query', params);
      return data;
    },
  });
}

export function useSyncKnowledgeBase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/mc/documents/sync-kb');
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mc', 'documents'] }),
  });
}

// ============================================================
// POLICIES
// ============================================================
export function useMCPolicies() {
  return useQuery({
    queryKey: ['mc', 'policies'],
    queryFn: async () => {
      const { data } = await api.get('/mc/policies');
      return data;
    },
  });
}

export function useCreateMCPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (policy: any) => {
      const { data } = await api.post('/mc/policies', policy);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mc', 'policies'] }),
  });
}


// ============================================================
// MOMENTUM
// ============================================================
export function useMCMomentum() {
  return useQuery({
    queryKey: ['mc', 'momentum'],
    queryFn: async () => {
      const { data } = await api.get('/mc/momentum');
      return data;
    },
    refetchInterval: 10000,
  });
}

// ============================================================
// JOB DETAIL (ActivityLogModal)
// ============================================================
export function useMCJobDetail(jobId: string | undefined) {
  return useQuery({
    queryKey: ['mc', 'jobs', jobId],
    queryFn: async () => {
      const { data } = await api.get(`/mc/jobs/${jobId}`);
      return data;
    },
    enabled: !!jobId,
  });
}

// ============================================================
// SCHEDULER
// ============================================================
export function useMCSchedulerStatus() {
  return useQuery({
    queryKey: ['mc', 'scheduler'],
    queryFn: async () => {
      const { data } = await api.get('/mc/scheduler/status');
      return data;
    },
    refetchInterval: 10000,
  });
}

export function useDispatchNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/mc/scheduler/dispatch-now');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mc', 'jobs'] });
      qc.invalidateQueries({ queryKey: ['mc', 'scheduler'] });
    },
  });
}

// ============================================================
// METRICS (time-series charts)
// ============================================================
export function useMCMetrics(range: string = '7d') {
  return useQuery({
    queryKey: ['mc', 'metrics', range],
    queryFn: async () => {
      const { data } = await api.get(`/mc/metrics?range=${range}`);
      return data;
    },
    refetchInterval: 30000,
  });
}

export function useMCComparison(days: number = 7) {
  return useQuery({
    queryKey: ['mc', 'comparison', days],
    queryFn: async () => {
      const { data } = await api.get(`/mc/dashboard/comparison?days=${days}`);
      return data;
    },
    refetchInterval: 60000,
  });
}
// ============================================================
// APPROVALS
// ============================================================
export function useMCApprovals(filters?: { status?: string; job_id?: string; agent_id?: string }) {
  return useQuery({
    queryKey: ['mc', 'approvals', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.job_id) params.set('job_id', filters.job_id);
      if (filters?.agent_id) params.set('agent_id', filters.agent_id);
      const { data } = await api.get(`/mc/approvals?${params.toString()}`);
      return data;
    },
    refetchInterval: filters?.status === 'pending' ? 5000 : 10000,
  });
}

export function useMCApprovalDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['mc', 'approvals', id],
    queryFn: async () => {
      const { data } = await api.get(`/mc/approvals/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useResolveMCApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, reviewer_note }: { id: string; status: 'approved' | 'rejected'; reviewer_note?: string }) => {
      const { data } = await api.patch(`/mc/approvals/${id}/resolve`, { status, reviewer_note });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mc', 'approvals'] });
      qc.invalidateQueries({ queryKey: ['mc', 'jobs'] });
      qc.invalidateQueries({ queryKey: ['mc', 'dashboard'] });
    },
  });
}

// ─── Agent Core Files (OpenClaw workspace) ───────────────────────────────────

export function useAgentFiles(agentId: string | undefined) {
  return useQuery({
    queryKey: ['mc', 'agent-files', agentId],
    queryFn: async () => {
      const { data } = await api.get(`/mc/agents/${agentId}/files`);
      return data as { agentId: string; workspacePath: string; files: { name: string; size: number; exists: boolean }[] };
    },
    enabled: !!agentId,
  });
}

export function useAgentFile(agentId: string | undefined, filename: string | null) {
  return useQuery({
    queryKey: ['mc', 'agent-file', agentId, filename],
    queryFn: async () => {
      const { data } = await api.get(`/mc/agents/${agentId}/files/${filename}`);
      return data as { agentId: string; filename: string; content: string; exists: boolean };
    },
    enabled: !!agentId && !!filename,
  });
}

export function useUpdateAgentFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ agentId, filename, content }: { agentId: string; filename: string; content: string }) => {
      const { data } = await api.put(`/mc/agents/${agentId}/files/${filename}`, { content });
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['mc', 'agent-files', vars.agentId] });
      qc.invalidateQueries({ queryKey: ['mc', 'agent-file', vars.agentId, vars.filename] });
    },
  });
}
