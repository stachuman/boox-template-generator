import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Github, ExternalLink, Heart, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePublicProjectsStore } from '@/stores/public';
import PublicProjectCard from './PublicProjectCard';
import type { Project, DeviceProfile } from '@/types';
import { VersionService } from '@/services/version';
import { APIClient } from '@/services/api';

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

  const [page, setPage] = useState(1);
  const [deviceFilter, setDeviceFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'name'>('recent');
  const [deviceProfiles, setDeviceProfiles] = useState<DeviceProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);

  const perPage = 20;
  const totalPages = Math.ceil(total / perPage);

  // Load device profiles for filter dropdown
  useEffect(() => {
    const loadProfiles = async () => {
      try {
        setProfilesLoading(true);
        const profiles = await APIClient.getProfiles();
        setDeviceProfiles(profiles);
      } catch (err) {
        console.warn('Failed to load device profiles for filter');
      } finally {
        setProfilesLoading(false);
      }
    };
    void loadProfiles();
  }, []);

  // Fetch projects when pagination or filters change
  useEffect(() => {
    void fetchProjects({
      limit: perPage,
      offset: (page - 1) * perPage,
      device_profile: deviceFilter !== 'all' ? deviceFilter : undefined,
      sort_by: sortBy
    });
  }, [fetchProjects, page, deviceFilter, sortBy]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [deviceFilter, sortBy]);

  return (
    <section className="px-6 py-6">
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-eink-black">Public gallery</h1>
          <p className="text-sm text-eink-dark-gray">
            Discover community templates and clone them into your workspace.
            You can easily adjust template to your device by making a copy to your account, 
            selecting a different profile and then rescaling master pages.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        {/* Filter and sort controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-eink-dark-gray" />
            <span className="text-xs font-medium text-eink-dark-gray">Filters:</span>
          </div>

          {/* Device filter */}
          <select
            value={deviceFilter}
            onChange={(e) => setDeviceFilter(e.target.value)}
            disabled={profilesLoading}
            className="rounded-md border border-eink-pale-gray bg-white px-3 py-1.5 text-xs font-medium text-eink-black focus:border-eink-black focus:outline-none disabled:opacity-50"
          >
            <option value="all">All devices</option>
            {deviceProfiles.map((profile) => (
              <option key={profile.name} value={profile.name}>
                {profile.name}
              </option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'recent' | 'popular' | 'name')}
            className="rounded-md border border-eink-pale-gray bg-white px-3 py-1.5 text-xs font-medium text-eink-black focus:border-eink-black focus:outline-none"
          >
            <option value="recent">Most recent</option>
            <option value="popular">Most popular</option>
            <option value="name">Name (A-Z)</option>
          </select>

          {/* Active filter count */}
          {deviceFilter !== 'all' && (
            <span className="text-xs text-eink-dark-gray">
              {total} matching template{total !== 1 ? 's' : ''}
            </span>
          )}

          {/* Clear filters */}
          {(deviceFilter !== 'all' || sortBy !== 'recent') && (
            <button
              type="button"
              onClick={() => {
                setDeviceFilter('all');
                setSortBy('recent');
              }}
              className="text-xs text-eink-dark-gray hover:text-eink-black underline"
            >
              Clear filters
            </button>
          )}
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

      {!isLoading && !error && total > 0 && projects.length === 0 ? (
        <div className="rounded-md border border-eink-pale-gray bg-white p-6 text-center text-sm text-eink-dark-gray">
          No templates match your filters. Try adjusting your filters.
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

      {/* Pagination controls */}
      {!isLoading && !error && totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="inline-flex items-center gap-1 rounded-md border border-eink-pale-gray bg-white px-3 py-2 text-sm font-medium text-eink-black transition-colors hover:bg-eink-pale-gray disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>

          <span className="text-sm text-eink-dark-gray px-4">
            Page {page} of {totalPages}
          </span>

          <button
            type="button"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="inline-flex items-center gap-1 rounded-md border border-eink-pale-gray bg-white px-3 py-2 text-sm font-medium text-eink-black transition-colors hover:bg-eink-pale-gray disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {!isLoading && !error && projects.length > 0 && (
        <div className="mt-4 text-center text-xs text-eink-dark-gray">
          Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, total)} of {total} template{total !== 1 ? 's' : ''}
        </div>
      )}

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
