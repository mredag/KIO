import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface KPICardProps {
  title: string;
  value: number | string;
  icon: ReactNode;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
  };
  status?: 'normal' | 'warning' | 'critical' | 'success';
  href?: string;
  isLoading?: boolean;
}

export function KPICard({
  title,
  value,
  icon,
  trend,
  status = 'normal',
  href,
  isLoading = false,
}: KPICardProps) {
  const navigate = useNavigate();
  const [displayValue, setDisplayValue] = useState<number | string>(0);

  // Animated number counting
  useEffect(() => {
    if (isLoading || typeof value !== 'number') {
      setDisplayValue(value);
      return;
    }

    const duration = 500; // 500ms animation
    const steps = 30;
    const increment = value / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current = Math.min(current + increment, value);
      setDisplayValue(Math.round(current));

      if (step >= steps || current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value, isLoading]);

  const handleClick = () => {
    if (href) {
      navigate(href);
    }
  };

  const statusStyles = {
    normal: 'border-gray-200 dark:border-gray-700',
    warning: 'border-amber-500 dark:border-amber-400',
    critical: 'border-red-500 dark:border-red-400',
    success: 'border-emerald-500 dark:border-emerald-400',
  };

  const statusIconStyles = {
    normal: 'text-sky-600 dark:text-sky-400',
    warning: 'text-amber-600 dark:text-amber-400',
    critical: 'text-red-600 dark:text-red-400',
    success: 'text-emerald-600 dark:text-emerald-400',
  };

  const trendStyles = {
    up: 'text-emerald-600 dark:text-emerald-400',
    down: 'text-red-600 dark:text-red-400',
    neutral: 'text-gray-500 dark:text-gray-400',
  };

  const trendIcons = {
    up: '↑',
    down: '↓',
    neutral: '→',
  };

  const statusLabels = {
    normal: '',
    warning: 'Warning',
    critical: 'Critical',
    success: 'Success',
  };

  return (
    <div
      className={`
        bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border-2
        ${statusStyles[status]}
        ${href ? 'cursor-pointer hover:shadow-md transition-shadow duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-sky-400 dark:focus:ring-offset-gray-900' : ''}
        ${isLoading ? 'animate-pulse' : ''}
      `}
      onClick={handleClick}
      role={href ? 'button' : undefined}
      tabIndex={href ? 0 : undefined}
      onKeyDown={(e) => {
        if (href && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`${title}: ${displayValue}${statusLabels[status] ? ` - ${statusLabels[status]}` : ''}${trend ? ` - ${trend.direction === 'up' ? 'Increased' : trend.direction === 'down' ? 'Decreased' : 'No change'} by ${Math.abs(trend.value)}%` : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-semibold text-gray-900 dark:text-gray-50">
              {isLoading ? '—' : displayValue}
            </p>
            {trend && !isLoading && (
              <span className={`text-sm font-medium ${trendStyles[trend.direction]}`}>
                {trendIcons[trend.direction]} {Math.abs(trend.value)}%
              </span>
            )}
          </div>
        </div>
        <div className={`text-3xl ${statusIconStyles[status]}`}>
          {icon}
        </div>
      </div>
      {status === 'warning' && (
        <div className="mt-3 flex items-center gap-1 text-amber-600 dark:text-amber-400" role="status">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-xs font-medium">Requires attention</span>
        </div>
      )}
      {status === 'critical' && (
        <span className="sr-only">Critical status</span>
      )}
      {status === 'success' && (
        <span className="sr-only">Success status</span>
      )}
    </div>
  );
}
