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
    } catch (error) {
      console.error('Logout failed:', error);
      navigate('/admin/login');
    }
  };

  // Generate breadcrumbs based on current path
  const getBreadcrumbs = (): BreadcrumbItem[] => {
    const path = location.pathname;
    
    // Dashboard root - no breadcrumbs
    if (path === '/admin' || path === '/admin/') {
      return [];
    }

    const breadcrumbs: BreadcrumbItem[] = [
      { label: t('navigation.dashboard'), href: '/admin' }
    ];

    // Map paths to breadcrumb labels
    const pathMap: Record<string, string> = {
      '/admin/massages': t('navigation.massages'),
      '/admin/surveys': t('navigation.surveys'),
      '/admin/survey-responses': t('navigation.responses'),
      '/admin/kiosk-control': t('navigation.kioskControl'),
      '/admin/coupons/issue': t('navigation.issueToken'),
      '/admin/coupons/redemptions': t('navigation.redemptions'),
      '/admin/coupons/wallet': t('navigation.walletLookup'),
      '/admin/settings': t('navigation.settings'),
      '/admin/backup': t('navigation.backup'),
      '/admin/logs': t('navigation.logs'),
    };

    // Check for exact match
    if (pathMap[path]) {
      breadcrumbs.push({ label: pathMap[path] });
      return breadcrumbs;
    }

    // Handle nested paths (e.g., /admin/massages/new, /admin/massages/123)
    const segments = path.split('/').filter(Boolean);
    
    if (segments.length >= 2) {
      const parentPath = `/${segments.slice(0, -1).join('/')}`;
      
      if (pathMap[parentPath]) {
        breadcrumbs.push({ label: pathMap[parentPath], href: parentPath });
        
        // Add current page label
        const lastSegment = segments[segments.length - 1];
        if (lastSegment === 'new') {
          breadcrumbs.push({ label: t('common.new') || 'New' });
        } else if (!isNaN(Number(lastSegment))) {
          breadcrumbs.push({ label: t('common.edit') || 'Edit' });
        } else {
          breadcrumbs.push({ label: lastSegment });
        }
      }
    }

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left side: Mobile menu button + Breadcrumbs */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {/* Mobile menu button */}
            <button
              onClick={onMobileMenuToggle}
              className="md:hidden p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-sky-400 dark:focus:ring-offset-gray-900"
              aria-label="Toggle menu"
              aria-expanded="false"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Breadcrumbs */}
            {breadcrumbs.length > 0 && (
              <nav className="flex items-center space-x-2 min-w-0" aria-label="Breadcrumb">
                <ol className="flex items-center space-x-2 min-w-0">
                  {breadcrumbs.map((crumb, index) => {
                    const isLast = index === breadcrumbs.length - 1;
                    const isFirst = index === 0;
                    
                    return (
                      <li key={index} className="flex items-center space-x-2 min-w-0">
                        {!isFirst && (
                          <svg
                            className="w-4 h-4 text-gray-400 dark:text-gray-600 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                        {crumb.href && !isLast ? (
                          <Link
                            to={crumb.href}
                            className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors truncate"
                          >
                            {crumb.label}
                          </Link>
                        ) : (
                          <span
                            className={`text-sm font-medium truncate ${
                              isLast
                                ? 'text-gray-900 dark:text-gray-100'
                                : 'text-gray-600 dark:text-gray-400'
                            }`}
                            aria-current={isLast ? 'page' : undefined}
                          >
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

          {/* Right side: Search + User menu */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Search button */}
            {onSearchClick && (
              <button
                onClick={onSearchClick}
                className="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-sky-400 dark:focus:ring-offset-gray-900"
                aria-label="Search"
                title="Search (Ctrl+K)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            )}

            {/* User menu dropdown */}
            <div className="relative group">
              <button
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-sky-400 dark:focus:ring-offset-gray-900"
                aria-label="User menu"
                aria-haspopup="true"
                aria-expanded="false"
              >
                <div className="w-8 h-8 rounded-full bg-sky-600 dark:bg-sky-500 flex items-center justify-center">
                  <span className="text-white font-medium text-sm">
                    {user?.username?.charAt(0).toUpperCase() || 'A'}
                  </span>
                </div>
                <span className="hidden sm:inline text-sm font-medium">
                  {user?.username}
                </span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown menu */}
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="py-1">
                  <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {user?.username}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Administrator
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    disabled={logout.isPending}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {logout.isPending ? t('navigation.logout') + '...' : t('navigation.logout')}
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
