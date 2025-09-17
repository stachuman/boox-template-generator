/**
 * API client for communicating with the FastAPI backend.
 * 
 * Provides type-safe methods for all backend endpoints.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import axios, { AxiosResponse } from 'axios';
import { DeviceProfile, TemplateResponse, APIError } from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.data) {
      throw new APIClientError(error.response.data);
    }
    throw new APIClientError({
      error: 'NETWORK_ERROR',
      message: error.message || 'Network request failed',
    });
  }
);

export class APIClientError extends Error {
  public readonly apiError: APIError;

  constructor(apiError: APIError) {
    super(apiError.message);
    this.apiError = apiError;
    this.name = 'APIClientError';
  }
}

export interface CreateTemplateRequest {
  name: string;
  description: string;
  profile: string;
  yaml_content: string;
}

export interface UpdateTemplateRequest {
  name?: string;
  description?: string;
  profile?: string;
  yaml_content?: string;
}

export interface PDFGenerateRequest {
  yaml_content: string;
  profile: string;
  deterministic?: boolean;
  strict_mode?: boolean;
}

export interface PreviewGenerateRequest {
  yaml_content: string;
  profile: string;
  page_number?: number;
  scale?: number;
}

export class APIClient {
  // Device Profiles
  static async getProfiles(): Promise<DeviceProfile[]> {
    const response: AxiosResponse<DeviceProfile[]> = await apiClient.get('/profiles/');
    return response.data;
  }

  static async getProfile(profileName: string): Promise<DeviceProfile> {
    const response: AxiosResponse<DeviceProfile> = await apiClient.get(`/profiles/${profileName}`);
    return response.data;
  }

  // Templates
  static async createTemplate(request: CreateTemplateRequest): Promise<TemplateResponse> {
    const response: AxiosResponse<TemplateResponse> = await apiClient.post('/templates/', request);
    return response.data;
  }

  static async getTemplates(): Promise<{ templates: TemplateResponse[]; total: number }> {
    const response = await apiClient.get('/templates/');
    return response.data;
  }

  static async getTemplate(templateId: string): Promise<TemplateResponse> {
    const response: AxiosResponse<TemplateResponse> = await apiClient.get(`/templates/${templateId}`);
    return response.data;
  }

  static async updateTemplate(templateId: string, request: UpdateTemplateRequest): Promise<TemplateResponse> {
    const response: AxiosResponse<TemplateResponse> = await apiClient.put(`/templates/${templateId}`, request);
    return response.data;
  }

  static async deleteTemplate(templateId: string): Promise<void> {
    await apiClient.delete(`/templates/${templateId}`);
  }

  // PDF Generation
  static async generatePDF(request: PDFGenerateRequest): Promise<Blob> {
    const response = await apiClient.post('/pdf/generate', request, {
      responseType: 'blob',
    });
    return response.data;
  }

  static async generatePreview(request: PreviewGenerateRequest): Promise<Blob> {
    const response = await apiClient.post('/pdf/preview', request, {
      responseType: 'blob',
    });
    return response.data;
  }

  // Health Check
  static async healthCheck(): Promise<{ status: string; version: string; einkpdf_available: boolean }> {
    const response = await apiClient.get('/health');
    return response.data;
  }
}

// Helper functions for working with blobs
export const blobToDataURL = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};