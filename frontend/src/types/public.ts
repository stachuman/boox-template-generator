import type { ProjectMetadata } from './index';

export interface PublicProject {
  id: string;
  metadata: ProjectMetadata;
  url_slug: string | null;
  author: string;
  original_author: string | null;
  clone_count: number;
  created_at: string;
  updated_at: string;
}

export interface PublicProjectListResponse {
  projects: PublicProject[];
  total: number;
}

export interface CloneFormData {
  name: string;
  description?: string;
}
