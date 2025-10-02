/**
 * ProjectList component for displaying and managing projects.
 *
 * Shows a list of projects with options to create, edit, and delete.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Folder, User, Globe, CopyPlus } from 'lucide-react';
import { ProjectListItem, CreateProjectRequest } from '@/types';
import { APIClient } from '@/services/api';
import CreateProjectModal from './CreateProjectModal';

const ProjectList: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const storageAvailable = typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
  const storageKey = 'einkpdf:projects:list';

  const loadProjects = async (showSpinner: boolean = true) => {
    try {
      if (showSpinner) {
        setLoading(true);
      }
      setError(null);
      const projectList = await APIClient.getProjects();
      setProjects(projectList);

      if (storageAvailable) {
        try {
          window.sessionStorage.setItem(storageKey, JSON.stringify(projectList));
        } catch (err) {
          console.warn('Failed to cache projects', err);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load projects');
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    let cachedProjects: ProjectListItem[] | null = null;

    if (storageAvailable) {
      try {
        const cached = window.sessionStorage.getItem(storageKey);
        if (cached) {
          cachedProjects = JSON.parse(cached) as ProjectListItem[];
          setProjects(cachedProjects);
          setLoading(false);
        }
      } catch (err) {
        console.warn('Failed to read cached projects', err);
        window.sessionStorage.removeItem(storageKey);
      }
    }

    loadProjects(!cachedProjects);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateProject = async (request: CreateProjectRequest) => {
    try {
      const newProject = await APIClient.createProject(request);
      setProjects((prev) => {
        const updatedList = [
          {
            id: newProject.id,
            name: newProject.metadata.name,
            description: newProject.metadata.description,
            masters_count: newProject.masters.length,
            plan_sections_count: newProject.plan.sections.length,
            created_at: newProject.metadata.created_at,
            updated_at: newProject.metadata.updated_at,
            is_public: newProject.metadata.is_public,
            public_url_slug: newProject.metadata.public_url_slug,
            clone_count: newProject.metadata.clone_count,
          },
          ...prev,
        ];

        if (storageAvailable) {
          try {
            window.sessionStorage.setItem(storageKey, JSON.stringify(updatedList));
          } catch (err) {
            console.warn('Failed to cache updated projects list', err);
          }
        }

        return updatedList;
      });
      setShowCreateModal(false);
      // Navigate to the new project
      navigate(`/projects/${newProject.id}`);
    } catch (err: any) {
      throw err; // Let modal handle the error
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    try {
      await APIClient.deleteProject(projectId);
      setProjects(prev => {
        const updated = prev.filter(p => p.id !== projectId);

        if (storageAvailable) {
          try {
            window.sessionStorage.setItem(storageKey, JSON.stringify(updated));
          } catch (err) {
            console.warn('Failed to cache projects after deletion', err);
          }
        }

        return updated;
      });
    } catch (err: any) {
      setError(err.message || 'Failed to delete project');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-eink-dark-gray">Loading projects...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-eink-black">Projects</h1>
          <p className="text-eink-dark-gray mt-1">
            Create and manage your PDF template projects
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-eink-black text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Project
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="text-center py-12">
          <Folder className="w-16 h-16 text-eink-light-gray mx-auto mb-4" />
          <h3 className="text-lg font-medium text-eink-dark-gray mb-2">No projects yet</h3>
          <p className="text-eink-dark-gray mb-4">
            Create your first project to get started with PDF templates
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-eink-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-white border border-eink-light-gray rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-eink-black mb-1">
                    {project.name}
                  </h3>
                  {project.description ? (
                    <p className="text-eink-dark-gray text-sm line-clamp-2">
                      {project.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                  {project.is_public ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                      <Globe className="h-3 w-3" /> Public
                    </span>
                  ) : null}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject(project.id);
                    }}
                    className="text-eink-light-gray hover:text-red-600 transition-colors p-1"
                    title="Delete project"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2 text-sm text-eink-dark-gray">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <Folder className="w-4 h-4" />
                    {project.masters_count} masters
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CopyPlus className="w-4 h-4" />
                    {project.plan_sections_count} sections
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-eink-dark-gray">
                  <span>Updated {formatDate(project.updated_at)}</span>
                  {project.clone_count > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {project.clone_count} clones
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="mt-2 text-xs text-eink-dark-gray">Created {formatDate(project.created_at)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateProject}
        />
      )}
    </div>
  );
};

export default ProjectList;
