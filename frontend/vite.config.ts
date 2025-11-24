import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'query-vendor': ['@tanstack/react-query', '@tanstack/react-query-persist-client'],
          'animation-vendor': ['motion'],
          // Split kiosk and admin into separate chunks
          'kiosk': [
            './src/components/kiosk/KioskModeRouter.tsx',
            './src/components/kiosk/DigitalMenuMode.tsx',
            './src/components/kiosk/SurveyMode.tsx',
            './src/components/kiosk/GoogleQRMode.tsx',
            './src/components/kiosk/SlideshowMode.tsx',
          ],
          'admin': [
            './src/pages/admin/DashboardPage.tsx',
            './src/pages/admin/MassagesPage.tsx',
            './src/pages/admin/KioskControlPage.tsx',
            './src/pages/admin/SurveysPage.tsx',
            './src/pages/admin/SettingsPage.tsx',
          ],
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
