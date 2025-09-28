import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Github, ExternalLink, Heart } from 'lucide-react';
import { usePublicProjectsStore } from '@/stores/public';
import PublicProjectCard from './PublicProjectCard';
import type { Project } from '@/types';
import { VersionService } from '@/services/version';

interface PublicGalleryProps {
  onCloneSuccess?: (project: Project) => void;
}

const PublicGallery = ({ onCloneSuccess }: PublicGalleryProps) => {
  const navigate = useNavigate();
  const fetchProjects = usePublicProjectsStore((state) => state.fetchProjects);
  const projects = usePublicProjectsStore((state) => state.projects);
  const total = usePublicProjectsStore((state) => state.total);
  const isLoading = usePublicProjectsStore((state) => state.isLoading);
  const error = usePublicProjectsStore((state) => state.error);
  const clearError = usePublicProjectsStore((state) => state.clearError);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  return (
    <section className="px-6 py-6">
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-eink-black">Public gallery</h1>
          <p className="text-sm text-eink-dark-gray">
            Discover community templates and clone them into your workspace.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-sm text-eink-dark-gray">Loading public projects…</div>
      ) : null}

      {!isLoading && error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => {
                clearError();
                void fetchProjects();
              }}
              className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
            >
              Try again
            </button>
          </div>
        </div>
      ) : null}

      {!isLoading && !error && projects.length === 0 ? (
        <div className="rounded-md border border-eink-pale-gray bg-white p-6 text-sm text-eink-dark-gray">
          No public projects have been shared yet. Be the first to publish one from the project screen.
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <PublicProjectCard
            key={project.id}
            project={project}
            onCloneSuccess={onCloneSuccess}
            onView={(selected) => {
              const slug = selected.metadata.public_url_slug;
              if (slug) {
                navigate(`/gallery/${slug}`);
              } else {
                navigate(`/gallery/id/${selected.id}`);
              }
            }}
          />
        ))}
      </div>

      {total > projects.length ? (
        <div className="mt-4 text-xs text-eink-dark-gray">
          Showing {projects.length} of {total} public projects.
        </div>
      ) : null}

      <div className="mt-8 border-t border-gray-200 pt-6 text-center">
        <div className="flex items-center justify-center gap-6 text-sm flex-wrap">
          <a
            href="https://github.com/stachuman/boox-template-generator"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-eink-dark-gray hover:text-eink-black transition-colors"
          >
            <Github className="h-4 w-4" />
            <span>Contribute on GitHub</span>
            <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="https://paypal.me/StachuMan"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-red-600 hover:text-red-700 transition-colors"
          >
            <Heart className="h-4 w-4" />
            <span>Support this project</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="text-xs text-eink-dark-gray">
          {VersionService.getAppName()} {VersionService.getVersionString()}
        </div>
      </div>
    </section>
  );
};

export default PublicGallery;
