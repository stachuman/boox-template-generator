/**
 * API client for communicating with the FastAPI backend.
 * 
 * Provides type-safe methods for all backend endpoints.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import axios, { AxiosResponse } from 'axios';
import { TokenStorage } from './storage';
import {
  DeviceProfile,
  TemplateResponse,
  APIError,
  Project,
  ProjectListItem,
  CompilationResult,
  CreateProjectRequest,
  UpdateProjectRequest,
  AddPageRequest,
  UpdatePageRequest,
  UpdateCompilationRulesRequest,
  AddMasterRequest,
  UpdateMasterRequest,
  Plan,
  MakeProjectPublicRequest,
  PDFJob,
  PDFJobCreateRequest,
  PDFJobListResponse
} from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,  // Send cookies with requests
});

apiClient.interceptors.request.use((config) => {
  const token = TokenStorage.getToken();
  if (token) {
    if (TokenStorage.isTokenExpired(token)) {
      TokenStorage.removeToken();
    } else {
      if (!config.headers) {
        config.headers = {};
      }
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Try to normalize backend error
    const resp = error.response;
    if (resp) {
      if (resp.status === 401) {
        TokenStorage.removeToken();
        window.dispatchEvent(new CustomEvent('auth:logout'));
        throw new APIClientError({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      }
      const ct = resp.headers?.['content-type'] || '';
      if (ct.includes('application/json') && resp.data && typeof resp.data === 'object') {
        const data = resp.data as any;
        const message = typeof data.detail === 'string'
          ? data.detail
          : typeof data.message === 'string'
            ? data.message
            : JSON.stringify(data);
        throw new APIClientError({ error: 'HTTP_ERROR', message });
      }
      const message = error.message || `HTTP ${resp.status}`;
      throw new APIClientError({ error: 'HTTP_ERROR', message });
    }
    // Network error
    throw new APIClientError({ error: 'NETWORK_ERROR', message: error.message || 'Network request failed' });
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

  // Compile parametric masters + plan
  static async compileBuild(masters_yaml: string, plan_yaml: string): Promise<{ yaml_content: string; parsed_template: any }> {
    const response = await apiClient.post('/compile/build', { masters_yaml, plan_yaml });
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

  // PDF Jobs (Async PDF Generation)
  static async createPDFJob(request: PDFJobCreateRequest): Promise<PDFJob> {
    const response: AxiosResponse<PDFJob> = await apiClient.post('/pdf/jobs', request);
    return response.data;
  }

  static async getPDFJob(jobId: string): Promise<PDFJob> {
    const response: AxiosResponse<PDFJob> = await apiClient.get(`/pdf/jobs/${jobId}`);
    return response.data;
  }

  static async listPDFJobs(statusFilter?: string, limit: number = 50, offset: number = 0): Promise<PDFJobListResponse> {
    const params = new URLSearchParams();
    if (statusFilter) params.append('status_filter', statusFilter);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());

    const response: AxiosResponse<PDFJobListResponse> = await apiClient.get(`/pdf/jobs?${params.toString()}`);
    return response.data;
  }

  static async downloadPDFJob(jobId: string): Promise<Blob> {
    const response = await apiClient.get(`/pdf/jobs/${jobId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  }

  static async cancelPDFJob(jobId: string): Promise<void> {
    await apiClient.delete(`/pdf/jobs/${jobId}`);
  }

  // Health Check
  static async healthCheck(): Promise<{ status: string; version: string; einkpdf_available: boolean }> {
    const response = await apiClient.get('/health');
    return response.data;
  }

  // ---- Project-Based API Methods ----

  // Projects
  static async createProject(request: CreateProjectRequest): Promise<Project> {
    const response: AxiosResponse<Project> = await apiClient.post('/projects', request);
    return response.data;
  }

  static async getProjects(): Promise<ProjectListItem[]> {
    const response: AxiosResponse<ProjectListItem[]> = await apiClient.get('/projects');
    return response.data;
  }

  static async getProject(projectId: string): Promise<Project> {
    const response: AxiosResponse<Project> = await apiClient.get(`/projects/${projectId}`);
    return response.data;
  }

  static async updateProject(projectId: string, request: UpdateProjectRequest): Promise<Project> {
    const response: AxiosResponse<Project> = await apiClient.patch(`/projects/${projectId}`, request);
    return response.data;
  }

  static async deleteProject(projectId: string): Promise<void> {
    await apiClient.delete(`/projects/${projectId}`);
  }

  // Named Pages
  static async addNamedPage(projectId: string, request: AddPageRequest): Promise<Project> {
    const response: AxiosResponse<Project> = await apiClient.post(`/projects/${projectId}/pages`, request);
    return response.data;
  }

  static async updateNamedPage(projectId: string, pageName: string, request: UpdatePageRequest): Promise<Project> {
    const response: AxiosResponse<Project> = await apiClient.patch(`/projects/${projectId}/pages/${encodeURIComponent(pageName)}`, request);
    return response.data;
  }

  static async removeNamedPage(projectId: string, pageName: string): Promise<Project> {
    const response: AxiosResponse<Project> = await apiClient.delete(`/projects/${projectId}/pages/${encodeURIComponent(pageName)}`);
    return response.data;
  }

  // Masters
  static async addMaster(projectId: string, request: AddMasterRequest): Promise<Project> {
    const response: AxiosResponse<Project> = await apiClient.post(`/projects/${projectId}/masters`, request);
    return response.data;
  }

  static async updateMaster(projectId: string, masterName: string, request: UpdateMasterRequest): Promise<Project> {
    const response: AxiosResponse<Project> = await apiClient.patch(`/projects/${projectId}/masters/${encodeURIComponent(masterName)}`, request);
    return response.data;
  }

  static async removeMaster(projectId: string, masterName: string): Promise<Project> {
    const response: AxiosResponse<Project> = await apiClient.delete(`/projects/${projectId}/masters/${encodeURIComponent(masterName)}`);
    return response.data;
  }

  // Plans
  static async shareProject(projectId: string, request: MakeProjectPublicRequest): Promise<Project> {
    const response: AxiosResponse<Project> = await apiClient.post(`/projects/${projectId}/share`, request);
    return response.data;
  }

  // Compilation
  static async updateCompilationRules(projectId: string, request: UpdateCompilationRulesRequest): Promise<Project> {
    const response: AxiosResponse<Project> = await apiClient.put(`/projects/${projectId}/compilation`, request);
    return response.data;
  }

  static async updatePlan(projectId: string, plan: Plan): Promise<Project> {
    const response: AxiosResponse<Project> = await apiClient.put(`/projects/${projectId}/plan`, {
      plan_data: plan
    });
    return response.data;
  }

  static async compileProject(projectId: string): Promise<CompilationResult> {
    const response: AxiosResponse<CompilationResult> = await apiClient.post(`/projects/${projectId}/compile`);
    return response.data;
  }

  // Compiled PDF availability check (HEAD)
  static async hasCompiledPDF(projectId: string): Promise<boolean> {
    try {
      const res = await apiClient.head(`/projects/${projectId}/pdf`);
      return res.status >= 200 && res.status < 300;
    } catch (_e) {
      return false;
    }
  }

  // Download compiled PDF
  static async downloadProjectPDF(projectId: string, inline: boolean = false): Promise<Blob> {
    const response = await apiClient.get(`/projects/${projectId}/pdf`, {
      responseType: 'blob',
      params: { inline: inline ? '1' : '0' }
    });
    return response.data;
  }

  // Export master template as PNG for e-ink device
  static async exportMasterAsPNG(
    projectId: string,
    masterName: string,
    context?: Record<string, any>
  ): Promise<Blob> {
    const response = await apiClient.post(
      `/projects/${projectId}/export/master-png`,
      {
        master_name: masterName,
        context: context
      },
      {
        responseType: 'blob'
      }
    );
    return response.data;
  }

  // Get project preview image
  static async getProjectPreview(projectId: string, page: number = 1, scale: number = 2.0): Promise<Blob> {
    const response = await apiClient.get(`/projects/${projectId}/preview`, {
      responseType: 'blob',
      params: { page, scale }
    });
    return response.data;
  }

  // Assets
  static async getFonts(): Promise<string[]> {
    const response: AxiosResponse<string[]> = await apiClient.get('/assets/fonts');
    return response.data;
  }

  static async getFontFamilies(): Promise<Record<string, string[]>> {
    const response: AxiosResponse<Record<string, string[]>> = await apiClient.get('/assets/font-families');
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
