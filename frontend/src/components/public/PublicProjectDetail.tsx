import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, CopyPlus, GitFork, Globe, Loader2 } from 'lucide-react';
import { PublicAPI } from '@/services/public';
import { usePublicProjectsStore } from '@/stores/public';
import { useProjectStore } from '@/stores/projectStore';
import type { PublicProject } from '@/types/public';
import type { Project } from '@/types';
import CloneDialog from './CloneDialog';

interface RouteParams {
  slug?: string;
  projectId?: string;
}

const PublicProjectDetail = () => {
  const { slug, projectId } = useParams<RouteParams>();
  const navigate = useNavigate();

  const cloneBySlug = usePublicProjectsStore((state) => state.cloneProjectBySlug);
  const cloneById = usePublicProjectsStore((state) => state.cloneProject);
  const cloningId = usePublicProjectsStore((state) => state.cloningId);
  const addProject = useProjectStore((state) => state.addProject);

  const [project, setProject] = useState<PublicProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);

  const identifier = slug ?? projectId ?? '';

  const loadProject = useCallback(async () => {
    if (!slug && !projectId) {
      setError('Missing project reference');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const response = slug
        ? await PublicAPI.getProjectBySlug(slug)
        : await PublicAPI.getProject(projectId!);
      setProject(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load project';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [slug, projectId]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  const handleClone = async (payload: { new_name: string; new_description?: string }) => {
    if (!project) {
      return;
    }

    setCloneError(null);
    try {
      let cloned: Project;
      if (slug) {
        cloned = await cloneBySlug(slug, payload);
      } else {
        cloned = await cloneById(project.id, payload);
      }
      addProject(cloned);
      setDialogOpen(false);
      navigate(`/projects/${cloned.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to clone project';
      setCloneError(message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-eink-dark-gray">
        <Loader2 className="h-5 w-5 animate-spin" />
        <p className="mt-3 text-sm">Loading project…</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="max-w-3xl space-y-4 px-6 py-12">
        <button
          type="button"
          onClick={() => navigate('/gallery')}
          className="inline-flex items-center gap-2 rounded-md border border-eink-pale-gray px-3 py-2 text-sm text-eink-dark-gray hover:border-eink-black hover:text-eink-black"
        >
          <ArrowLeft className="h-4 w-4" /> Back to gallery
        </button>
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error ?? 'Public project not available.'}
        </div>
      </div>
    );
  }

  const createdAt = new Date(project.created_at).toLocaleDateString();
  const updatedAt = new Date(project.updated_at).toLocaleDateString();
  const isSubmitting = Boolean(identifier && cloningId === identifier);
  const shareLink = project.metadata.public_url_slug
    ? `${window.location.origin}/gallery/${project.metadata.public_url_slug}`
    : `${window.location.origin}/gallery/id/${project.id}`;

  return (
    <div className="max-w-4xl space-y-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/gallery')}
          className="inline-flex items-center gap-2 rounded-md border border-eink-pale-gray px-3 py-2 text-sm text-eink-dark-gray hover:border-eink-black hover:text-eink-black"
        >
          <ArrowLeft className="h-4 w-4" /> Back to gallery
        </button>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
          <Globe className="h-3 w-3" /> Public template
        </span>
      </div>

      <div className="space-y-3 rounded-lg border border-eink-pale-gray bg-white p-6 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-eink-black">{project.metadata.name}</h1>
          <p className="text-sm text-eink-dark-gray">{project.metadata.description}</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-eink-dark-gray">
          <span className="inline-flex items-center gap-1 rounded-full bg-eink-pale-gray px-2 py-1">
            <Calendar className="h-3 w-3" /> Created {createdAt}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-eink-pale-gray px-2 py-1">
            <Calendar className="h-3 w-3" /> Updated {updatedAt}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-eink-pale-gray px-2 py-1">
            <GitFork className="h-3 w-3" /> Device: {project.metadata.device_profile}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-eink-pale-gray px-2 py-1">
            <CopyPlus className="h-3 w-3" /> Cloned {project.clone_count} times
          </span>
        </div>
        <div className="text-sm text-eink-dark-gray">
          Shared by <span className="font-medium text-eink-black">{project.author}</span>
          {project.original_author && project.original_author !== project.author ? (
            <span> · based on {project.original_author}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setCloneError(null);
              setDialogOpen(true);
            }}
            disabled={isSubmitting}
            className="rounded-md bg-eink-black px-4 py-2 text-sm font-semibold text-eink-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Cloning…' : 'Clone this project'}
          </button>
          <span className="text-xs text-eink-dark-gray">Share link: {shareLink}</span>
        </div>
      </div>

      <div className="rounded-lg border border-eink-pale-gray bg-white p-6 text-sm text-eink-dark-gray">
        <p className="font-semibold text-eink-black">What you get</p>
        <ul className="mt-3 list-disc space-y-1 pl-6">
          <li>Full project with masters, plan configuration, and device profile settings.</li>
          <li>Clone count resets for your copy so you can share your version with others.</li>
          <li>All masters and plan files are copied into your workspace.</li>
        </ul>
      </div>

      <CloneDialog
        isOpen={isDialogOpen}
        initialName={`${project.metadata.name} copy`}
        initialDescription={project.metadata.description}
        error={cloneError}
        isSubmitting={isSubmitting}
        onConfirm={handleClone}
        onClose={() => {
          if (!isSubmitting) {
            setDialogOpen(false);
            setCloneError(null);
          }
        }}
      />
    </div>
  );
};

export default PublicProjectDetail;
