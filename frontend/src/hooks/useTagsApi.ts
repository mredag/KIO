import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API = '/api/mc';

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// Tags
export function useTags() {
  return useQuery({ queryKey: ['mc-tags'], queryFn: () => apiFetch('/tags') });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiFetch('/tags', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mc-tags'] }),
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => apiFetch(`/tags/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mc-tags'] }),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch(`/tags/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mc-tags'] }),
  });
}

export function useAssignTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tagId, entity_type, entity_id }: any) =>
      apiFetch(`/tags/${tagId}/assign`, { method: 'POST', body: JSON.stringify({ entity_type, entity_id }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mc-tags'] }),
  });
}

export function useEntityTags(entityType: string, entityId: string) {
  return useQuery({
    queryKey: ['mc-tags', 'entity', entityType, entityId],
    queryFn: () => apiFetch(`/tags/entity/${entityType}/${entityId}`),
    enabled: !!entityType && !!entityId,
  });
}

// Custom Fields
export function useCustomFields(entityType?: string) {
  return useQuery({
    queryKey: ['mc-custom-fields', entityType],
    queryFn: () => apiFetch(`/custom-fields${entityType ? `?entity_type=${entityType}` : ''}`),
  });
}

export function useCreateCustomField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiFetch('/custom-fields', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mc-custom-fields'] }),
  });
}

export function useDeleteCustomField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch(`/custom-fields/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mc-custom-fields'] }),
  });
}

export function useEntityFieldValues(entityType: string, entityId: string) {
  return useQuery({
    queryKey: ['mc-custom-fields', 'values', entityType, entityId],
    queryFn: () => apiFetch(`/custom-fields/values/${entityType}/${entityId}`),
    enabled: !!entityType && !!entityId,
  });
}

export function useSetFieldValue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fieldId, entityId, value }: any) =>
      apiFetch(`/custom-fields/values/${fieldId}/${entityId}`, { method: 'PUT', body: JSON.stringify({ value }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mc-custom-fields'] }),
  });
}
