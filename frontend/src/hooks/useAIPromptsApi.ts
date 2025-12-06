import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export interface AIPrompt {
  id: string;
  name: string;
  description: string | null;
  system_message: string;
  workflow_type: 'whatsapp' | 'instagram' | 'general';
  is_active: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CreateAIPromptInput {
  name: string;
  description?: string;
  system_message: string;
  workflow_type?: 'whatsapp' | 'instagram' | 'general';
  is_active?: boolean;
}

export interface UpdateAIPromptInput extends Partial<CreateAIPromptInput> {}

export function useAIPrompts() {
  return useQuery({
    queryKey: ['ai-prompts'],
    queryFn: async () => {
      const response = await api.get<AIPrompt[]>('/admin/ai-prompts');
      return response.data;
    },
  });
}

export function useAIPrompt(id: string) {
  return useQuery({
    queryKey: ['ai-prompts', id],
    queryFn: async () => {
      const response = await api.get<AIPrompt>(`/admin/ai-prompts/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCreateAIPrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAIPromptInput) => {
      const response = await api.post<AIPrompt>('/admin/ai-prompts', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-prompts'] });
    },
  });
}

export function useUpdateAIPrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateAIPromptInput }) => {
      const response = await api.put<AIPrompt>(`/admin/ai-prompts/${id}`, data);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ai-prompts'] });
      queryClient.invalidateQueries({ queryKey: ['ai-prompts', variables.id] });
    },
  });
}

export function useDeleteAIPrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/ai-prompts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-prompts'] });
    },
  });
}
