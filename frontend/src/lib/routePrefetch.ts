/**
 * Route prefetching utilities for performance optimization
 * Implements prefetch on link hover and likely next pages
 */

// Map of routes to their likely next pages
const LIKELY_NEXT_PAGES: Record<string, string[]> = {
  '/admin': [
    '/admin/massages',
    '/admin/surveys',
    '/admin/kiosk-control',
    '/admin/survey-responses',
  ],
  '/admin/massages': ['/admin/massages/new', '/admin'],
  '/admin/surveys': ['/admin/survey-responses', '/admin/surveys/new', '/admin'],
  '/admin/survey-responses': ['/admin/surveys', '/admin'],
  '/admin/kiosk-control': ['/admin', '/admin/settings'],
  '/admin/coupons/issue': ['/admin/coupons/redemptions', '/admin/coupons/wallet'],
  '/admin/coupons/redemptions': ['/admin/coupons/issue', '/admin/coupons/wallet'],
  '/admin/coupons/wallet': ['/admin/coupons/issue', '/admin/coupons/redemptions'],
  '/admin/settings': ['/admin', '/admin/backup'],
  '/admin/backup': ['/admin/settings', '/admin'],
  '/admin/logs': ['/admin/settings', '/admin'],
};

// Cache to track prefetched routes
const prefetchedRoutes = new Set<string>();

/**
 * Prefetch a route by creating a link element with rel="prefetch"
 * This tells the browser to fetch the resource in the background
 */
export function prefetchRoute(path: string): void {
  // Don't prefetch if already prefetched
  if (prefetchedRoutes.has(path)) {
    return;
  }

  // Don't prefetch external URLs
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return;
  }

  // Mark as prefetched
  prefetchedRoutes.add(path);

  // Create prefetch link element
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = path;
  link.as = 'document';

  // Add to document head
  document.head.appendChild(link);

  // Optional: Remove after a delay to clean up
  setTimeout(() => {
    document.head.removeChild(link);
  }, 30000); // 30 seconds
}

/**
 * Prefetch likely next pages based on current route
 */
export function prefetchLikelyNextPages(currentPath: string): void {
  const likelyPages = LIKELY_NEXT_PAGES[currentPath];

  if (likelyPages && likelyPages.length > 0) {
    // Prefetch after a short delay to avoid blocking initial page load
    setTimeout(() => {
      likelyPages.forEach((page) => {
        prefetchRoute(page);
      });
    }, 1000); // 1 second delay
  }
}

/**
 * Clear prefetch cache (useful for testing or memory management)
 */
export function clearPrefetchCache(): void {
  prefetchedRoutes.clear();
}

/**
 * Get prefetched routes (for debugging)
 */
export function getPrefetchedRoutes(): string[] {
  return Array.from(prefetchedRoutes);
}
