import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AdminLayout from '../../layouts/AdminLayout';
import { useCouponWallet, useCouponEvents } from '../../hooks/useAdminApi';
import { formatDateTime } from '../../lib/dateFormatter';
import { getErrorMessage } from '../../lib/errorHandler';
import { useToast } from '../../contexts/ToastContext';

export default function CouponWalletLookupPage() {
  const { t } = useTranslation(['admin', 'common']);
  const { addToast } = useToast();
  const [phone, setPhone] = useState('');
  const [searchPhone, setSearchPhone] = useState('');

  // Translate event names
  const getEventName = (eventType: string): string => {
    const eventTranslations: Record<string, string> = {
      'coupon_awarded': 'Kupon Kazanıldı',
      'redemption_granted': 'Kullanım Onaylandı',
      'redemption_blocked': 'Kullanım Engellendi',
      'redemption_attempt': 'Kullanım Denemesi',
      'balance_checked': 'Bakiye Sorgulandı',
      'opt_out': 'Bildirimlerden Çıkıldı',
    };
    return eventTranslations[eventType] || eventType.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
  };

  const { data: wallet, isLoading: walletLoading, error: walletError } = useCouponWallet(searchPhone);
  const { data: events, isLoading: eventsLoading, error: eventsError } = useCouponEvents(searchPhone);

  const handleSearch = () => {
    let trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      addToast({
        type: 'error',
        title: t('admin:coupons.invalidPhone'),
        duration: 3000,
      });
      return;
    }

    // Remove all non-digit characters
    const digitsOnly = trimmedPhone.replace(/\D/g, '');
    
    if (!digitsOnly) {
      addToast({
        type: 'error',
        title: t('admin:coupons.invalidPhone'),
        message: t('admin:coupons.phoneNumberHelp'),
        duration: 5000,
      });
      return;
    }

    // Normalize Turkish phone numbers
    let normalized = digitsOnly;
    
    // If starts with 0, remove it (Turkish local format)
    if (normalized.startsWith('0')) {
      normalized = normalized.substring(1);
    }
    
    // If it's 10 digits (Turkish number without country code), add +90
    if (normalized.length === 10) {
      normalized = '+90' + normalized;
    }
    // If it's 12 digits starting with 90, add +
    else if (normalized.length === 12 && normalized.startsWith('90')) {
      normalized = '+' + normalized;
    }
    // If already has +, keep it
    else if (trimmedPhone.startsWith('+')) {
      normalized = '+' + digitsOnly;
    }
    // Otherwise, assume it needs +90
    else {
      normalized = '+90' + normalized;
    }

    setSearchPhone(normalized);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            {t('admin:coupons.walletLookup')}
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {t('admin:coupons.walletLookupDescription')}
          </p>
        </div>

        {/* Phone Search Form */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('admin:coupons.phoneNumber')}
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="5551234567 veya 05551234567"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:bg-gray-700 dark:text-gray-100 text-lg font-mono"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Türk telefon numarası girebilirsiniz (örn: 5551234567, 05551234567, +905551234567)
              </p>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleSearch}
                disabled={walletLoading}
                className="px-8 py-3 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-sm"
              >
                {walletLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {t('common:messages.loading')}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {t('admin:coupons.lookup')}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Wallet Details */}
        {searchPhone && (
          <>
            {walletLoading ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{t('common:messages.loading')}</p>
              </div>
            ) : walletError ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-red-200 dark:border-red-800 p-12 text-center">
                <svg className="mx-auto h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="mt-4 text-red-600 dark:text-red-400">{getErrorMessage(walletError)}</p>
                <button
                  onClick={handleSearch}
                  className="mt-4 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors"
                >
                  {t('admin:coupons.retry')}
                </button>
              </div>
            ) : !wallet ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="mt-4 text-gray-500 dark:text-gray-400">{t('admin:coupons.noWallet')}</p>
              </div>
            ) : (
              <>
                {/* Customer Info Card */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
                      {t('admin:coupons.customerInfo')}
                    </h3>
                    {wallet.optedInMarketing && (
                      <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-medium rounded-full">
                        {t('admin:coupons.marketingOptIn')}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('admin:coupons.phone')}</p>
                      <p className="font-mono text-lg font-medium text-gray-900 dark:text-gray-100">{wallet.phone}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('admin:coupons.lastMessage')}</p>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {wallet.lastMessageAt
                          ? formatDateTime(wallet.lastMessageAt)
                          : t('admin:backup.never')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Balance Display */}
                <div className="bg-gradient-to-br from-sky-50 to-blue-50 dark:from-gray-800 dark:to-gray-700 rounded-xl shadow-md border-2 border-sky-200 dark:border-sky-800 p-8">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-6 text-center">
                    {t('admin:coupons.couponBalance')}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-sm">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{t('admin:coupons.currentBalance')}</p>
                      <p className="text-5xl font-bold text-sky-600 dark:text-sky-400">{wallet.couponCount}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t('admin:coupons.coupons')}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-sm">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{t('admin:coupons.totalEarned')}</p>
                      <p className="text-5xl font-bold text-green-600 dark:text-green-400">{wallet.totalEarned}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t('admin:coupons.lifetime')}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-sm">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{t('admin:coupons.totalRedeemed')}</p>
                      <p className="text-5xl font-bold text-purple-600 dark:text-purple-400">{wallet.totalRedeemed}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t('admin:coupons.used')}</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Transaction Timeline */}
            {wallet && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-6">
                  {t('admin:coupons.transactionTimeline')}
                </h3>

                {eventsLoading ? (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t('common:messages.loading')}</p>
                  </div>
                ) : eventsError ? (
                  <div className="text-center py-8 text-red-600 dark:text-red-400">
                    {getErrorMessage(eventsError)}
                  </div>
                ) : !events || events.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t('admin:coupons.noEvents')}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {events.map((event: any, index: number) => (
                      <div
                        key={event.id}
                        className="flex gap-4 pb-4 border-b border-gray-200 dark:border-gray-700 last:border-0"
                      >
                        {/* Timeline dot */}
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              event.event === 'coupon_awarded'
                                ? 'bg-green-100 dark:bg-green-900'
                                : event.event === 'redemption_granted'
                                  ? 'bg-blue-100 dark:bg-blue-900'
                                  : event.event === 'redemption_blocked'
                                    ? 'bg-red-100 dark:bg-red-900'
                                    : 'bg-gray-100 dark:bg-gray-700'
                            }`}
                          >
                            {event.event === 'coupon_awarded' ? (
                              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            ) : event.event === 'redemption_granted' ? (
                              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                                <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          {index < events.length - 1 && (
                            <div className="w-0.5 h-full bg-gray-200 dark:bg-gray-700 mt-2"></div>
                          )}
                        </div>

                        {/* Event details */}
                        <div className="flex-1 pt-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-gray-100">
                                {getEventName(event.event)}
                              </p>
                              {event.token && (
                                <p className="text-sm font-mono text-gray-600 dark:text-gray-400 mt-1">
                                  Token: {event.token}
                                </p>
                              )}
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap ml-4">
                              {formatDateTime(event.createdAt)}
                            </span>
                          </div>
                          {event.details && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                              {JSON.stringify(event.details)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
