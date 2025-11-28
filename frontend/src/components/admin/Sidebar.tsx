import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { PrefetchLink } from '../PrefetchLink';

interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  path: string;
  badge?: number | string;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export default function Sidebar({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const { t } = useTranslation('admin');
  const location = useLocation();
  const { theme, setTheme } = useTheme();

  const isActivePath = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  const handleThemeToggle = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  // Navigation groups
  const navGroups: NavGroup[] = [
    {
      id: 'overview',
      label: t('navigation.groups.overview'),
      items: [
        {
          id: 'dashboard',
          label: t('navigation.dashboard'),
          path: '/admin',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          ),
        },
      ],
    },
    {
      id: 'content',
      label: t('navigation.groups.content'),
      items: [
        {
          id: 'massages',
          label: t('navigation.massages'),
          path: '/admin/massages',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          ),
        },
        {
          id: 'surveys',
          label: t('navigation.surveys'),
          path: '/admin/surveys',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          ),
        },
        {
          id: 'responses',
          label: t('navigation.responses'),
          path: '/admin/survey-responses',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
        },
      ],
    },
    {
      id: 'kiosk',
      label: t('navigation.groups.kiosk'),
      items: [
        {
          id: 'kiosk-control',
          label: t('navigation.kioskControl'),
          path: '/admin/kiosk-control',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          ),
        },
      ],
    },
    {
      id: 'coupons',
      label: t('navigation.groups.coupons'),
      items: [
        {
          id: 'issue-coupon',
          label: t('navigation.issueToken'),
          path: '/admin/coupons/issue',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          ),
        },
        {
          id: 'redemptions',
          label: t('navigation.redemptions'),
          path: '/admin/coupons/redemptions',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          ),
        },
        {
          id: 'wallet-lookup',
          label: t('navigation.walletLookup'),
          path: '/admin/coupons/wallet',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          ),
        },
      ],
    },
    {
      id: 'system',
      label: t('navigation.groups.system'),
      items: [
        {
          id: 'settings',
          label: t('navigation.settings'),
          path: '/admin/settings',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
        },
        {
          id: 'backup',
          label: t('navigation.backup'),
          path: '/admin/backup',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          ),
        },
        {
          id: 'logs',
          label: t('navigation.logs'),
          path: '/admin/logs',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
        },
      ],
    },
  ];

  // Render navigation item
  const renderNavItem = (item: NavItem) => {
    const isActive = isActivePath(item.path);
    
    return (
      <PrefetchLink
        key={item.id}
        to={item.path}
        onClick={onCloseMobile}
        className={`
          group flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-sky-400 dark:focus:ring-offset-gray-900
          ${isActive 
            ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400' 
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }
          ${isCollapsed ? 'justify-center' : ''}
        `}
        title={isCollapsed ? item.label : undefined}
        aria-current={isActive ? 'page' : undefined}
      >
        <span className={`flex-shrink-0 ${isActive ? 'text-sky-600 dark:text-sky-400' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'}`}>
          {item.icon}
        </span>
        {!isCollapsed && (
          <>
            <span className="flex-1 text-sm font-medium">{item.label}</span>
            {item.badge && (
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-400">
                {item.badge}
              </span>
            )}
          </>
        )}
      </PrefetchLink>
    );
  };

  // Sidebar content
  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo/Brand */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-gray-200 dark:border-gray-700 ${isCollapsed ? 'justify-center' : ''}`}>
        {!isCollapsed && (
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            SPA Kiosk
          </h1>
        )}
        {isCollapsed && (
          <div className="w-8 h-8 rounded-lg bg-sky-600 dark:bg-sky-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">SK</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navGroups.map((group) => (
          <div key={group.id}>
            {!isCollapsed && (
              <h3 className="px-3 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {group.label}
              </h3>
            )}
            <div className="space-y-1">
              {group.items.map(renderNavItem)}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer with theme toggle and collapse button */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-3 space-y-2">
        {/* Theme toggle */}
        <button
          onClick={handleThemeToggle}
          className={`
            w-full flex items-center gap-3 px-3 py-2 rounded-lg
            text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800
            transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-sky-400 dark:focus:ring-offset-gray-900
            ${isCollapsed ? 'justify-center' : ''}
          `}
          title={isCollapsed ? (theme === 'dark' ? t('theme.light') : t('theme.dark')) : undefined}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span className="flex-shrink-0">
            {theme === 'dark' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </span>
          {!isCollapsed && (
            <span className="text-sm font-medium">
              {theme === 'dark' ? t('theme.light') : t('theme.dark')}
            </span>
          )}
        </button>

        {/* Collapse toggle (desktop only) */}
        <button
          onClick={onToggleCollapse}
          className={`
            hidden md:flex w-full items-center gap-3 px-3 py-2 rounded-lg
            text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800
            transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-sky-400 dark:focus:ring-offset-gray-900
            ${isCollapsed ? 'justify-center' : ''}
          `}
          title={isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!isCollapsed}
        >
          <span className="flex-shrink-0">
            {isCollapsed ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            )}
          </span>
          {!isCollapsed && (
            <span className="text-sm font-medium">{t('sidebar.collapse')}</span>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`
          hidden md:flex flex-col
          bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700
          transition-all duration-200 ease-in-out
          ${isCollapsed ? 'w-20' : 'w-64'}
        `}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-200"
          onClick={onCloseMobile}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={`
          md:hidden fixed inset-y-0 left-0 z-50
          w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700
          transform transition-transform duration-200 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
