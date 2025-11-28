import React from 'react';
import ReactDOM from 'react-dom/client';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import App from './App.tsx';
import './index.css';
import { queryClient, persister } from './lib/queryClient';
import './i18n/config'; // Initialize i18n
import * as serviceWorkerRegistration from './lib/serviceWorkerRegistration';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister }}
    >
      <App />
    </PersistQueryClientProvider>
  </React.StrictMode>
);

// Register service worker for offline support and translation caching
// Only register if service worker is supported
if ('serviceWorker' in navigator) {
  serviceWorkerRegistration.register({
    onSuccess: () => {
      console.log('[App] Service worker registered successfully');
    },
    onUpdate: (registration) => {
      console.log('[App] New content available, please refresh');
      // Optionally show a notification to the user
      if (confirm('Yeni içerik mevcut. Sayfayı yenilemek ister misiniz?')) {
        registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      }
    },
    onOffline: () => {
      console.log('[App] App is now offline');
    },
    onOnline: () => {
      console.log('[App] App is back online');
    },
  });
}
