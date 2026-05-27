import { useAuthStore } from '../store/auth.store';

export const useAuth = () => {
  const {
    user,
    isAuthenticated,
    isLoading,
    error,
    identityVerified,
    login,
    register,
    logout,
    verifyIdentity,
    getProfile,
    setError,
  } = useAuthStore();

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    identityVerified,
    login,
    register,
    logout,
    verifyIdentity,
    getProfile,
    setError,
  };
};
