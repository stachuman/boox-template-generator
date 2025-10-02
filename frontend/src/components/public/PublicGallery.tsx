import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Github, ExternalLink, Heart, Search, SlidersHorizontal } from 'lucide-react';
import { usePublicProjectsStore } from '@/stores/public';
import PublicProjectCard from './PublicProjectCard';
import type { Project } from '@/types';
import type { PublicProject } from '@/types/public';
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

  const [searchQuery, setSearchQuery] = useState('');
  const [deviceFilter, setDeviceFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'name'>('recent');

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  // Get unique device profiles from projects
  const deviceProfiles = useMemo(() => {
    const profiles = new Set(projects.map(p => p.metadata.device_profile));
    return Array.from(profiles).sort();
  }, [projects]);

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    let filtered = [...projects];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.metadata.name.toLowerCase().includes(query) ||
          p.metadata.description?.toLowerCase().includes(query) ||
          p.author.toLowerCase().includes(query)
      );
    }

    // Apply device filter
    if (deviceFilter !== 'all') {
      filtered = filtered.filter((p) => p.metadata.device_profile === deviceFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          return b.clone_count - a.clone_count;
        case 'name':
          return a.metadata.name.localeCompare(b.metadata.name);
        case 'recent':
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });

    return filtered;
  }, [projects, searchQuery, deviceFilter, sortBy]);

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

      {/* Filters */}
      <div className="mb-6 space-y-3">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-eink-dark-gray" />
          <input
            type="text"
            placeholder="Search templates, descriptions, or authors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-eink-pale-gray bg-white py-2 pl-10 pr-4 text-sm text-eink-black placeholder-eink-dark-gray focus:border-eink-black focus:outline-none"
          />
        </div>

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
            className="rounded-md border border-eink-pale-gray bg-white px-3 py-1.5 text-xs font-medium text-eink-black focus:border-eink-black focus:outline-none"
          >
            <option value="all">All devices</option>
            {deviceProfiles.map((profile) => (
              <option key={profile} value={profile}>
                {profile}
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
          {(searchQuery || deviceFilter !== 'all') && (
            <span className="text-xs text-eink-dark-gray">
              {filteredProjects.length} of {projects.length} templates
            </span>
          )}

          {/* Clear filters */}
          {(searchQuery || deviceFilter !== 'all' || sortBy !== 'recent') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
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

      {!isLoading && !error && projects.length > 0 && filteredProjects.length === 0 ? (
        <div className="rounded-md border border-eink-pale-gray bg-white p-6 text-center text-sm text-eink-dark-gray">
          No templates match your filters. Try adjusting your search or filters.
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filteredProjects.map((project) => (
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

      {!isLoading && !error && filteredProjects.length > 0 && (
        <div className="mt-4 text-xs text-eink-dark-gray">
          Showing {filteredProjects.length} {filteredProjects.length !== projects.length ? `of ${projects.length}` : ''} template{filteredProjects.length !== 1 ? 's' : ''}.
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
