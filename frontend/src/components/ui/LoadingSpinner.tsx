import React from 'react';
import { useTranslation } from 'react-i18next';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md',
  className = '' 
}) => {
  const { t } = useTranslation('common');
  
  const sizeClasses = {
    sm: 'h-8 w-8 border-2',
    md: 'h-16 w-16 border-4',
    lg: 'h-24 w-24 border-4'
  };

  return (
    <div className={`flex items-center justify-center p-8 ${className}`}>
      <div 
        className={`animate-spin rounded-full border-blue-600 border-t-transparent ${sizeClasses[size]}`}
        role="status"
        aria-label={t('messages.loading')}
      >
        <span className="sr-only">{t('messages.loading')}</span>
      </div>
    </div>
  );
};

export default LoadingSpinner;
