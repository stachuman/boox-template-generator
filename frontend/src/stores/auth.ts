import { create } from 'zustand';
import { AuthAPI } from '@/services/auth';
import { TokenStorage } from '@/services/storage';
import { APIClientError } from '@/services/api';
import { UserResponse } from '@/auth/types';

interface AuthStore {
  user: UserResponse | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  requestPasswordReset: (email: string) => Promise<void>;
  confirmPasswordReset: (token: string, newPassword: string) => Promise<void>;
  acceptTerms: () => Promise<void>;
  clearError: () => void;
}

const initialState: Pick<AuthStore, 'user' | 'token' | 'isAuthenticated' | 'isLoading' | 'error'> = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

const extractErrorMessage = (error: unknown): string => {
  if (error instanceof APIClientError) {
    return error.apiError.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected authentication error occurred';
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  ...initialState,

  async initialize() {
    const token = TokenStorage.getToken();
    if (!token || TokenStorage.isTokenExpired(token)) {
      TokenStorage.removeToken();
      set({ ...initialState, isLoading: false });
      return;
    }

    try {
      const user = await AuthAPI.getMe();
      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      TokenStorage.removeToken();
      set({ ...initialState, isLoading: false, error: extractErrorMessage(error) });
    }
  },

  async login(username, password) {
    set({ isLoading: true, error: null });
    try {
      const tokenResponse = await AuthAPI.login(username, password);
      TokenStorage.setToken(tokenResponse.access_token);
      const user = await AuthAPI.getMe();
      set({
        user,
        token: tokenResponse.access_token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      TokenStorage.removeToken();
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: extractErrorMessage(error),
      });
      throw error;
    }
  },

  async register(username, email, password) {
    set({ isLoading: true, error: null });
    try {
      await AuthAPI.register(username, email, password);
      await get().login(username, password);
    } catch (error) {
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: extractErrorMessage(error),
      });
      throw error;
    }
  },

  logout() {
    TokenStorage.removeToken();
    set({ ...initialState, isLoading: false });
  },

  async requestPasswordReset(email) {
    set({ error: null });
    try {
      await AuthAPI.requestPasswordReset(email);
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  async confirmPasswordReset(token, newPassword) {
    set({ error: null });
    try {
      await AuthAPI.confirmPasswordReset(token, newPassword);
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  async acceptTerms() {
    set({ error: null });
    try {
      const updatedUser = await AuthAPI.acceptTerms();
      set({ user: updatedUser });
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  clearError() {
    set({ error: null });
  },
}));
