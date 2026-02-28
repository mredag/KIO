import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

// ============================================================
// BOARDS
// ============================================================
export function useBoards(status?: string) {
  return useQuery({
    queryKey: ['boards', status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      const { data } = await api.get(`/mc/boards?${params.toString()}`);
      return data;
    },
  });
}

export function useBoard(id: string | undefined) {
  return useQuery({
    queryKey: ['board', id],
    queryFn: async () => {
      const { data } = await api.get(`/mc/boards/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (board: { name: string; objective?: string; lead_agent_id: string }) => {
      const { data } = await api.post('/mc/boards', board);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['boards'] }),
  });
}

export function useUpdateBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; objective?: string; status?: string; lead_agent_id?: string }) => {
      const { data } = await api.patch(`/mc/boards/${id}`, updates);
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['boards'] });
      qc.invalidateQueries({ queryKey: ['board', variables.id] });
    },
  });
}

export function useAddBoardAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ boardId, agent_id }: { boardId: string; agent_id: string }) => {
      const { data } = await api.post(`/mc/boards/${boardId}/agents`, { agent_id });
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['board', variables.boardId] });
    },
  });
}

export function useRemoveBoardAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ boardId, agentId }: { boardId: string; agentId: string }) => {
      const { data } = await api.delete(`/mc/boards/${boardId}/agents/${agentId}`);
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['board', variables.boardId] });
    },
  });
}

export function useBoardActivity(id: string | undefined) {
  return useQuery({
    queryKey: ['board', id, 'activity'],
    queryFn: async () => {
      const { data } = await api.get(`/mc/boards/${id}/activity`);
      return data;
    },
    enabled: !!id,
  });
}

// ============================================================
// MESSAGES
// ============================================================
export function useCommsMessages(filters?: {
  sender_id?: string;
  recipient_id?: string;
  message_type?: string;
  board_id?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['comms-messages', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.sender_id) params.set('sender_id', filters.sender_id);
      if (filters?.recipient_id) params.set('recipient_id', filters.recipient_id);
      if (filters?.message_type) params.set('message_type', filters.message_type);
      if (filters?.board_id) params.set('board_id', filters.board_id);
      if (filters?.page) params.set('page', String(filters.page));
      if (filters?.limit) params.set('limit', String(filters.limit));
      const { data } = await api.get(`/mc/comms/messages?${params.toString()}`);
      return data;
    },
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (msg: {
      sender_id: string;
      recipient_id: string;
      message_type: string;
      content: string;
      board_id?: string;
    }) => {
      const { data } = await api.post('/mc/comms/send', msg);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comms-messages'] }),
  });
}

export function useBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (msg: {
      sender_id: string;
      board_id: string;
      message_type: string;
      content: string;
    }) => {
      const { data } = await api.post('/mc/comms/broadcast', msg);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comms-messages'] }),
  });
}

// ============================================================
// DELEGATION
// ============================================================
export function useDelegateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: {
      parent_job_id?: string;
      title: string;
      agent_id: string;
      priority?: string;
      payload?: any;
      depends_on?: string[];
      board_id: string;
    }) => {
      const { data } = await api.post('/mc/comms/delegate', task);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['board'] }),
  });
}

// ============================================================
// SHARED MEMORY
// ============================================================
export function useSharedMemory(filters?: {
  board_id?: string;
  source_agent_id?: string;
  tags?: string;
  memory_type?: string;
}) {
  return useQuery({
    queryKey: ['shared-memory', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.board_id) params.set('board_id', filters.board_id);
      if (filters?.source_agent_id) params.set('source_agent_id', filters.source_agent_id);
      if (filters?.tags) params.set('tags', filters.tags);
      if (filters?.memory_type) params.set('memory_type', filters.memory_type);
      const { data } = await api.get(`/mc/comms/memory?${params.toString()}`);
      return data;
    },
  });
}

export function useWriteMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: {
      board_id: string;
      source_agent_id: string;
      key: string;
      value: string;
      tags?: string[];
      memory_type?: string;
    }) => {
      const { data } = await api.post('/mc/comms/memory', item);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shared-memory'] }),
  });
}

export function useDeleteMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/mc/comms/memory/${id}`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shared-memory'] }),
  });
}
