import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMassages, useSurveyTemplates } from '../../hooks/useAdminApi';
import { trapFocus, restoreFocus } from '../../lib/accessibility';

interface SearchResult {
  id: string;
  type: 'massage' | 'survey' | 'setting' | 'page';
  title: string;
  description?: string;
  href: string;
  icon?: string;
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);
  
  // Fetch data for search
  const { data: massages } = useMassages();
  const { data: surveys } = useSurveyTemplates();

  // Debounced search query
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Reset state when modal opens/closes and manage focus
  useEffect(() => {
    if (isOpen) {
      // Store previously focused element
      previouslyFocusedElement.current = document.activeElement as HTMLElement;
      
      setQuery('');
      setSelectedIndex(0);
      
      // Focus input after a short delay to ensure modal is rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      // Restore focus when modal closes
      restoreFocus(previouslyFocusedElement.current);
    }
  }, [isOpen]);

  // Build search results
  const getSearchResults = useCallback((): SearchResult[] => {
    if (!debouncedQuery || debouncedQuery.trim().length === 0) {
      return [];
    }

    const searchTerm = debouncedQuery.toLowerCase().trim();
    const results: SearchResult[] = [];

    // Search massages
    if (massages) {
      massages.forEach((massage) => {
        const matchesName = massage.name.toLowerCase().includes(searchTerm);
        const matchesDescription = massage.shortDescription?.toLowerCase().includes(searchTerm);
        
        if (matchesName || matchesDescription) {
          results.push({
            id: massage.id,
            type: 'massage',
            title: massage.name,
            description: massage.shortDescription,
            href: `/admin/massages/${massage.id}/edit`,
            icon: '💆',
          });
        }
      });
    }

    // Search surveys
    if (surveys) {
      surveys.forEach((survey) => {
        const matchesName = survey.name.toLowerCase().includes(searchTerm);
        const matchesTitle = survey.title?.toLowerCase().includes(searchTerm);
        
        if (matchesName || matchesTitle) {
          results.push({
            id: survey.id,
            type: 'survey',
            title: survey.name,
            description: survey.title,
            href: `/admin/surveys/${survey.id}`,
            icon: '📋',
          });
        }
      });
    }

    // Search settings pages
    const settingsPages = [
      { title: t('settings.timingSettings'), href: '/admin/settings', keywords: ['timing', 'timeout', 'duration', 'slideshow', 'survey'] },
      { title: t('settings.googleReviewSettings'), href: '/admin/settings', keywords: ['google', 'review', 'qr'] },
      { title: t('settings.sheetsIntegration'), href: '/admin/settings', keywords: ['sheets', 'integration', 'sync'] },
      { title: t('settings.passwordChange'), href: '/admin/settings', keywords: ['password', 'security'] },
    ];

    settingsPages.forEach((page) => {
      const matchesTitle = page.title.toLowerCase().includes(searchTerm);
      const matchesKeywords = page.keywords.some(keyword => keyword.includes(searchTerm));
      
      if (matchesTitle || matchesKeywords) {
        results.push({
          id: page.href,
          type: 'setting',
          title: page.title,
          href: page.href,
          icon: '⚙️',
        });
      }
    });

    // Search admin pages
    const adminPages = [
      { title: t('navigation.dashboard'), href: '/admin', keywords: ['dashboard', 'home', 'overview'] },
      { title: t('navigation.massages'), href: '/admin/massages', keywords: ['massage', 'services', 'menu'] },
      { title: t('navigation.surveys'), href: '/admin/surveys', keywords: ['survey', 'feedback', 'questionnaire'] },
      { title: t('navigation.responses'), href: '/admin/survey-responses', keywords: ['response', 'answer', 'feedback'] },
      { title: t('navigation.kioskControl'), href: '/admin/kiosk-control', keywords: ['kiosk', 'mode', 'display'] },
      { title: t('navigation.issueToken'), href: '/admin/coupons/issue', keywords: ['coupon', 'token', 'issue', 'qr'] },
      { title: t('navigation.redemptions'), href: '/admin/coupons/redemptions', keywords: ['redemption', 'redeem', 'claim'] },
      { title: t('navigation.walletLookup'), href: '/admin/coupons/wallet', keywords: ['wallet', 'balance', 'lookup'] },
      { title: t('navigation.settings'), href: '/admin/settings', keywords: ['settings', 'configuration', 'preferences'] },
      { title: t('navigation.backup'), href: '/admin/backup', keywords: ['backup', 'restore', 'export'] },
      { title: t('navigation.logs'), href: '/admin/logs', keywords: ['logs', 'system', 'errors'] },
    ];

    adminPages.forEach((page) => {
      const matchesTitle = page.title.toLowerCase().includes(searchTerm);
      const matchesKeywords = page.keywords.some(keyword => keyword.includes(searchTerm));
      
      if (matchesTitle || matchesKeywords) {
        results.push({
          id: page.href,
          type: 'page',
          title: page.title,
          href: page.href,
          icon: '📄',
        });
      }
    });

    return results;
  }, [debouncedQuery, massages, surveys, t]);

  const searchResults = getSearchResults();

  // Group results by type
  const groupedResults = {
    massages: searchResults.filter(r => r.type === 'massage'),
    surveys: searchResults.filter(r => r.type === 'survey'),
    settings: searchResults.filter(r => r.type === 'setting'),
    pages: searchResults.filter(r => r.type === 'page'),
  };

  const allResults = [
    ...groupedResults.massages,
    ...groupedResults.surveys,
    ...groupedResults.settings,
    ...groupedResults.pages,
  ];

  // Handle keyboard navigation and focus trapping
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      // Handle focus trapping for Tab key
      if (e.key === 'Tab' && modalRef.current) {
        trapFocus(modalRef.current, e);
        return;
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => 
            prev < allResults.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (allResults[selectedIndex]) {
            handleSelect(allResults[selectedIndex]);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, allResults, onClose]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [debouncedQuery]);

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current) {
      const selectedElement = resultsRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      );
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }
  }, [selectedIndex]);

  const handleSelect = (result: SearchResult) => {
    navigate(result.href);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black bg-opacity-50 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[600px] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200"
      >
        {/* Search Input */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search.placeholder') || 'Search massages, surveys, settings...'}
              className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-lg"
              aria-label="Search"
              aria-describedby="search-modal-title"
              autoComplete="off"
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded">
              ESC
            </kbd>
          </div>
        </div>

        {/* Results */}
        <div
          ref={resultsRef}
          className="flex-1 overflow-y-auto p-2"
        >
          {query.trim().length === 0 ? (
            // Empty state - show suggestions
            <div className="p-8 text-center">
              <svg
                className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                {t('search.emptyTitle') || 'Search anything'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {t('search.emptyDescription') || 'Try searching for massages, surveys, or settings'}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <span className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
                  {t('navigation.massages')}
                </span>
                <span className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
                  {t('navigation.surveys')}
                </span>
                <span className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
                  {t('navigation.settings')}
                </span>
              </div>
            </div>
          ) : allResults.length === 0 ? (
            // No results found
            <div className="p-8 text-center">
              <svg
                className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                {t('search.noResultsTitle') || 'No results found'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('search.noResultsDescription') || 'Try different keywords or check your spelling'}
              </p>
            </div>
          ) : (
            // Display grouped results
            <div className="space-y-4">
              {groupedResults.massages.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('navigation.massages')} ({groupedResults.massages.length})
                  </div>
                  <div className="space-y-1">
                    {groupedResults.massages.map((result) => {
                      const globalIndex = allResults.indexOf(result);
                      return (
                        <button
                          key={result.id}
                          data-index={globalIndex}
                          onClick={() => handleSelect(result)}
                          className={`w-full text-left px-3 py-3 rounded-lg transition-colors ${
                            selectedIndex === globalIndex
                              ? 'bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-2xl flex-shrink-0">{result.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                {result.title}
                              </div>
                              {result.description && (
                                <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                  {result.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {groupedResults.surveys.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('navigation.surveys')} ({groupedResults.surveys.length})
                  </div>
                  <div className="space-y-1">
                    {groupedResults.surveys.map((result) => {
                      const globalIndex = allResults.indexOf(result);
                      return (
                        <button
                          key={result.id}
                          data-index={globalIndex}
                          onClick={() => handleSelect(result)}
                          className={`w-full text-left px-3 py-3 rounded-lg transition-colors ${
                            selectedIndex === globalIndex
                              ? 'bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-2xl flex-shrink-0">{result.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                {result.title}
                              </div>
                              {result.description && (
                                <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                  {result.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {groupedResults.settings.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('navigation.settings')} ({groupedResults.settings.length})
                  </div>
                  <div className="space-y-1">
                    {groupedResults.settings.map((result) => {
                      const globalIndex = allResults.indexOf(result);
                      return (
                        <button
                          key={result.id}
                          data-index={globalIndex}
                          onClick={() => handleSelect(result)}
                          className={`w-full text-left px-3 py-3 rounded-lg transition-colors ${
                            selectedIndex === globalIndex
                              ? 'bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-2xl flex-shrink-0">{result.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                {result.title}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {groupedResults.pages.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('search.pages') || 'Pages'} ({groupedResults.pages.length})
                  </div>
                  <div className="space-y-1">
                    {groupedResults.pages.map((result) => {
                      const globalIndex = allResults.indexOf(result);
                      return (
                        <button
                          key={result.id}
                          data-index={globalIndex}
                          onClick={() => handleSelect(result)}
                          className={`w-full text-left px-3 py-3 rounded-lg transition-colors ${
                            selectedIndex === globalIndex
                              ? 'bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-2xl flex-shrink-0">{result.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                {result.title}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with keyboard hints */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs font-semibold">
                  ↑↓
                </kbd>
                <span>{t('search.navigate') || 'Navigate'}</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs font-semibold">
                  ↵
                </kbd>
                <span>{t('search.select') || 'Select'}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs font-semibold">
                ESC
              </kbd>
              <span>{t('search.close') || 'Close'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
