import { QueryClient } from '@tanstack/react-query';

const QUERY_CACHE_KEY = 'kio-cache';

// Create persister for localStorage using the experimental API
export const persister = {
  persistClient: async (client: any) => {
    try {
      const data = JSON.stringify(client);
      window.localStorage.setItem(QUERY_CACHE_KEY, data);
    } catch (error) {
      console.error('Failed to persist query client:', error);
    }
  },
  restoreClient: async () => {
    try {
      const data = window.localStorage.getItem(QUERY_CACHE_KEY);
      return data ? JSON.parse(data) : undefined;
    } catch (error) {
      console.error('Failed to restore query client:', error);
      return undefined;
    }
  },
  removeClient: async () => {
    window.localStorage.removeItem(QUERY_CACHE_KEY);
  },
};

// Create React Query client with configuration
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => {
        // Exponential backoff: 1s, 2s, 4s
        return Math.min(1000 * 2 ** attemptIndex, 30000);
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false, // Don't retry mutations by default
    },
  },
});
