import { create } from 'zustand';
import authService, { LoginResponse, User } from '../services/auth.service';

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  identityVerified: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, full_name: string, phone: string, id_card_base64: string) => Promise<void>;
  logout: () => Promise<void>;
  verifyIdentity: (id_card_base64: string) => Promise<void>;
  getProfile: () => Promise<void>;
  setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  identityVerified: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.login(email, password);
      set({
        user: response.user,
        isAuthenticated: true,
        identityVerified: response.user.identity_verified,
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Login failed';
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (email: string, password: string, full_name: string, phone: string, id_card_base64: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.register(email, password, full_name, phone, id_card_base64);
      set({
        user: response.user,
        isAuthenticated: true,
        identityVerified: response.user.identity_verified,
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Registration failed';
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authService.logout();
      set({
        user: null,
        isAuthenticated: false,
        identityVerified: false,
        error: null,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  verifyIdentity: async (id_card_base64: string) => {
    set({ isLoading: true, error: null });
    try {
      await authService.verifyIdentity(id_card_base64);
      set({ identityVerified: true });
      // Update user profile to reflect identity verification
      await useAuthStore.getState().getProfile();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Verification failed';
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  getProfile: async () => {
    try {
      const profile = await authService.getProfile();
      set({
        user: profile,
        identityVerified: profile.identity_verified,
      });
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    }
  },

  setError: (error: string | null) => {
    set({ error });
  },
}));
