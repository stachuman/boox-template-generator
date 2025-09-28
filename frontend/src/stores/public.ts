import { create } from 'zustand';
import { PublicAPI } from '@/services/public';
import type { PublicProjectListResponse, PublicProject } from '@/types/public';
import type { CloneProjectRequestPayload, Project } from '@/types';
import { APIClientError } from '@/services/api';

interface PublicProjectsStore {
  projects: PublicProject[];
  total: number;
  isLoading: boolean;
  cloningId: string | null;
  downloadingId: string | null;
  error: string | null;
  fetchProjects: () => Promise<void>;
  cloneProject: (projectId: string, payload: CloneProjectRequestPayload) => Promise<Project>;
  cloneProjectBySlug: (slug: string, payload: CloneProjectRequestPayload) => Promise<Project>;
  downloadProjectPdf: (projectId: string, projectName?: string) => Promise<void>;
  clearError: () => void;
}

const extractErrorMessage = (error: unknown): string => {
  if (error instanceof APIClientError) {
    return error.apiError.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unable to load public projects';
};

export const usePublicProjectsStore = create<PublicProjectsStore>((set) => ({
  projects: [],
  total: 0,
  isLoading: false,
  cloningId: null,
  downloadingId: null,
  error: null,

  async fetchProjects() {
    set({ isLoading: true, error: null });
    try {
      const response: PublicProjectListResponse = await PublicAPI.listProjects();
      set({
        projects: response.projects,
        total: response.total,
        isLoading: false,
      });
    } catch (error) {
      set({ error: extractErrorMessage(error), isLoading: false });
    }
  },

  async cloneProject(projectId, payload) {
    set({ cloningId: projectId, error: null });
    try {
      const project = await PublicAPI.cloneProject(projectId, payload);
      set((state) => ({
        cloningId: null,
        error: null,
        projects: state.projects.map((item) =>
          item.id === projectId ? { ...item, clone_count: item.clone_count + 1 } : item
        ),
      }));
      return project;
    } catch (error) {
      set({ cloningId: null, error: extractErrorMessage(error) });
      throw error;
    }
  },

  async cloneProjectBySlug(slug, payload) {
    set({ cloningId: slug, error: null });
    try {
      const project = await PublicAPI.cloneProjectBySlug(slug, payload);
      set((state) => ({
        cloningId: null,
        error: null,
        projects: state.projects.map((item) =>
          item.metadata.public_url_slug === slug
            ? { ...item, clone_count: item.clone_count + 1 }
            : item
        ),
      }));
      return project;
    } catch (error) {
      set({ cloningId: null, error: extractErrorMessage(error) });
      throw error;
    }
  },

  async downloadProjectPdf(projectId, projectName) {
    set({ downloadingId: projectId, error: null });
    try {
      const filename = projectName ? `${projectName}.pdf` : 'project.pdf';
      await PublicAPI.downloadProjectPdf(projectId, filename);
      set({ downloadingId: null });
    } catch (error) {
      set({ downloadingId: null, error: extractErrorMessage(error) });
      throw error;
    }
  },

  clearError() {
    set({ error: null });
  },
}));
