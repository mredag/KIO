import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SkeletonText } from '../ui/Skeleton';

interface ActivityItem {
  id: string;
  type: 'survey' | 'coupon' | 'kiosk' | 'system';
  message: string;
  timestamp: Date;
  href?: string;
  icon?: ReactNode;
}

interface ActivityFeedProps {
  items: ActivityItem[];
  maxItems?: number;
  isLoading?: boolean;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  return date.toLocaleDateString();
}

const typeIcons: Record<string, ReactNode> = {
  survey: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
      />
    </svg>
  ),
  coupon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
      />
    </svg>
  ),
  kiosk: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  ),
  system: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  ),
};

const typeColors: Record<string, string> = {
  survey: 'text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/30',
  coupon: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30',
  kiosk: 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30',
  system: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30',
};

export function ActivityFeed({ items, maxItems = 10, isLoading = false }: ActivityFeedProps) {
  const navigate = useNavigate();
  const [displayItems, setDisplayItems] = useState<ActivityItem[]>([]);
  const [timestamps, setTimestamps] = useState<Record<string, string>>({});

  // Update relative timestamps every minute
  useEffect(() => {
    const updateTimestamps = () => {
      const newTimestamps: Record<string, string> = {};
      items.forEach((item) => {
        newTimestamps[item.id] = formatRelativeTime(item.timestamp);
      });
      setTimestamps(newTimestamps);
    };

    updateTimestamps();
    const interval = setInterval(updateTimestamps, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [items]);

  // Limit items and sort by timestamp
  useEffect(() => {
    const sorted = [...items]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, maxItems);
    setDisplayItems(sorted);
  }, [items, maxItems]);

  const handleItemClick = (item: ActivityItem) => {
    if (item.href) {
      navigate(item.href);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <SkeletonText width="1/4" size="lg" className="mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-full h-10 w-10" />
              <div className="flex-1">
                <SkeletonText width="3/4" className="mb-2" />
                <SkeletonText width="1/4" size="sm" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">
        Recent Activity
      </h3>
      {displayItems.length === 0 ? (
        <div className="text-center py-8">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600 mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">No recent activity</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayItems.map((item, index) => {
            const isNew = index === 0 && displayItems.length > 1;
            return (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`
                  flex gap-3 p-3 rounded-lg transition-colors duration-200
                  ${item.href ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50' : ''}
                  ${isNew ? 'bg-sky-50 dark:bg-sky-900/20 animate-pulse' : ''}
                `}
                role={item.href ? 'button' : undefined}
                tabIndex={item.href ? 0 : undefined}
                onKeyDown={(e) => {
                  if (item.href && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    handleItemClick(item);
                  }
                }}
              >
                <div
                  className={`
                    flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
                    ${typeColors[item.type] || typeColors.system}
                  `}
                >
                  {item.icon || typeIcons[item.type] || typeIcons.system}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-gray-50 line-clamp-2">
                    {item.message}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {timestamps[item.id] || formatRelativeTime(item.timestamp)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
