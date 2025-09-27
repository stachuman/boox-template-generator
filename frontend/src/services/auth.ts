/**
 * Authentication API client for interacting with backend auth endpoints.
 *
 * Provides type-safe wrappers around registration, login, profile, and
 * password reset operations.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import { AxiosResponse } from 'axios';
import { apiClient, APIClientError } from './api';
import { TokenResponse, UserResponse } from '@/auth/types';

export class AuthAPI {
  static async register(username: string, email: string, password: string): Promise<UserResponse> {
    try {
      const response: AxiosResponse<UserResponse> = await apiClient.post('/auth/register', {
        username,
        email,
        password,
      });
      return response.data;
    } catch (error) {
      throw AuthAPI.normalizeError(error);
    }
  }

  static async login(username: string, password: string): Promise<TokenResponse> {
    try {
      const response: AxiosResponse<TokenResponse> = await apiClient.post('/auth/login', {
        username,
        password,
      });
      return response.data;
    } catch (error) {
      throw AuthAPI.normalizeError(error);
    }
  }

  static async getMe(): Promise<UserResponse> {
    try {
      const response: AxiosResponse<UserResponse> = await apiClient.get('/auth/me');
      return response.data;
    } catch (error) {
      throw AuthAPI.normalizeError(error);
    }
  }

  static async requestPasswordReset(email: string): Promise<void> {
    try {
      await apiClient.post('/auth/password-reset/request', { email });
    } catch (error) {
      throw AuthAPI.normalizeError(error);
    }
  }

  static async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    try {
      await apiClient.post('/auth/password-reset/confirm', {
        token,
        new_password: newPassword,
      });
    } catch (error) {
      throw AuthAPI.normalizeError(error);
    }
  }

  static async acceptTerms(): Promise<UserResponse> {
    try {
      const response: AxiosResponse<UserResponse> = await apiClient.post('/auth/accept-terms', {
        accepted: true,
      });
      return response.data;
    } catch (error) {
      throw AuthAPI.normalizeError(error);
    }
  }

  private static normalizeError(error: unknown): APIClientError {
    if (error instanceof APIClientError) {
      return error;
    }
    if (error instanceof Error) {
      return new APIClientError({ error: 'AUTH_ERROR', message: error.message });
    }
    return new APIClientError({ error: 'AUTH_ERROR', message: 'Authentication request failed' });
  }
}
