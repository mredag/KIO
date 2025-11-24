import React from 'react';
import { useTranslation } from 'react-i18next';

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  title,
  message,
  onRetry,
  className = ''
}) => {
  const { t } = useTranslation('common');
  return (
    <div className={`bg-red-50 border-l-4 border-red-500 p-6 rounded-lg ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg 
            className="h-8 w-8 text-red-500" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
        </div>
        <div className="ml-4 flex-1">
          <h3 className="text-xl font-semibold text-red-800">
            {title || t('messages.error')}
          </h3>
          <p className="mt-2 text-lg text-red-700">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-4 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-lg font-medium"
            >
              {t('messages.tryAgain')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorMessage;
