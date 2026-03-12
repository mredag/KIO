import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const API = '/api/mc/gateways';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

function invalidateGatewayQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['gateways'] });
  queryClient.invalidateQueries({ queryKey: ['gateways', 'ops'] });
}

export function useGateways() {
  return useQuery({
    queryKey: ['gateways'],
    queryFn: () => apiFetch<any[]>(''),
  });
}

export function useGatewayOpsSummary() {
  return useQuery({
    queryKey: ['gateways', 'ops'],
    queryFn: () => apiFetch<any>('/ops/summary'),
    refetchInterval: 30000,
  });
}

export function useCreateGateway() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiFetch('', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => invalidateGatewayQueries(qc),
  });
}

export function useUpdateGateway() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => apiFetch(`/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => invalidateGatewayQueries(qc),
  });
}

export function useDeleteGateway() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch(`/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateGatewayQueries(qc),
  });
}

export function useCheckGateway() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch(`/${id}/check`, { method: 'POST' }),
    onSuccess: () => invalidateGatewayQueries(qc),
  });
}

export function useActivateGateway() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch(`/${id}/activate`, { method: 'POST' }),
    onSuccess: () => invalidateGatewayQueries(qc),
  });
}
