import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { useLogout } from '../../hooks/useAdminApi';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface HeaderProps {
  onSearchClick?: () => void;
  onMobileMenuToggle?: () => void;
}

export default function Header({ onSearchClick, onMobileMenuToggle }: HeaderProps) {
  const { t } = useTranslation('admin');
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useLogout();

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
      navigate('/admin/login');
    } catch {
      navigate('/admin/login');
    }
  };

  const getBreadcrumbs = (): BreadcrumbItem[] => {
    const path = location.pathname;
    if (path === '/admin' || path === '/admin/') return [];

    const breadcrumbs: BreadcrumbItem[] = [
      { label: 'Dashboard', href: '/admin' }
    ];

    const pathMap: Record<string, string> = {
      '/admin/massages': t('navigation.massages'),
      '/admin/surveys': t('navigation.surveys'),
      '/admin/survey-responses': t('navigation.responses'),
      '/admin/kiosk-control': t('navigation.kioskControl'),
      '/admin/coupons/issue': t('navigation.issueToken'),
      '/admin/coupons/redemptions': t('navigation.redemptions'),
      '/admin/coupons/wallet': t('navigation.walletLookup'),
      '/admin/coupons/settings': t('navigation.couponSettings'),
      '/admin/settings': t('navigation.settings'),
      '/admin/backup': t('navigation.backup'),
      '/admin/logs': t('navigation.logs'),
      '/admin/interactions': 'Etkileşimler',
      '/admin/services': t('navigation.services'),
      '/admin/knowledge-base': 'Bilgi Bankası',
      '/admin/ai-prompts': 'AI Promptları',
      '/admin/workflow-test': 'DM Simülatör',
      '/admin/blocked-users': 'Engelli Kullanıcılar',
      '/admin/suspicious-users': 'Şüpheli Kullanıcılar',
      '/admin/mc': 'Mission Control',
      '/admin/mc/workshop': 'Workshop',
      '/admin/mc/agents': 'Ajanlar',
      '/admin/mc/conversations': 'Konuşmalar',
      '/admin/mc/costs': 'API Kullanımı',
      '/admin/mc/documents': 'Dokümanlar',
      '/admin/mc/policies': 'Politikalar',
      '/admin/mc/jarvis': 'Jarvis AI',
      '/admin/mc/dm-kontrol': 'DM Kontrol',
      '/admin/mc/dm-conduct': 'DM Davranis',
      '/admin/mc/autopilot': 'AutoPilot',
      '/admin/mc/activity': 'Canli Akis',
      '/admin/mc/cron': 'Zamanlayici',
    };

    if (pathMap[path]) {
      breadcrumbs.push({ label: pathMap[path] });
      return breadcrumbs;
    }

    const segments = path.split('/').filter(Boolean);
    if (segments.length >= 2) {
      const parentPath = `/${segments.slice(0, -1).join('/')}`;
      if (pathMap[parentPath]) {
        breadcrumbs.push({ label: pathMap[parentPath], href: parentPath });
        const lastSegment = segments[segments.length - 1];
        if (lastSegment === 'new') breadcrumbs.push({ label: t('common.new') || 'Yeni' });
        else if (!isNaN(Number(lastSegment))) breadcrumbs.push({ label: t('common.edit') || 'Düzenle' });
        else breadcrumbs.push({ label: lastSegment });
      }
    }
    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="glass-header sticky top-0 z-30">
      <div className="px-4 sm:px-6">
        <div className="flex items-center justify-between h-12">
          {/* Left: Mobile menu + Breadcrumbs */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={onMobileMenuToggle}
              className="md:hidden p-1.5 rounded-md text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] transition-colors"
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {breadcrumbs.length > 0 && (
              <nav className="flex items-center min-w-0" aria-label="Breadcrumb">
                <ol className="flex items-center gap-1.5 min-w-0">
                  {breadcrumbs.map((crumb, index) => {
                    const isLast = index === breadcrumbs.length - 1;
                    return (
                      <li key={index} className="flex items-center gap-1.5 min-w-0">
                        {index > 0 && (
                          <svg className="w-3 h-3 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                        {crumb.href && !isLast ? (
                          <Link to={crumb.href} className="text-xs text-gray-500 hover:text-gray-300 transition-colors truncate">
                            {crumb.label}
                          </Link>
                        ) : (
                          <span className={`text-xs truncate ${isLast ? 'text-gray-200 font-medium' : 'text-gray-500'}`} aria-current={isLast ? 'page' : undefined}>
                            {crumb.label}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </nav>
            )}
          </div>

          {/* Right: Search + User */}
          <div className="flex items-center gap-1.5">
            {onSearchClick && (
              <button
                onClick={onSearchClick}
                className="flex items-center gap-2 px-2.5 py-1 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/[0.06] transition-colors"
                aria-label="Search"
                title="Ctrl+K"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <kbd className="hidden sm:inline text-[10px] font-mono text-gray-600 bg-white/[0.06] px-1.5 py-0.5 rounded border border-white/[0.08]">⌘K</kbd>
              </button>
            )}

            <div className="relative group">
              <button
                className="flex items-center gap-2 px-2 py-1 rounded-md text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] transition-colors"
                aria-label="User menu"
                aria-haspopup="true"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center">
                  <span className="text-white font-medium text-[10px]">
                    {user?.username?.charAt(0).toUpperCase() || 'A'}
                  </span>
                </div>
                <span className="hidden sm:inline text-xs font-medium text-gray-300">
                  {user?.username}
                </span>
              </button>

              <div className="absolute right-0 mt-1 w-44 glass-dropdown opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="py-1">
                  <div className="px-3 py-2 border-b border-white/[0.06]">
                    <p className="text-xs font-medium text-gray-200">{user?.username}</p>
                    <p className="text-[10px] text-gray-500 font-mono uppercase">Administrator</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    disabled={logout.isPending}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] transition-colors disabled:opacity-50"
                  >
                    {logout.isPending ? 'Çıkış...' : t('navigation.logout')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
