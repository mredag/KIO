import { ReactNode, useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import ToastContainer from '../components/ui/Toast';
import Sidebar from '../components/admin/Sidebar';
import Header from '../components/admin/Header';
import SearchModal from '../components/admin/SearchModal';
import { skipLinkClasses } from '../lib/accessibility';
import { prefetchLikelyNextPages } from '../lib/routePrefetch';

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const mainContentRef = useRef<HTMLElement>(null);

  // Ctrl+K keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Prefetch likely next pages when route changes
  useEffect(() => {
    prefetchLikelyNextPages(location.pathname);
  }, [location.pathname]);

  if (!isAuthenticated) {
    return null;
  }

  const handleSkipToContent = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    mainContentRef.current?.focus();
    mainContentRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleToggleCollapse = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const handleMobileMenuToggle = () => {
    setMobileSidebarOpen(!mobileSidebarOpen);
  };

  const handleCloseMobile = () => {
    setMobileSidebarOpen(false);
  };

  const handleSearchClick = () => {
    setSearchModalOpen(true);
  };

  const handleSearchClose = () => {
    setSearchModalOpen(false);
  };

  return (
    <>
      {/* Skip to content link for keyboard navigation */}
      <a
        href="#main-content"
        onClick={handleSkipToContent}
        className={skipLinkClasses}
      >
        Skip to main content
      </a>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex">
        {/* Sidebar */}
        <Sidebar
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleCollapse}
          isMobileOpen={mobileSidebarOpen}
          onCloseMobile={handleCloseMobile}
        />

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <Header
            onMobileMenuToggle={handleMobileMenuToggle}
            onSearchClick={handleSearchClick}
          />

          {/* Main content */}
          <main
            id="main-content"
            ref={mainContentRef}
            tabIndex={-1}
            className="flex-1 overflow-auto focus:outline-none"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
              {children}
            </div>
          </main>
        </div>

        {/* Toast notifications */}
        <ToastContainer />

        {/* Search modal */}
        <SearchModal isOpen={searchModalOpen} onClose={handleSearchClose} />
      </div>
    </>
  );
}
