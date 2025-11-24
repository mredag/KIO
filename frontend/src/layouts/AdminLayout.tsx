import { ReactNode, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import { useLogout } from '../hooks/useAdminApi';

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { t } = useTranslation('admin');
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useLogout();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
      navigate('/admin/login');
    } catch (error) {
      console.error('Logout failed:', error);
      // Even if API call fails, clear local state and redirect
      navigate('/admin/login');
    }
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const isActivePath = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  if (!isAuthenticated) {
    return null;
  }

  const navLinks = [
    { to: '/admin', label: t('navigation.dashboard') },
    { to: '/admin/massages', label: t('navigation.massages') },
    { to: '/admin/kiosk-control', label: t('navigation.kioskControl') },
    { to: '/admin/surveys', label: t('navigation.surveys') },
    { to: '/admin/survey-responses', label: t('navigation.responses') },
    { to: '/admin/settings', label: t('navigation.settings') },
    { to: '/admin/backup', label: t('navigation.backup') },
    { to: '/admin/logs', label: t('navigation.logs') },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-100 touch-target"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900">
                SPA Kiosk Admin
              </h1>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <span className="text-xs sm:text-sm text-gray-600 hidden sm:inline">
                {user?.username}
              </span>
              <button
                onClick={handleLogout}
                disabled={logout.isPending}
                aria-label={t('aria.logout')}
                className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors touch-target disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {logout.isPending ? t('navigation.logout') + '...' : t('navigation.logout')}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Desktop Navigation */}
      <nav className="hidden md:block bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                aria-label={t('aria.navigateTo', { page: link.label })}
                aria-current={isActivePath(link.to) ? 'page' : undefined}
                className={`px-3 py-4 text-sm font-medium border-b-2 whitespace-nowrap touch-target transition-colors ${
                  isActivePath(link.to)
                    ? 'text-primary-600 border-primary-500'
                    : 'text-gray-700 hover:text-gray-900 border-transparent hover:border-primary-500'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-200 shadow-lg">
          <div className="px-4 py-2 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={closeMobileMenu}
                aria-label={t('aria.navigateTo', { page: link.label })}
                aria-current={isActivePath(link.to) ? 'page' : undefined}
                className={`block px-3 py-3 rounded-md text-base font-medium touch-target transition-colors ${
                  isActivePath(link.to)
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {children}
      </main>
    </div>
  );
}
