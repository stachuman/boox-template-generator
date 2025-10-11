/**
 * Public project API client providing access to shared gallery endpoints.
 */

import { AxiosResponse } from 'axios';
import { apiClient, APIClientError } from './api';
import type { PublicProject, PublicProjectListResponse } from '@/types/public';
import type { CloneProjectRequestPayload, Project } from '@/types';

const normalizeError = (error: unknown): APIClientError => {
  if (error instanceof APIClientError) {
    return error;
  }
  if (error instanceof Error) {
    return new APIClientError({ error: 'PUBLIC_PROJECT_ERROR', message: error.message });
  }
  return new APIClientError({ error: 'PUBLIC_PROJECT_ERROR', message: 'Public projects request failed' });
};

export class PublicAPI {
  static async listProjects(): Promise<PublicProjectListResponse> {
    try {
      const response: AxiosResponse<PublicProjectListResponse> = await apiClient.get('/public/projects');
      return response.data;
    } catch (error) {
      throw normalizeError(error);
    }
  }

  static async getProject(projectId: string): Promise<PublicProject> {
    try {
      const response: AxiosResponse<PublicProject> = await apiClient.get(`/public/projects/${projectId}`);
      return response.data;
    } catch (error) {
      throw normalizeError(error);
    }
  }

  static async getProjectBySlug(slug: string): Promise<PublicProject> {
    try {
      const response: AxiosResponse<PublicProject> = await apiClient.get(`/public/projects/slug/${encodeURIComponent(slug)}`);
      return response.data;
    } catch (error) {
      throw normalizeError(error);
    }
  }

  static async getProjectDefinition(projectId: string): Promise<Project> {
    try {
      const response: AxiosResponse<Project> = await apiClient.get(`/public/projects/${projectId}/definition`);
      return response.data;
    } catch (error) {
      throw normalizeError(error);
    }
  }

  static async cloneProject(projectId: string, payload: CloneProjectRequestPayload): Promise<Project> {
    try {
      const response: AxiosResponse<Project> = await apiClient.post(`/projects/public/${projectId}/clone`, {
        new_name: payload.new_name,
        new_description: payload.new_description,
      });
      return response.data;
    } catch (error) {
      throw normalizeError(error);
    }
  }

  static async cloneProjectBySlug(slug: string, payload: CloneProjectRequestPayload): Promise<Project> {
    try {
      const response: AxiosResponse<Project> = await apiClient.post(`/projects/public/slug/${encodeURIComponent(slug)}/clone`, {
        new_name: payload.new_name,
        new_description: payload.new_description,
      });
      return response.data;
    } catch (error) {
      throw normalizeError(error);
    }
  }
}
