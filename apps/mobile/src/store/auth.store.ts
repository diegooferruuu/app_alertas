import { create } from 'zustand';
import authService, { LoginResponse, User } from '../services/auth.service';

interface PersonalData {
  full_name: string;
  ci_number: string;
  birth_place: string;
  birth_date: string;
}

interface VerificationDraft {
  personalData: PersonalData | null;
  idFrontBase64: string | null;
  idBackBase64: string | null;
}

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  identityVerified: boolean;
  verificationDraft: VerificationDraft;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, full_name: string, phone: string) => Promise<void>;
  logout: () => Promise<void>;
  verifyIdCard: (frontBase64: string, backBase64: string) => Promise<void>;
  verifyIdentity: (selfieBase64: string) => Promise<void>;
  getProfile: () => Promise<void>;
  setError: (error: string | null) => void;
  setPersonalData: (data: PersonalData) => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  identityVerified: false,
  verificationDraft: {
    personalData: null,
    idFrontBase64: null,
    idBackBase64: null,
  },

  setPersonalData: (data: PersonalData) => {
    set((state) => ({
      verificationDraft: { ...state.verificationDraft, personalData: data },
    }));
  },

  verifyIdCard: async (frontBase64: string, backBase64: string) => {
    set({ isLoading: true, error: null });
    try {
      const { personalData } = get().verificationDraft;
      if (!personalData) {
        throw new Error('Faltan los datos personales. Reinicia el proceso.');
      }

      // Valida la calidad/coincidencia del carnet contra el OCR del backend
      await authService.verifyIdCard({
        id_front_base64: frontBase64,
        id_back_base64: backBase64,
        personal_data: {
          full_name: personalData.full_name,
          ci_number: personalData.ci_number,
          birth_place: personalData.birth_place,
          birth_date: personalData.birth_date,
        },
      });

      // Solo si pasó la validación, guardamos las fotos para el paso final
      set((state) => ({
        verificationDraft: {
          ...state.verificationDraft,
          idFrontBase64: frontBase64,
          idBackBase64: backBase64,
        },
      }));
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || error.message || 'No se pudo validar el carnet';
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.login(email, password);
      set({
        user: response.user as User,
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

  register: async (email: string, password: string, full_name: string, phone: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.register(email, password, full_name, phone);
      set({
        user: response.user as User,
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
        verificationDraft: { personalData: null, idFrontBase64: null, idBackBase64: null },
      });
    } finally {
      set({ isLoading: false });
    }
  },

  verifyIdentity: async (selfieBase64: string) => {
    set({ isLoading: true, error: null });
    try {
      const { personalData, idFrontBase64, idBackBase64 } = get().verificationDraft;

      if (!personalData || !idFrontBase64 || !idBackBase64) {
        throw new Error('Datos de verificación incompletos. Reinicia el proceso.');
      }

      await authService.verifyIdentity({
        id_front_base64: idFrontBase64,
        id_back_base64: idBackBase64,
        selfie_base64: selfieBase64,
        personal_data: {
          full_name: personalData.full_name,
          ci_number: personalData.ci_number,
          birth_place: personalData.birth_place,
          birth_date: personalData.birth_date,
        },
      });

      set({
        identityVerified: true,
        verificationDraft: { personalData: null, idFrontBase64: null, idBackBase64: null },
      });
      await get().getProfile();
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
