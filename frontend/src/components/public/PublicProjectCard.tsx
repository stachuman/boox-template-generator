import { useState } from 'react';
import { Calendar, CopyPlus, GitFork, Download } from 'lucide-react';
import { usePublicProjectsStore } from '@/stores/public';
import CloneDialog from './CloneDialog';
import type { PublicProject } from '@/types/public';
import type { Project, CloneProjectRequestPayload } from '@/types';
import { APIClientError } from '@/services/api';

interface PublicProjectCardProps {
  project: PublicProject;
  onCloneSuccess?: (project: Project) => void;
  onView?: (project: PublicProject) => void;
}

const PublicProjectCard = ({ project, onCloneSuccess, onView }: PublicProjectCardProps) => {
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const cloneProject = usePublicProjectsStore((state) => state.cloneProject);
  const downloadProjectPdf = usePublicProjectsStore((state) => state.downloadProjectPdf);
  const cloningId = usePublicProjectsStore((state) => state.cloningId);
  const downloadingId = usePublicProjectsStore((state) => state.downloadingId);

  const handleClone = async (payload: CloneProjectRequestPayload) => {
    try {
      const result = await cloneProject(project.id, payload);
      setCloneError(null);
      setDialogOpen(false);
      onCloneSuccess?.(result);
    } catch (error) {
      if (error instanceof APIClientError) {
        setCloneError(error.apiError.message);
      } else if (error instanceof Error) {
        setCloneError(error.message);
      } else {
        setCloneError('Unable to clone project');
      }
    }
  };

  const handleDownload = async () => {
    try {
      await downloadProjectPdf(project.id, project.metadata.name);
    } catch (error) {
      // Error is handled in the store
      console.error('Download failed:', error);
    }
  };

  const isCloning = cloningId === project.id;
  const isDownloading = downloadingId === project.id;

  return (
    <div
      className="flex h-full flex-col rounded-lg border border-eink-pale-gray bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
      onClick={() => onView?.(project)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          onView?.(project);
        }
      }}
    >
      <div className="flex-1 space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-eink-black">{project.metadata.name}</h3>
          <p className="mt-1 text-sm text-eink-dark-gray">{project.metadata.description}</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-eink-dark-gray">
          <span className="inline-flex items-center space-x-1 rounded-full bg-eink-pale-gray px-2 py-1">
            <Calendar className="h-3 w-3" />
            <span>{new Date(project.created_at).toLocaleDateString()}</span>
          </span>
          <span className="inline-flex items-center space-x-1 rounded-full bg-eink-pale-gray px-2 py-1">
            <CopyPlus className="h-3 w-3" />
            <span>{project.clone_count} clones</span>
          </span>
          <span className="inline-flex items-center space-x-1 rounded-full bg-eink-pale-gray px-2 py-1">
            <GitFork className="h-3 w-3" />
            <span>{project.metadata.device_profile}</span>
          </span>
        </div>
        <div className="text-xs text-eink-dark-gray">
          Shared by <span className="font-medium text-eink-black">{project.author}</span>
          {project.original_author && project.original_author !== project.author ? (
            <span> · based on {project.original_author}</span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-eink-dark-gray">
          Last updated {new Date(project.updated_at).toLocaleDateString()}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleDownload();
            }}
            disabled={isDownloading}
            className="flex items-center gap-2 rounded-md border border-eink-light-gray px-3 py-2 text-sm font-medium text-eink-black transition-colors hover:bg-eink-pale-gray disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" />
            {isDownloading ? 'Downloading...' : 'Download PDF'}
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setCloneError(null);
              setDialogOpen(true);
            }}
            disabled={isCloning}
            className="rounded-md bg-eink-black px-3 py-2 text-sm font-semibold text-eink-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCloning ? 'Cloning...' : 'Clone project'}
          </button>
        </div>
      </div>

      <CloneDialog
        isOpen={isDialogOpen}
        initialName={`${project.metadata.name} copy`}
        initialDescription={project.metadata.description}
        error={cloneError}
        isSubmitting={isCloning}
        onConfirm={handleClone}
        onClose={() => {
          if (!isCloning) {
            setDialogOpen(false);
            setCloneError(null);
          }
        }}
      />
    </div>
  );
};

export default PublicProjectCard;
