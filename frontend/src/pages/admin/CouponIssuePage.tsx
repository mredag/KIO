import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AdminLayout from '../../layouts/AdminLayout';
import { useIssueToken, useRecentTokens, useUpdateKioskMode, useDeleteToken } from '../../hooks/useAdminApi';
import { formatDateTime } from '../../lib/dateFormatter';
import { getErrorMessage } from '../../lib/errorHandler';
import { useToast } from '../../contexts/ToastContext';
import QRCode from 'qrcode';

// Normalize phone number to E.164 format (Turkish)
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');
  
  // Handle different formats:
  // 905067070403 -> +905067070403
  // 5067070403 -> +905067070403
  // 05067070403 -> +905067070403
  
  if (digits.startsWith('90') && digits.length === 12) {
    // Already has country code: 905067070403
    return '+' + digits;
  } else if (digits.startsWith('0') && digits.length === 11) {
    // Starts with 0: 05067070403
    return '+90' + digits.substring(1);
  } else if (digits.length === 10 && !digits.startsWith('0')) {
    // 10 digits without leading 0: 5067070403
    return '+90' + digits;
  }
  
  // Return as-is with + prefix if not matching patterns
  return digits.startsWith('+') ? phone : '+' + digits;
}

export default function CouponIssuePage() {
  const { t } = useTranslation(['admin', 'common']);
  const { addToast } = useToast();
  const issueToken = useIssueToken();
  const deleteToken = useDeleteToken();
  const updateKioskMode = useUpdateKioskMode();
  const { data: recentTokens, isLoading: tokensLoading, error: tokensError, refetch: refetchTokens } = useRecentTokens();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [currentToken, setCurrentToken] = useState<string>('');
  const [currentWaUrl, setCurrentWaUrl] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [sendingToKiosk, setSendingToKiosk] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleSelectToken = async (token: any) => {
    // Don't allow selecting used tokens
    if (token.status === 'used') {
      addToast({
        type: 'info',
        title: t('admin:coupons.statusUsed'),
        duration: 2000,
      });
      return;
    }
    
    try {
      // Use waUrl from the token (provided by backend)
      const waUrl = token.waUrl;
      
      // Generate large QR code
      const qrUrl = await QRCode.toDataURL(waUrl, {
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      
      setCurrentToken(token.token);
      setCurrentWaUrl(waUrl);
      setQrCodeUrl(qrUrl);
    } catch (err) {
      console.error('Failed to generate QR for token:', err);
    }
  };

  const handleIssueToken = async () => {
    try {
      // Normalize phone if provided
      const normalizedPhone = phone.trim() ? normalizePhoneNumber(phone.trim()) : undefined;
      
      const result = await issueToken.mutateAsync({ phone: normalizedPhone });
      setCurrentToken(result.token);
      setCurrentWaUrl(result.waUrl);
      
      // Generate large QR code
      const qrUrl = await QRCode.toDataURL(result.waUrl, {
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      setQrCodeUrl(qrUrl);
      
      // Refetch recent tokens
      refetchTokens();
      
      addToast({
        type: 'success',
        title: t('admin:coupons.tokenIssuedSuccess'),
        duration: 3000,
      });
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      addToast({
        type: 'error',
        title: t('common:messages.error'),
        message: errorMessage,
        duration: 5000,
      });
      console.error('Failed to issue token:', err);
    }
  };

  const handleSendTokenToKiosk = async (token: any) => {
    // Generate waUrl if not provided by backend
    const waUrl = token.waUrl || `https://wa.me/905365100558?text=${encodeURIComponent(`KUPON ${token.token}`)}`;
    
    setSendingToKiosk(true);
    try {
      await updateKioskMode.mutateAsync({
        mode: 'coupon-qr',
        couponQrUrl: waUrl,
        couponToken: token.token,
      });
      
      addToast({
        type: 'success',
        title: t('admin:coupons.sentToKiosk'),
        message: t('admin:coupons.sentToKioskMessage'),
        duration: 5000,
      });
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      addToast({
        type: 'error',
        title: t('common:messages.error'),
        message: errorMessage,
        duration: 5000,
      });
    } finally {
      setSendingToKiosk(false);
    }
  };

  const handleSendToKiosk = async () => {
    if (!currentWaUrl) return;
    
    setSendingToKiosk(true);
    try {
      // Change kiosk mode to show coupon QR temporarily
      await updateKioskMode.mutateAsync({
        mode: 'coupon-qr',
        couponQrUrl: currentWaUrl,
        couponToken: currentToken,
      });
      
      addToast({
        type: 'success',
        title: t('admin:coupons.sentToKiosk'),
        message: t('admin:coupons.sentToKioskMessage'),
        duration: 5000,
      });
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      addToast({
        type: 'error',
        title: t('common:messages.error'),
        message: errorMessage,
        duration: 5000,
      });
    } finally {
      setSendingToKiosk(false);
    }
  };

  const handleDeleteToken = async (token: string) => {
    try {
      await deleteToken.mutateAsync(token);
      setDeleteConfirm(null);
      refetchTokens();
      
      // Clear current token if it was deleted
      if (token === currentToken) {
        setCurrentToken('');
        setCurrentWaUrl('');
        setQrCodeUrl('');
      }
      
      addToast({
        type: 'success',
        title: t('admin:coupons.tokenDeleted'),
        duration: 3000,
      });
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      addToast({
        type: 'error',
        title: t('common:messages.error'),
        message: errorMessage,
        duration: 5000,
      });
    }
  };

  const handleCopyToken = () => {
    if (currentToken) {
      navigator.clipboard.writeText(currentToken);
      addToast({
        type: 'success',
        title: t('admin:coupons.copied'),
        duration: 2000,
      });
    }
  };

  const handleCopyWaText = () => {
    if (currentToken) {
      const text = `KUPON ${currentToken}`;
      navigator.clipboard.writeText(text);
      addToast({
        type: 'success',
        title: t('admin:coupons.copied'),
        duration: 2000,
      });
    }
  };

  const handlePrint = () => {
    if (qrCodeUrl) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Coupon QR Code - ${currentToken}</title>
              <style>
                body {
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                  margin: 0;
                  font-family: system-ui, -apple-system, sans-serif;
                }
                .container {
                  text-align: center;
                  padding: 40px;
                }
                h1 {
                  font-size: 48px;
                  font-weight: bold;
                  margin-bottom: 20px;
                  letter-spacing: 4px;
                }
                img {
                  width: 400px;
                  height: 400px;
                  margin: 20px 0;
                }
                p {
                  font-size: 24px;
                  color: #666;
                  margin-top: 20px;
                }
                @media print {
                  body { margin: 0; }
                }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>${currentToken}</h1>
                <img src="${qrCodeUrl}" alt="QR Code" />
                <p>Scan to claim coupon</p>
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 250);
      }
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            {t('admin:coupons.issueToken')}
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {t('admin:coupons.issueTokenDescription')}
          </p>
        </div>

        {/* Phone Input & Generate Button */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('admin:coupons.phoneNumber')} ({t('admin:coupons.optional')})
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="5067070403, 05067070403, 905067070403"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:bg-gray-700 dark:text-gray-100"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t('admin:coupons.phoneNumberHelpFormats')}
              </p>
            </div>
            <button
              onClick={handleIssueToken}
              disabled={issueToken.isPending}
              className="w-full px-6 py-4 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg shadow-sm"
            >
              {issueToken.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {t('common:messages.loading')}
                </span>
              ) : (
                t('admin:coupons.generateNewToken')
              )}
            </button>
          </div>
        </div>

        {/* Current Token Display */}
        {currentToken && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-8 space-y-8">
            {/* Token Display */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-6 text-center">
                {t('admin:coupons.currentToken')}
              </h3>
              
              {/* Large Token */}
              <div className="bg-gradient-to-br from-sky-50 to-blue-50 dark:from-gray-700 dark:to-gray-600 border-2 border-sky-300 dark:border-sky-600 rounded-xl p-8 mb-6">
                <p className="text-5xl font-mono font-bold text-gray-900 dark:text-gray-50 text-center tracking-widest">
                  {currentToken}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <button
                  onClick={handleCopyToken}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {t('admin:coupons.copy')}
                </button>
                <button
                  onClick={handleCopyWaText}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  {t('admin:coupons.copyWhatsAppText')}
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  {t('admin:coupons.print')}
                </button>
                <button
                  onClick={handleSendToKiosk}
                  disabled={sendingToKiosk}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
                >
                  {sendingToKiosk ? (
                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  )}
                  {t('admin:coupons.sendToKiosk')}
                </button>
              </div>
            </div>

            {/* Large QR Code */}
            {qrCodeUrl && (
              <div className="flex flex-col items-center border-t border-gray-200 dark:border-gray-700 pt-8">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">
                  {t('admin:coupons.qrCode')}
                </h4>
                <div className="bg-white p-6 border-4 border-gray-300 dark:border-gray-600 rounded-2xl shadow-lg">
                  <img src={qrCodeUrl} alt="QR Code" className="w-96 h-96" />
                </div>
                <p className="mt-4 text-sm text-gray-600 dark:text-gray-400 text-center max-w-md">
                  {t('admin:coupons.qrCodeInstructions')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Recent Tokens */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">
            {t('admin:coupons.recentTokens')}
          </h3>

          {tokensLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t('common:messages.loading')}</p>
            </div>
          ) : tokensError ? (
            <div className="text-center py-8 text-red-600 dark:text-red-400">
              {getErrorMessage(tokensError)}
            </div>
          ) : !recentTokens || recentTokens.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t('admin:coupons.noRecentTokens')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('admin:coupons.token')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('admin:coupons.status')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('admin:coupons.issued')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('admin:coupons.expires')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('admin:coupons.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {recentTokens.map((token: any) => (
                    <tr
                      key={token.token}
                      onClick={() => handleSelectToken(token)}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors ${
                        currentToken === token.token
                          ? 'bg-sky-50 dark:bg-sky-900/30 ring-2 ring-sky-500 ring-inset'
                          : ''
                      } ${token.status === 'used' ? 'opacity-60 cursor-not-allowed' : ''}`}
                      title={token.status === 'used' ? t('admin:coupons.statusUsed') : t('admin:coupons.clickToView')}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
                          {token.token}
                        </span>
                        {currentToken === token.token && (
                          <span className="ml-2 text-xs text-sky-600 dark:text-sky-400">✓</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            token.status === 'used'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : token.status === 'expired'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          }`}
                        >
                          {token.status === 'used'
                            ? t('admin:coupons.statusUsed')
                            : token.status === 'expired'
                              ? t('admin:coupons.statusExpired')
                              : t('admin:coupons.statusIssued')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDateTime(token.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDateTime(token.expiresAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          {token.status === 'issued' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSendTokenToKiosk(token);
                              }}
                              className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 font-medium"
                              title={t('admin:coupons.sendToKiosk')}
                            >
                              📺 {t('admin:coupons.sendToKiosk')}
                            </button>
                          )}
                          {token.status !== 'used' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirm(token.token);
                              }}
                              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-medium"
                            >
                              {t('admin:coupons.delete')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-4">
                {t('admin:coupons.deleteTokenConfirmTitle')}
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                {t('admin:coupons.deleteTokenConfirmMessage')}
              </p>
              <p className="font-mono text-lg font-bold text-gray-900 dark:text-gray-100 mb-6 bg-gray-100 dark:bg-gray-700 p-2 rounded">
                {deleteConfirm}
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  {t('admin:coupons.cancel')}
                </button>
                <button
                  onClick={() => handleDeleteToken(deleteConfirm)}
                  disabled={deleteToken.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleteToken.isPending ? t('admin:coupons.deleting') : t('admin:coupons.yesDelete')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
