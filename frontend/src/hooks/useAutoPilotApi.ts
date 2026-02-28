import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api/mc/autopilot';

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export function useAutoPilotStatus() {
  return useQuery({
    queryKey: ['autopilot', 'status'],
    queryFn: () => apiFetch('/status'),
    refetchInterval: 10000,
  });
}

export function useAutoPilotConfig() {
  return useQuery({
    queryKey: ['autopilot', 'config'],
    queryFn: () => apiFetch('/config'),
  });
}

export function useUpdateAutoPilotConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: Record<string, any>) =>
      apiFetch('/config', { method: 'PATCH', body: JSON.stringify(config) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['autopilot'] });
    },
  });
}

export function useStartAutoPilot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch('/start', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['autopilot'] }),
  });
}

export function useStopAutoPilot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch('/stop', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['autopilot'] }),
  });
}

export function useManualDispatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) =>
      apiFetch(`/dispatch/${jobId}`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['autopilot'] }),
  });
}

export function useAutoPilotHistory(limit = 50) {
  return useQuery({
    queryKey: ['autopilot', 'history', limit],
    queryFn: () => apiFetch(`/history?limit=${limit}`),
    refetchInterval: 15000,
  });
}
