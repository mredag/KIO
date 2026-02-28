import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API = '/api/mc/gateways';

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export function useGateways() {
  return useQuery({ queryKey: ['gateways'], queryFn: () => apiFetch('') });
}

export function useCreateGateway() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiFetch('', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gateways'] }),
  });
}

export function useUpdateGateway() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => apiFetch(`/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gateways'] }),
  });
}

export function useDeleteGateway() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch(`/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gateways'] }),
  });
}

export function useCheckGateway() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch(`/${id}/check`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gateways'] }),
  });
}

export function useActivateGateway() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch(`/${id}/activate`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gateways'] }),
  });
}
