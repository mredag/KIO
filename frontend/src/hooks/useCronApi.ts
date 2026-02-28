import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api/mc';

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export function useCronJobs() {
  return useQuery({
    queryKey: ['cron', 'jobs'],
    queryFn: () => apiFetch('/cron/jobs'),
    refetchInterval: 30000,
  });
}

export function useCronJobDetail(jobId: string | null) {
  return useQuery({
    queryKey: ['cron', 'job', jobId],
    queryFn: () => apiFetch(`/cron/jobs/${jobId}`),
    enabled: !!jobId,
    refetchInterval: 15000,
  });
}

export function useToggleCronJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, enabled }: { jobId: string; enabled: boolean }) =>
      apiFetch(`/cron/jobs/${jobId}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cron'] });
    },
  });
}

export function useTriggerCronJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) =>
      apiFetch(`/cron/jobs/${jobId}/trigger`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cron'] });
      qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

export function useAuditStatus() {
  return useQuery({
    queryKey: ['audit', 'status'],
    queryFn: () => apiFetch('/audit/status'),
    refetchInterval: 15000,
  });
}

export function useAuditHistory(limit = 10) {
  return useQuery({
    queryKey: ['audit', 'history', limit],
    queryFn: () => apiFetch(`/audit/history?limit=${limit}`),
  });
}

export function useRunAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch('/audit/run', { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit'] });
      qc.invalidateQueries({ queryKey: ['cron'] });
    },
  });
}

export function useAuditConfig() {
  return useQuery({
    queryKey: ['audit', 'config'],
    queryFn: () => apiFetch('/audit/config'),
  });
}

export function useUpdateAuditConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: Record<string, any>) =>
      apiFetch('/audit/config', { method: 'PATCH', body: JSON.stringify(config) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit'] });
      qc.invalidateQueries({ queryKey: ['cron'] });
    },
  });
}
