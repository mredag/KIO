import { ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';

interface QuickAction {
  id: string;
  label: string;
  icon: ReactNode;
  action: 'navigate' | 'modal';
  target: string;
  variant?: 'primary' | 'secondary' | 'success' | 'warning';
}

interface QuickActionsProps {
  actions: QuickAction[];
  onActionClick?: (action: QuickAction) => void;
}

export function QuickActions({ actions, onActionClick }: QuickActionsProps) {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleActionClick = async (action: QuickAction) => {
    setLoadingAction(action.id);

    try {
      if (action.action === 'navigate') {
        navigate(action.target);
      } else if (action.action === 'modal') {
        // Call the custom handler if provided
        if (onActionClick) {
          await onActionClick(action);
        }
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: t('dashboard.actionFailed'),
        message: t('dashboard.actionFailedMessage', { action: action.label }),
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const variantStyles = {
    primary: 'bg-sky-600 hover:bg-sky-700 text-white dark:bg-sky-500 dark:hover:bg-sky-600',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white dark:bg-gray-500 dark:hover:bg-gray-600',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-600',
    warning: 'bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-500 dark:hover:bg-amber-600',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">
        {t('dashboard.quickActions')}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {actions.map((action) => {
          const isLoading = loadingAction === action.id;
          const variant = action.variant || 'primary';

          return (
            <button
              key={action.id}
              onClick={() => handleActionClick(action)}
              disabled={isLoading}
              className={`
                ${variantStyles[variant]}
                px-4 py-3 rounded-lg font-medium text-sm
                flex items-center justify-center gap-2
                transition-colors duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500
                dark:focus:ring-offset-gray-800
              `}
              aria-label={action.label}
              aria-busy={isLoading}
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>{t('dashboard.processing')}</span>
                </>
              ) : (
                <>
                  <span className="text-xl" aria-hidden="true">{action.icon}</span>
                  <span>{action.label}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
