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
    layoutTemplate: data.layout_template || 'price-list',
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
    mutationFn: async (data: { mode: string; activeSurveyId?: string; couponQrUrl?: string; couponToken?: string }) => {
      // Transform camelCase to snake_case for backend
      const payload: Record<string, any> = {
        mode: data.mode,
        active_survey_id: data.activeSurveyId,
      };
      // Add coupon QR data if present
      if (data.couponQrUrl) {
        payload.coupon_qr_url = data.couponQrUrl;
        payload.coupon_token = data.couponToken;
      }
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

// Coupon System

// Issue new token
export function useIssueToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params?: { kioskId?: string; issuedFor?: string; phone?: string }) => {
      try {
        const response = await api.post('/admin/coupons/issue', {
          kioskId: params?.kioskId || 'admin-panel',
          issuedFor: params?.issuedFor,
        });
        return response.data;
      } catch (error: any) {
        // Handle specific coupon errors
        if (error.response?.status === 500) {
          throw new Error('Failed to generate unique token. Please try again.');
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons', 'recent-tokens'] });
    },
  });
}

// Get recent tokens (last 10) - auto-refreshes every 5 seconds
export function useRecentTokens() {
  return useQuery({
    queryKey: ['admin', 'coupons', 'recent-tokens'],
    queryFn: async () => {
      const response = await api.get('/admin/coupons/recent-tokens');
      return response.data.map((token: any) => ({
        token: token.token,
        status: token.status,
        createdAt: new Date(token.created_at),
        expiresAt: new Date(token.expires_at),
        usedAt: token.used_at ? new Date(token.used_at) : null,
      }));
    },
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });
}

// Delete unused token
export function useDeleteToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string) => {
      const response = await api.delete(`/admin/coupons/tokens/${token}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons', 'recent-tokens'] });
    },
  });
}

// Get wallet by phone
export function useCouponWallet(phone: string) {
  return useQuery({
    queryKey: ['admin', 'coupons', 'wallet', phone],
    queryFn: async () => {
      try {
        const response = await api.get(`/admin/coupons/wallet/${phone}`);
        return {
          phone: response.data.phone,
          couponCount: response.data.couponCount,
          totalEarned: response.data.totalEarned,
          totalRedeemed: response.data.totalRedeemed,
          optedInMarketing: response.data.optedInMarketing,
          lastMessageAt: response.data.lastMessageAt ? new Date(response.data.lastMessageAt) : null,
          updatedAt: new Date(response.data.updatedAt),
        };
      } catch (error: any) {
        // Handle 404 - wallet not found
        if (error.response?.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: !!phone && phone.length > 0,
    retry: (failureCount, error: any) => {
      // Don't retry on 404 (wallet not found)
      if (error?.response?.status === 404) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

// Get coupon events by phone
export function useCouponEvents(phone: string) {
  return useQuery({
    queryKey: ['admin', 'coupons', 'events', phone],
    queryFn: async () => {
      try {
        const response = await api.get(`/admin/coupons/events/${phone}`);
        return response.data.map((event: any) => ({
          id: event.id,
          phone: event.phone,
          phoneMasked: event.phoneMasked,
          event: event.event,
          token: event.token,
          tokenMasked: event.tokenMasked,
          details: event.details,
          createdAt: new Date(event.createdAt),
        }));
      } catch (error: any) {
        // Handle 404 - no events found
        if (error.response?.status === 404) {
          return [];
        }
        throw error;
      }
    },
    enabled: !!phone && phone.length > 0,
    retry: (failureCount, error: any) => {
      // Don't retry on 404
      if (error?.response?.status === 404) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

// Get redemptions with optional filters
export function useCouponRedemptions(filters?: { status?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['admin', 'coupons', 'redemptions', filters],
    queryFn: async () => {
      try {
        const response = await api.get('/admin/coupons/redemptions', {
          params: filters,
        });
        return response.data.map((redemption: any) => ({
          id: redemption.id,
          phone: redemption.phone,
          phoneMasked: redemption.phoneMasked,
          couponsUsed: redemption.couponsUsed,
          status: redemption.status,
          note: redemption.note,
          createdAt: new Date(redemption.createdAt),
          notifiedAt: redemption.notifiedAt ? new Date(redemption.notifiedAt) : null,
          completedAt: redemption.completedAt ? new Date(redemption.completedAt) : null,
          rejectedAt: redemption.rejectedAt ? new Date(redemption.rejectedAt) : null,
        }));
      } catch (error: any) {
        // Handle errors gracefully
        if (error.response?.status === 404) {
          return [];
        }
        throw error;
      }
    },
    retry: 2,
  });
}

// Complete redemption
export function useCompleteRedemption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (redemptionId: string) => {
      try {
        const response = await api.post(`/admin/coupons/redemptions/${redemptionId}/complete`);
        return response.data;
      } catch (error: any) {
        // Handle specific errors
        if (error.response?.status === 404) {
          throw new Error('Redemption not found. It may have already been processed.');
        }
        if (error.response?.status === 400) {
          throw new Error(error.response.data?.error || 'Invalid redemption request.');
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons', 'redemptions'] });
    },
  });
}

// Reject redemption
export function useRejectRedemption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ redemptionId, note }: { redemptionId: string; note: string }) => {
      try {
        if (!note || note.trim().length === 0) {
          throw new Error('A rejection note is required.');
        }
        const response = await api.post(`/admin/coupons/redemptions/${redemptionId}/reject`, { note });
        return response.data;
      } catch (error: any) {
        // Handle specific errors
        if (error.response?.status === 404) {
          throw new Error('Redemption not found. It may have already been processed.');
        }
        if (error.response?.status === 400) {
          throw new Error(error.response.data?.error || 'Invalid redemption request. A note is required.');
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons', 'redemptions'] });
    },
  });
}

// Unified Interactions

export function useUnifiedInteractions(filters?: {
  platform?: 'whatsapp' | 'instagram' | 'all';
  startDate?: string;
  endDate?: string;
  customerId?: string;
  intent?: string;
  sentiment?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['admin', 'interactions', filters],
    queryFn: async () => {
      const response = await api.get('/admin/interactions', { params: filters });
      
      // Ensure response.data is an array
      if (!Array.isArray(response.data)) {
        console.error('Invalid response data:', response.data);
        throw new Error('Invalid response format: expected array');
      }
      
      return response.data.map((interaction: any) => ({
        id: interaction.id,
        platform: interaction.platform,
        customerId: interaction.customerId || interaction.customer_id,
        direction: interaction.direction,
        messageText: interaction.messageText || interaction.message_text,
        intent: interaction.intent,
        sentiment: interaction.sentiment,
        aiResponse: interaction.aiResponse || interaction.ai_response,
        responseTimeMs: interaction.responseTimeMs || interaction.response_time_ms,
        createdAt: new Date(interaction.createdAt || interaction.created_at),
      }));
    },
  });
}

export function useInteractionsAnalytics(filters?: {
  platform?: 'whatsapp' | 'instagram' | 'all';
  startDate?: string;
  endDate?: string;
}) {
  return useQuery({
    queryKey: ['admin', 'interactions', 'analytics', filters],
    queryFn: async () => {
      const response = await api.get('/admin/interactions/analytics', { params: filters });
      return response.data;
    },
  });
}

export function useExportInteractions() {
  return useMutation({
    mutationFn: async (filters?: {
      platform?: 'whatsapp' | 'instagram' | 'all';
      startDate?: string;
      endDate?: string;
    }) => {
      const response = await api.get('/admin/interactions/export', {
        params: filters,
        responseType: 'blob',
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `interactions-${new Date().toISOString()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      return response.data;
    },
  });
}

// Service Control

export function useServices() {
  return useQuery({
    queryKey: ['admin', 'services'],
    queryFn: async () => {
      const response = await api.get('/admin/services');
      return response.data.map((service: any) => ({
        serviceName: service.service_name,
        enabled: service.enabled,
        lastActivity: service.last_activity ? new Date(service.last_activity) : null,
        messageCount24h: service.message_count_24h || 0,
        config: service.config,
        updatedAt: new Date(service.updated_at),
      }));
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });
}

export function useToggleService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (serviceName: string) => {
      const response = await api.post(`/admin/services/${serviceName}/toggle`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'services'] });
    },
  });
}

// Knowledge Base

export function useKnowledgeBase() {
  return useQuery({
    queryKey: ['admin', 'knowledge-base'],
    queryFn: async () => {
      const response = await api.get('/admin/knowledge-base');
      return response.data.map((entry: any) => ({
        id: entry.id,
        category: entry.category,
        keyName: entry.key_name,
        value: entry.value,
        description: entry.description,
        isActive: entry.is_active,
        version: entry.version,
        createdAt: new Date(entry.created_at),
        updatedAt: new Date(entry.updated_at),
      }));
    },
  });
}

export function useCreateKnowledgeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      category: string;
      keyName: string;
      value: string;
      description?: string;
      isActive?: boolean;
    }) => {
      const response = await api.post('/admin/knowledge-base', {
        category: data.category,
        key_name: data.keyName,
        value: data.value,
        description: data.description,
        is_active: data.isActive !== false,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'knowledge-base'] });
    },
  });
}

export function useUpdateKnowledgeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: {
      id: string;
      data: {
        category?: string;
        keyName?: string;
        value?: string;
        description?: string;
        isActive?: boolean;
      };
    }) => {
      const response = await api.put(`/admin/knowledge-base/${id}`, {
        category: data.category,
        key_name: data.keyName,
        value: data.value,
        description: data.description,
        is_active: data.isActive,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'knowledge-base'] });
    },
  });
}

export function useDeleteKnowledgeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/knowledge-base/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'knowledge-base'] });
    },
  });
}
