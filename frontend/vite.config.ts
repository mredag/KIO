import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Bundle analyzer - generates stats.html in dist folder
    visualizer({
      filename: './dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }) as any,
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  // Ensure service worker and manifest are copied to dist
  publicDir: 'public',
  build: {
    outDir: 'dist',
    sourcemap: false, // Disable sourcemaps in production for smaller bundle
    minify: 'terser', // Use terser for better minification
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: (id) => {
          // Vendor chunks - split by library
          if (id.includes('node_modules')) {
            // React core
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor';
            }
            // React Query
            if (id.includes('@tanstack/react-query')) {
              return 'query-vendor';
            }
            // Charts library (Recharts is large)
            if (id.includes('recharts') || id.includes('d3-')) {
              return 'charts-vendor';
            }
            // i18n
            if (id.includes('i18next') || id.includes('react-i18next')) {
              return 'i18n-vendor';
            }
            // Other vendors
            return 'vendor';
          }
          
          // Split by feature area
          if (id.includes('/src/pages/admin/')) {
            // Admin pages
            if (id.includes('Dashboard')) return 'admin-dashboard';
            if (id.includes('Massage')) return 'admin-massages';
            if (id.includes('Survey')) return 'admin-surveys';
            if (id.includes('Coupon')) return 'admin-coupons';
            if (id.includes('Settings') || id.includes('Backup') || id.includes('Logs')) {
              return 'admin-system';
            }
            return 'admin-common';
          }
          
          if (id.includes('/src/components/kiosk/')) {
            return 'kiosk';
          }
          
          // Shared components
          if (id.includes('/src/components/admin/')) {
            return 'admin-components';
          }
        },
        // Optimize chunk file names
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Optimize chunk size
    chunkSizeWarningLimit: 1000, // Warn for chunks > 1MB
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Asset inline limit (smaller assets inlined as base64)
    assetsInlineLimit: 4096, // 4kb
    // Target modern browsers for smaller bundle
    target: 'es2020',
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      'zustand',
      'motion',
      'axios',
    ],
  },
})
