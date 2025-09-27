import { PropsWithChildren, useEffect } from 'react';
import { shallow } from 'zustand/shallow';
import { AuthContext } from './AuthContext';
import { useAuthStore } from '@/stores/auth';

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const initialize = useAuthStore((state) => state.initialize);
  const contextValue = useAuthStore(
    (state) => ({
      user: state.user,
      token: state.token,
      isAuthenticated: state.isAuthenticated,
      isLoading: state.isLoading,
      error: state.error,
      login: state.login,
      register: state.register,
      logout: state.logout,
      requestPasswordReset: state.requestPasswordReset,
      confirmPasswordReset: state.confirmPasswordReset,
      acceptTerms: state.acceptTerms,
      clearError: state.clearError,
    }),
    shallow,
  );
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
    };

    window.addEventListener('auth:logout', handleUnauthorized);
    return () => window.removeEventListener('auth:logout', handleUnauthorized);
  }, [logout]);

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};
