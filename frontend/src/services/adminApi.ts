/**
 * Admin API client for user management and admin operations.
 * Following CLAUDE.md - no dummy implementations.
 */

import { apiClient } from './api';

export interface UserStats {
  id: string;
  username: string;
  email: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  project_count: number;
  last_login: string | null;
}

export interface UserListResponse {
  users: UserStats[];
  total: number;
}

export interface ProjectListItem {
  id: string;
  name: string;
  description: string;
  device_profile: string;
  created_at: string;
  updated_at: string;
}

export interface UserProjectsResponse {
  user_id: string;
  username: string;
  projects: ProjectListItem[];
  total: number;
}

export interface ImpersonateRequest {
  user_id: string;
}

export interface ImpersonateResponse {
  message: string;
  admin_id: string;
  impersonated_user_id: string;
  impersonated_username: string;
}

export interface ResetPasswordRequest {
  user_id: string;
  new_password: string;
}

export interface MessageResponse {
  message: string;
  user_id?: string;
  username?: string;
}

export class AdminAPI {
  /**
   * List all users with statistics.
   */
  static async listUsers(skip: number = 0, limit: number = 100): Promise<UserListResponse> {
    const response = await apiClient.get<UserListResponse>('/admin/users', {
      params: { skip, limit }
    });
    return response.data;
  }

  /**
   * Get all projects for a specific user.
   */
  static async getUserProjects(userId: string): Promise<UserProjectsResponse> {
    const response = await apiClient.get<UserProjectsResponse>(`/admin/users/${userId}/projects`);
    return response.data;
  }

  /**
   * Start impersonating a user.
   */
  static async impersonateUser(userId: string): Promise<ImpersonateResponse> {
    const response = await apiClient.post<ImpersonateResponse>('/admin/impersonate', {
      user_id: userId
    });
    return response.data;
  }

  /**
   * Stop impersonating a user.
   */
  static async stopImpersonation(): Promise<MessageResponse> {
    const response = await apiClient.delete<MessageResponse>('/admin/impersonate');
    return response.data;
  }

  /**
   * Reset a user's password.
   */
  static async resetUserPassword(userId: string, newPassword: string): Promise<MessageResponse> {
    const response = await apiClient.post<MessageResponse>(
      `/admin/users/${userId}/reset-password`,
      {
        user_id: userId,
        new_password: newPassword
      }
    );
    return response.data;
  }
}
