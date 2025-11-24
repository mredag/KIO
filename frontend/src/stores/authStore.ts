import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthStore {
  isAuthenticated: boolean;
  user: { username: string } | null;
  
  setAuthenticated: (authenticated: boolean, user?: { username: string } | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,

      setAuthenticated: (authenticated, user = null) =>
        set({ isAuthenticated: authenticated, user }),
      
      logout: () =>
        set({ isAuthenticated: false, user: null }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
