import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import {
  Massage,
  SurveyTemplate,
  SurveyResponse,
  SystemStatus,
  SystemSettings,
} from '../types';

// Authentication
export function useLogin() {
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated);

  return useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const response = await api.post('/admin/login', credentials);
      return response.data;
    },
    onSuccess: (data) => {
      setAuthenticated(true, { username: data.username });
    },
  });
}

export function useLogout() {
  const logout = useAuthStore((state) => state.logout);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await api.post('/admin/logout');
    },
    onSuccess: () => {
      logout();
      queryClient.clear(); // Clear all cached data
    },
  });
}

// Dashboard
export function useDashboard(enableAutoRefresh = true) {
  return useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => {
      const response = await api.get<SystemStatus>('/admin/dashboard');
      return response.data;
    },
    refetchInterval: enableAutoRefresh ? 10000 : false, // Auto-refresh only when enabled
  });
}

// Alerts
export function useAlerts(enableAutoRefresh = true) {
  return useQuery({
    queryKey: ['admin', 'alerts'],
    queryFn: async () => {
      const response = await api.get<any[]>('/admin/alerts');
      return response.data;
    },
    refetchInterval: enableAutoRefresh ? 60000 : false, // Refetch only when enabled
  });
}

// Helper to transform snake_case from backend to camelCase for frontend
function transformMassage(data: any): Massage {
  return {
    id: data.id,
    name: data.name,
    shortDescription: data.short_description,
    longDescription: data.long_description || '',
    duration: data.duration || '',
    mediaType: data.media_type || '',
    mediaUrl: data.media_url || '',
    purposeTags: data.purpose_tags || [],
    sessions: data.sessions || [],
    isFeatured: data.is_featured === 1,
    isCampaign: data.is_campaign === 1,
    sortOrder: data.sort_order || 0,
  };
}

// Massages
export function useMassages() {
  return useQuery({
    queryKey: ['admin', 'massages'],
    queryFn: async () => {
      const response = await api.get<any[]>('/admin/massages');
      return response.data.map(transformMassage);
    },
  });
}

export function useCreateMassage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Massage, 'id'>) => {
      const response = await api.post<Massage>('/admin/massages', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'massages'] });
      // Invalidate kiosk menu cache so changes appear immediately on kiosk screen
      queryClient.invalidateQueries({ queryKey: ['kiosk', 'menu'] });
    },
  });
}

export function useUpdateMassage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Massage> }) => {
      const response = await api.put<Massage>(`/admin/massages/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'massages'] });
      // Invalidate kiosk menu cache so changes appear immediately on kiosk screen
      queryClient.invalidateQueries({ queryKey: ['kiosk', 'menu'] });
    },
  });
}

export function useDeleteMassage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/massages/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'massages'] });
      // Invalidate kiosk menu cache so changes appear immediately on kiosk screen
      queryClient.invalidateQueries({ queryKey: ['kiosk', 'menu'] });
    },
  });
}

// Kiosk mode control
export function useUpdateKioskMode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { mode: string; activeSurveyId?: string }) => {
      // Transform camelCase to snake_case for backend
      const payload = {
        mode: data.mode,
        active_survey_id: data.activeSurveyId,
      };
      const response = await api.put('/admin/kiosk/mode', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      // Invalidate kiosk state cache so mode changes appear immediately
      queryClient.invalidateQueries({ queryKey: ['kiosk', 'state'] });
    },
  });
}

// Helper to transform survey template from backend to frontend
function transformSurveyTemplate(data: any): SurveyTemplate {
  return {
    id: data.id,
    name: data.name,
    type: data.type,
    title: data.title,
    description: data.description || '',
    questions: data.questions || [],
  };
}

// Helper to transform survey response from backend to frontend
function transformSurveyResponse(data: any): SurveyResponse {
  return {
    id: data.id,
    surveyId: data.survey_id,
    timestamp: new Date(data.created_at),
    answers: data.answers || {},
    synced: data.synced === 1,
  };
}

// Survey templates
export function useSurveyTemplates() {
  return useQuery({
    queryKey: ['admin', 'surveys'],
    queryFn: async () => {
      const response = await api.get<any[]>('/admin/surveys');
      return response.data.map(transformSurveyTemplate);
    },
  });
}

export function useCreateSurveyTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<SurveyTemplate, 'id'>) => {
      const response = await api.post<SurveyTemplate>('/admin/surveys', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'surveys'] });
    },
  });
}

export function useUpdateSurveyTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SurveyTemplate> }) => {
      const response = await api.put<SurveyTemplate>(`/admin/surveys/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'surveys'] });
    },
  });
}

export function useDeleteSurveyTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/surveys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'surveys'] });
    },
  });
}

// Survey responses
export function useSurveyResponses(filters?: any) {
  return useQuery({
    queryKey: ['admin', 'survey-responses', filters],
    queryFn: async () => {
      const response = await api.get<any[]>('/admin/survey-responses', {
        params: filters,
      });
      return response.data.map(transformSurveyResponse);
    },
  });
}

// Survey analytics
export function useSurveyAnalytics(surveyId: string, filters?: any) {
  return useQuery({
    queryKey: ['admin', 'survey-analytics', surveyId, filters],
    queryFn: async () => {
      const response = await api.get<any>(`/admin/survey-analytics/${surveyId}`, {
        params: filters,
      });
      return response.data;
    },
    enabled: !!surveyId,
  });
}

// Delete survey responses
export function useDeleteSurveyResponses() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (surveyId: string) => {
      const response = await api.delete(`/admin/survey-responses/${surveyId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'survey-responses'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'survey-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'alerts'] });
    },
  });
}

// Delete all survey responses
export function useDeleteAllSurveyResponses() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await api.delete('/admin/survey-responses');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'survey-responses'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'survey-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'alerts'] });
    },
  });
}

// System settings
export function useSettings() {
  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: async () => {
      const response = await api.get<SystemSettings>('/admin/settings');
      return response.data;
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<SystemSettings>) => {
      const response = await api.put<SystemSettings>('/admin/settings', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
  });
}

// Test Google Sheets connection
export function useTestSheetsConnection() {
  return useMutation({
    mutationFn: async (data: { sheetId: string; sheetName: string; credentials?: string }) => {
      const response = await api.post('/admin/test-sheets', data);
      return response.data;
    },
  });
}

// System Logs
export function useSystemLogs(filters?: {
  level?: 'info' | 'warn' | 'error';
  startDate?: string;
  endDate?: string;
  limit?: number;
  search?: string;
}) {
  return useQuery({
    queryKey: ['admin', 'logs', filters],
    queryFn: async () => {
      const response = await api.get('/admin/logs', {
        params: filters,
      });
      return response.data;
    },
  });
}

// Backup
export function useBackupInfo() {
  return useQuery({
    queryKey: ['admin', 'backup', 'info'],
    queryFn: async () => {
      const response = await api.get('/admin/backup/info');
      return response.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useDownloadBackup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await api.get('/admin/backup', {
        responseType: 'blob',
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `backup-${new Date().toISOString()}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      return response.data;
    },
    onSuccess: () => {
      // Refresh backup info after download
      queryClient.invalidateQueries({ queryKey: ['admin', 'backup', 'info'] });
    },
  });
}
