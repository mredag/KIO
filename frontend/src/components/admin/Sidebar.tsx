import { ReactNode, useState } from 'react';
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

const I = (d: string) => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={d} />
  </svg>
);

export default function Sidebar({ isCollapsed, onToggleCollapse, isMobileOpen, onCloseMobile }: SidebarProps) {
  const { t } = useTranslation('admin');
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    command: true,
    operations: true,
    channels: true,
    content: true,
    business: true,
    system: true,
  });

  const isActive = (path: string) => (path === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(path));
  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const groups: NavGroup[] = [
    {
      id: 'command',
      label: 'MISSION CONTROL',
      items: [
        { id: 'dashboard', label: 'Dashboard', path: '/admin', icon: I('M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z') },
        { id: 'mc-activity', label: 'Canli Akis', path: '/admin/mc/activity', icon: I('M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z') },
        { id: 'mc-workshop', label: 'Workshop', path: '/admin/mc/workshop', icon: I('M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01') },
        { id: 'mc-agents', label: 'Ajanlar', path: '/admin/mc/agents', icon: I('M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z') },
        { id: 'mc-autopilot', label: 'AutoPilot', path: '/admin/mc/autopilot', icon: I('M13 10V3L4 14h7v7l9-11h-7z') },
        { id: 'mc-cron', label: 'Zamanlayici', path: '/admin/mc/cron', icon: I('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z') },
      ],
    },
    {
      id: 'operations',
      label: 'OPERASYONLAR',
      items: [
        { id: 'mc-jarvis', label: 'Jarvis AI', path: '/admin/mc/jarvis', icon: I('M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z') },
        { id: 'workflow-test', label: 'DM Simulator', path: '/admin/workflow-test', icon: I('M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z') },
        { id: 'mc-costs', label: 'API Kullanimi', path: '/admin/mc/costs', icon: I('M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z') },
        { id: 'mc-policies', label: 'Politikalar', path: '/admin/mc/policies', icon: I('M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z') },
        { id: 'mc-gateways', label: 'OpenClaw Ops', path: '/admin/mc/gateways', icon: I('M4 7h16M4 12h8m-8 5h16M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14') },
      ],
    },
    {
      id: 'channels',
      label: 'KANALLAR',
      items: [
        { id: 'mc-conversations', label: 'Konusmalar', path: '/admin/mc/conversations', icon: I('M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z') },
        { id: 'dm-kontrol', label: 'DM Kontrol', path: '/admin/mc/dm-kontrol', icon: I('M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z') },
        { id: 'dm-conduct', label: 'DM Davranis', path: '/admin/mc/dm-conduct', icon: I('M12 8c-1.657 0-3 .672-3 1.5S10.343 11 12 11s3 .672 3 1.5S13.657 14 12 14s-3 .672-3 1.5S10.343 17 12 17s3-.672 3-1.5M5 6h14M5 18h14') },
        { id: 'dm-review', label: 'DM Review', path: '/admin/mc/dm-review', icon: I('M9 12h6m-6 4h4m5 3H6a2 2 0 01-2-2V7a2 2 0 012-2h3l2-2h2l2 2h3a2 2 0 012 2v10a2 2 0 01-2 2z') },
        { id: 'interactions', label: 'Etkilesimler', path: '/admin/interactions', icon: I('M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z') },
      ],
    },
    {
      id: 'content',
      label: 'ICERIK',
      items: [
        { id: 'knowledge-base', label: 'Bilgi Bankasi', path: '/admin/knowledge-base', icon: I('M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253') },
        { id: 'massages', label: t('navigation.massages'), path: '/admin/massages', icon: I('M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10') },
        { id: 'surveys', label: t('navigation.surveys'), path: '/admin/surveys', icon: I('M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2') },
        { id: 'responses', label: t('navigation.responses'), path: '/admin/survey-responses', icon: I('M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z') },
      ],
    },
    {
      id: 'business',
      label: 'ISLETME',
      items: [
        { id: 'issue-coupon', label: t('navigation.issueToken'), path: '/admin/coupons/issue', icon: I('M12 4v16m8-8H4') },
        { id: 'redemptions', label: t('navigation.redemptions'), path: '/admin/coupons/redemptions', icon: I('M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4') },
        { id: 'wallet-lookup', label: t('navigation.walletLookup'), path: '/admin/coupons/wallet', icon: I('M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z') },
        { id: 'coupon-settings', label: t('navigation.couponSettings'), path: '/admin/coupons/settings', icon: I('M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4') },
        { id: 'kiosk-control', label: t('navigation.kioskControl'), path: '/admin/kiosk-control', icon: I('M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z') },
      ],
    },
    {
      id: 'system',
      label: 'SISTEM',
      items: [
        { id: 'services', label: t('navigation.services'), path: '/admin/services', icon: I('M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01') },
        { id: 'settings', label: t('navigation.settings'), path: '/admin/settings', icon: I('M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z') },
        { id: 'backup', label: t('navigation.backup'), path: '/admin/backup', icon: I('M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12') },
        { id: 'logs', label: t('navigation.logs'), path: '/admin/logs', icon: I('M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z') },
      ],
    },
  ];

  const renderItem = (item: NavItem) => {
    const active = isActive(item.path);
    return (
      <PrefetchLink
        key={item.id}
        to={item.path}
        onClick={onCloseMobile}
        className={`group flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-sky-500/50 ${active ? 'glass-nav-active text-sky-400' : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'} ${isCollapsed ? 'justify-center' : ''}`}
        title={isCollapsed ? item.label : undefined}
        aria-current={active ? 'page' : undefined}
      >
        <span className={`flex-shrink-0 ${active ? 'text-sky-400' : 'text-gray-500 group-hover:text-gray-300'}`}>{item.icon}</span>
        {!isCollapsed && (
          <>
            <span className="flex-1 text-[13px] font-medium truncate">{item.label}</span>
            {item.badge ? <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/20">{item.badge}</span> : null}
          </>
        )}
      </PrefetchLink>
    );
  };

  const content = (
    <div className="flex flex-col h-full">
      <div className={`flex items-center gap-2.5 px-4 py-4 ${isCollapsed ? 'justify-center' : ''}`}>
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
        </div>
        {!isCollapsed && (
          <div>
            <h1 className="text-sm font-semibold text-gray-100 tracking-tight">Mission Control</h1>
            <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">SPA Kiosk</p>
          </div>
        )}
      </div>
      <div className="mx-3 border-t border-white/[0.06]" />
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4 sidebar-scroll">
        {groups.map((group) => {
          const open = expanded[group.id] !== false;
          return (
            <div key={group.id}>
              {!isCollapsed && (
                <button onClick={() => toggle(group.id)} className="w-full flex items-center justify-between px-3 mb-1">
                  <span className="mc-label text-[9px]">{group.label}</span>
                  <svg className={`w-3 h-3 text-gray-600 transition-transform duration-200 ${open ? '' : '-rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}
              {(isCollapsed || open) ? <div className="space-y-0.5">{group.items.map(renderItem)}</div> : null}
            </div>
          );
        })}
      </nav>
      <div className="mx-3 border-t border-white/[0.06]" />
      <div className="p-2 space-y-0.5">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-gray-400 hover:text-gray-200 hover:bg-white/[0.04] transition-all duration-200 ${isCollapsed ? 'justify-center' : ''}`}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark'
            ? I('M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z')
            : I('M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z')}
          {!isCollapsed ? <span className="text-[13px] font-medium">{theme === 'dark' ? t('theme.light') : t('theme.dark')}</span> : null}
        </button>
        <button
          onClick={onToggleCollapse}
          className={`hidden md:flex w-full items-center gap-2.5 px-3 py-1.5 rounded-md text-gray-400 hover:text-gray-200 hover:bg-white/[0.04] transition-all duration-200 ${isCollapsed ? 'justify-center' : ''}`}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? I('M13 5l7 7-7 7M5 5l7 7-7 7') : I('M11 19l-7-7 7-7m8 14l-7-7 7-7')}
          {!isCollapsed ? <span className="text-[13px] font-medium">{t('sidebar.collapse')}</span> : null}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className={`hidden md:flex flex-col glass-sidebar transition-all duration-300 ease-in-out ${isCollapsed ? 'w-16' : 'w-56'}`}>{content}</aside>
      {isMobileOpen ? <div className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onCloseMobile} /> : null}
      <aside className={`md:hidden fixed inset-y-0 left-0 z-50 w-56 glass-sidebar transform transition-transform duration-300 ease-in-out ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>{content}</aside>
    </>
  );
}
