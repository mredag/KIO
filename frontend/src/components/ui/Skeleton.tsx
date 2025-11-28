import { ReactNode } from 'react';

interface SkeletonBaseProps {
  className?: string;
  'aria-label'?: string;
  style?: React.CSSProperties;
}

// Base skeleton with pulse animation
function SkeletonBase({ className = '', 'aria-label': ariaLabel, style }: SkeletonBaseProps) {
  return (
    <div
      role="status"
      aria-label={ariaLabel || 'Loading...'}
      className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`}
      style={style}
    />
  );
}

// Text skeleton - for single lines of text
interface SkeletonTextProps extends SkeletonBaseProps {
  width?: 'full' | '3/4' | '1/2' | '1/4' | '1/3' | '2/3';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function SkeletonText({ 
  width = 'full', 
  size = 'md', 
  className = '',
  ...props 
}: SkeletonTextProps) {
  const widthClasses = {
    full: 'w-full',
    '3/4': 'w-3/4',
    '1/2': 'w-1/2',
    '1/4': 'w-1/4',
    '1/3': 'w-1/3',
    '2/3': 'w-2/3',
  };

  const sizeClasses = {
    sm: 'h-3',
    md: 'h-4',
    lg: 'h-5',
    xl: 'h-6',
  };

  return (
    <SkeletonBase 
      className={`${widthClasses[width]} ${sizeClasses[size]} ${className}`}
      {...props}
    />
  );
}

// Card skeleton - for card-shaped content
interface SkeletonCardProps extends SkeletonBaseProps {
  hasHeader?: boolean;
  hasFooter?: boolean;
  lines?: number;
  height?: string;
}

export function SkeletonCard({ 
  hasHeader = true, 
  hasFooter = false, 
  lines = 3,
  height,
  className = '',
  ...props 
}: SkeletonCardProps) {
  return (
    <div 
      role="status"
      aria-label={props['aria-label'] || 'Loading card...'}
      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 ${height || ''} ${className}`}
    >
      {hasHeader && (
        <div className="flex items-center gap-4 mb-4">
          <SkeletonBase className="w-10 h-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <SkeletonText width="1/2" size="lg" />
            <SkeletonText width="1/4" size="sm" />
          </div>
        </div>
      )}
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonText 
            key={i} 
            width={i === lines - 1 ? '2/3' : 'full'} 
          />
        ))}
      </div>
      {hasFooter && (
        <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <SkeletonBase className="h-8 w-20 rounded-md" />
          <SkeletonBase className="h-8 w-20 rounded-md" />
        </div>
      )}
    </div>
  );
}


// Chart skeleton - for chart placeholders
interface SkeletonChartProps extends SkeletonBaseProps {
  type?: 'line' | 'bar';
  height?: string;
}

export function SkeletonChart({ 
  type = 'line', 
  height = 'h-64',
  className = '',
  ...props 
}: SkeletonChartProps) {
  return (
    <div 
      role="status"
      aria-label={props['aria-label'] || 'Loading chart...'}
      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 ${className}`}
    >
      {/* Chart title */}
      <SkeletonText width="1/3" size="lg" className="mb-4" />
      
      {/* Chart area */}
      <div className={`${height} relative overflow-hidden`}>
        {type === 'line' ? (
          // Line chart skeleton
          <div className="absolute inset-0 flex items-end justify-between gap-1 px-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end">
                <SkeletonBase 
                  className="w-full rounded-t"
                  style={{ height: `${30 + Math.random() * 50}%` }}
                />
              </div>
            ))}
          </div>
        ) : (
          // Bar chart skeleton
          <div className="absolute inset-0 flex items-end justify-between gap-2 px-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <SkeletonBase 
                key={i}
                className="flex-1 rounded-t"
                style={{ height: `${20 + Math.random() * 60}%` }}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* X-axis labels */}
      <div className="flex justify-between mt-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <SkeletonText key={i} width="1/4" size="sm" className="w-8" />
        ))}
      </div>
    </div>
  );
}

// Table skeleton - for table placeholders
interface SkeletonTableProps extends SkeletonBaseProps {
  rows?: number;
  columns?: number;
  hasHeader?: boolean;
}

export function SkeletonTable({ 
  rows = 5, 
  columns = 4,
  hasHeader = true,
  className = '',
  ...props 
}: SkeletonTableProps) {
  return (
    <div 
      role="status"
      aria-label={props['aria-label'] || 'Loading table...'}
      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}
    >
      {/* Table header */}
      {hasHeader && (
        <div className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          {Array.from({ length: columns }).map((_, i) => (
            <SkeletonText key={i} width="full" size="sm" className="flex-1" />
          ))}
        </div>
      )}
      
      {/* Table rows */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex gap-4 p-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <SkeletonText 
                key={colIndex} 
                width={colIndex === 0 ? '3/4' : 'full'} 
                className="flex-1" 
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// KPI Card skeleton - for dashboard KPI cards
interface SkeletonKPICardProps extends SkeletonBaseProps {
  hasIcon?: boolean;
  hasTrend?: boolean;
}

export function SkeletonKPICard({ 
  hasIcon = true, 
  hasTrend = true,
  className = '',
  ...props 
}: SkeletonKPICardProps) {
  return (
    <div 
      role="status"
      aria-label={props['aria-label'] || 'Loading KPI...'}
      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <SkeletonText width="1/2" size="sm" className="mb-2" />
          <SkeletonText width="1/3" size="xl" className="mb-2" />
          {hasTrend && <SkeletonText width="1/4" size="sm" />}
        </div>
        {hasIcon && (
          <SkeletonBase className="w-12 h-12 rounded-lg" />
        )}
      </div>
    </div>
  );
}

// Wrapper for showing skeleton or content
interface SkeletonWrapperProps {
  isLoading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
}

export function SkeletonWrapper({ isLoading, skeleton, children }: SkeletonWrapperProps) {
  if (isLoading) {
    return <>{skeleton}</>;
  }
  return <>{children}</>;
}

export default {
  Text: SkeletonText,
  Card: SkeletonCard,
  Chart: SkeletonChart,
  Table: SkeletonTable,
  KPICard: SkeletonKPICard,
  Wrapper: SkeletonWrapper,
};
