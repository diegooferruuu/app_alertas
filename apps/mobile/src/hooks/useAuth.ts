import { useAuthStore } from '../store/auth.store';

export const useAuth = () => {
  const {
    user,
    isAuthenticated,
    isLoading,
    error,
    documentoRegistrado,
    login,
    register,
    logout,
    registrarDocumento,
    getProfile,
    setError,
  } = useAuthStore();

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    documentoRegistrado,
    login,
    register,
    logout,
    registrarDocumento,
    getProfile,
    setError,
  };
};
