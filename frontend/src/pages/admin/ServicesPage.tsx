import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AdminLayout from '../../layouts/AdminLayout';
import { useServices, useToggleService } from '../../hooks/useAdminApi';
import { formatDateTime, formatRelativeTime } from '../../lib/dateFormatter';

interface Service {
  serviceName: 'whatsapp' | 'instagram';
  enabled: boolean;
  lastActivity: Date | null;
  messageCount24h: number;
  config?: any;
  updatedAt: Date;
}

export default function ServicesPage() {
  const { t } = useTranslation(['admin', 'common']);
  const navigate = useNavigate();
  const { data: services, isLoading, error } = useServices();
  const toggleMutation = useToggleService();
  const [confirmToggle, setConfirmToggle] = useState<string | null>(null);
  
  const handleToggle = async (serviceName: string) => {
    try {
      await toggleMutation.mutateAsync(serviceName);
      setConfirmToggle(null);
    } catch (error) {
      console.error('Failed to toggle service:', error);
      alert(t('admin:services.toggleError'));
    }
  };
  
  const handleViewInteractions = (platform: 'whatsapp' | 'instagram') => {
    navigate(`/admin/interactions?platform=${platform}`);
  };
  
  const getServiceIcon = (serviceName: string) => {
    if (serviceName === 'whatsapp') {
      return (
        <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
        </svg>
      );
    } else {
      return (
        <svg className="w-8 h-8 text-pink-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
      );
    }
  };
  
  const getServiceName = (serviceName: string) => {
    return serviceName === 'whatsapp' 
      ? t('admin:services.whatsapp')
      : t('admin:services.instagram');
  };
  
  const getStatusColor = (service: Service) => {
    if (!service.enabled) {
      return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
    
    // Check if there's been activity in the last 24 hours
    if (!service.lastActivity) {
      return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
    }
    
    const hoursSinceActivity = (Date.now() - service.lastActivity.getTime()) / (1000 * 60 * 60);
    if (hoursSinceActivity > 24) {
      return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
    }
    
    return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
  };
  
  const getStatusText = (service: Service) => {
    if (!service.enabled) {
      return t('admin:services.disabled');
    }
    
    if (!service.lastActivity) {
      return t('admin:services.noActivity');
    }
    
    const hoursSinceActivity = (Date.now() - service.lastActivity.getTime()) / (1000 * 60 * 60);
    if (hoursSinceActivity > 24) {
      return t('admin:services.warning');
    }
    
    return t('admin:services.active');
  };
  
  const hasWarning = (service: Service) => {
    if (!service.enabled) return false;
    if (!service.lastActivity) return true;
    
    const hoursSinceActivity = (Date.now() - service.lastActivity.getTime()) / (1000 * 60 * 60);
    return hoursSinceActivity > 24;
  };
  
  if (error) {
    return (
      <AdminLayout>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-300">{t('admin:services.loadError')}</p>
        </div>
      </AdminLayout>
    );
  }
  
  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t('admin:services.title')}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t('admin:services.subtitle')}
          </p>
        </div>
        
        {/* Services Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : services && services.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {services.map((service: Service) => (
              <div
                key={service.serviceName}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow"
              >
                {/* Service Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {getServiceIcon(service.serviceName)}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {getServiceName(service.serviceName)}
                      </h3>
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full mt-1 ${getStatusColor(service)}`}>
                        {getStatusText(service)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Toggle Switch */}
                  <div className="flex flex-col items-end gap-2">
                    {confirmToggle === service.serviceName ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleToggle(service.serviceName)}
                          disabled={toggleMutation.isPending}
                          className="px-3 py-1 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors text-sm font-medium disabled:opacity-50"
                        >
                          {t('common:confirm')}
                        </button>
                        <button
                          onClick={() => setConfirmToggle(null)}
                          disabled={toggleMutation.isPending}
                          className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium disabled:opacity-50"
                        >
                          {t('common:cancel')}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmToggle(service.serviceName)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 ${
                          service.enabled
                            ? 'bg-sky-600'
                            : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                        title={t('admin:services.toggleService')}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            service.enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Warning Message */}
                {hasWarning(service) && (
                  <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        {t('admin:services.warningNoActivity')}
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Service Stats */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {t('admin:services.lastActivity')}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {service.lastActivity ? (
                        <span title={formatDateTime(service.lastActivity)}>
                          {formatRelativeTime(service.lastActivity)}
                        </span>
                      ) : (
                        t('admin:services.never')
                      )}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {t('admin:services.messages24h')}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {service.messageCount24h}
                    </span>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => handleViewInteractions(service.serviceName)}
                    className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    {t('admin:services.viewInteractions')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12">
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                {t('admin:services.noServices')}
              </h3>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
