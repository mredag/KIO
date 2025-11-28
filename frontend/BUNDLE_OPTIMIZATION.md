# Bundle Optimization Guide

This document explains the bundle optimization strategies implemented in the frontend application.

## Overview

The application uses several techniques to minimize bundle size and improve load performance:

1. **Lazy Loading** - Routes and charts are loaded on-demand
2. **Code Splitting** - Manual chunks separate vendor and feature code
3. **Tree Shaking** - Unused code is eliminated during build
4. **Minification** - Terser minifies and compresses code
5. **Route Prefetching** - Likely next pages are prefetched in background

## Bundle Analysis

To analyze the bundle size and composition:

```bash
npm run analyze --workspace=frontend
```

This generates a `dist/stats.html` file with an interactive visualization of the bundle.

## Code Splitting Strategy

### Vendor Chunks

Large third-party libraries are split into separate chunks:

- **react-vendor**: React, React DOM, React Router
- **query-vendor**: TanStack Query
- **charts-vendor**: Recharts and D3 dependencies
- **i18n-vendor**: i18next and react-i18next
- **vendor**: Other third-party libraries

### Feature Chunks

Application code is split by feature area:

- **admin-dashboard**: Dashboard page and components
- **admin-massages**: Massage management pages
- **admin-surveys**: Survey management pages
- **admin-coupons**: Coupon management pages
- **admin-system**: Settings, backup, and logs pages
- **admin-components**: Shared admin UI components
- **kiosk**: Kiosk mode components

### Benefits

- **Better Caching**: Vendor code changes less frequently than app code
- **Parallel Loading**: Multiple chunks can be downloaded simultaneously
- **Faster Updates**: Only changed chunks need to be re-downloaded
- **Smaller Initial Bundle**: Only load what's needed for the current page

## Lazy Loading

### Routes

All routes are lazy-loaded using React.lazy():

```typescript
// Before (eager loading)
import DashboardPage from './pages/admin/DashboardPage';

// After (lazy loading)
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'));
```

Routes are wrapped in Suspense with a loading fallback.

### Charts

Chart components (LineChart, BarChart) are lazy-loaded:

```typescript
import { LazyLineChart, LazyBarChart } from '../../components/admin/LazyCharts';
```

Charts are only loaded when they're actually rendered on the page.

## Route Prefetching

The application prefetches likely next pages to improve perceived performance:

### Hover Prefetching

Links prefetch their target route when hovered:

```typescript
<PrefetchLink to="/admin/massages">Massages</PrefetchLink>
```

### Automatic Prefetching

When you visit a page, likely next pages are automatically prefetched:

- Dashboard → Massages, Surveys, Kiosk Control
- Massages → New Massage, Dashboard
- Surveys → Survey Responses, New Survey

This happens in the background after a 1-second delay.

## Build Configuration

### Vite Config Highlights

```typescript
build: {
  // Terser minification with console.log removal
  minify: 'terser',
  terserOptions: {
    compress: {
      drop_console: true,
      drop_debugger: true,
    },
  },
  
  // Manual chunk splitting
  rollupOptions: {
    output: {
      manualChunks: (id) => {
        // Split by vendor and feature
      },
    },
  },
  
  // CSS code splitting
  cssCodeSplit: true,
  
  // Inline small assets as base64
  assetsInlineLimit: 4096, // 4kb
  
  // Target modern browsers
  target: 'es2020',
}
```

## Performance Targets

Based on Requirements 14.1, 14.2, 14.3, 14.4:

- **First Contentful Paint**: < 1.5 seconds
- **Page Transitions**: < 300ms
- **Chart Loading**: Lazy loaded with skeleton fallback
- **Route Prefetching**: Enabled for likely next pages

## Monitoring Bundle Size

### Warning Threshold

The build warns if any chunk exceeds 1MB:

```typescript
chunkSizeWarningLimit: 1000, // 1MB
```

### Recommended Limits

- **Initial Bundle**: < 200KB (gzipped)
- **Vendor Chunks**: < 150KB each (gzipped)
- **Feature Chunks**: < 100KB each (gzipped)
- **Total Bundle**: < 1MB (gzipped)

## Best Practices

### When Adding Dependencies

1. Check the package size: https://bundlephobia.com
2. Consider alternatives if the package is large
3. Use tree-shakeable imports when possible
4. Run bundle analysis after adding dependencies

### When Adding Features

1. Keep feature code in separate directories
2. Use lazy loading for large components
3. Avoid importing everything from barrel files
4. Import only what you need from libraries

### Examples

```typescript
// ❌ Bad - imports entire library
import * as Icons from 'lucide-react';

// ✅ Good - imports only what's needed
import { Menu, X, Search } from 'lucide-react';

// ❌ Bad - imports all components
import { Button, Card, Modal } from './components';

// ✅ Good - direct imports
import { Button } from './components/Button';
import { Card } from './components/Card';
```

## Troubleshooting

### Large Bundle Size

1. Run `npm run analyze --workspace=frontend`
2. Identify the largest chunks in stats.html
3. Check if large dependencies can be replaced or lazy-loaded
4. Ensure tree-shaking is working (check imports)

### Slow Page Loads

1. Check Network tab in DevTools
2. Verify chunks are loading in parallel
3. Check if prefetching is working
4. Ensure service worker is caching assets

### Build Errors

1. Check for circular dependencies
2. Verify all lazy imports have default exports
3. Ensure Suspense boundaries are in place
4. Check TypeScript compilation errors

## Future Optimizations

Potential improvements for the future:

1. **Image Optimization**: Use WebP format with fallbacks
2. **Font Subsetting**: Load only required font characters
3. **Service Worker**: Cache chunks for offline access
4. **HTTP/2 Push**: Push critical chunks with initial response
5. **Brotli Compression**: Better compression than gzip

## Resources

- [Vite Build Optimization](https://vitejs.dev/guide/build.html)
- [React Code Splitting](https://react.dev/reference/react/lazy)
- [Web.dev Performance](https://web.dev/performance/)
- [Bundle Phobia](https://bundlephobia.com/)
