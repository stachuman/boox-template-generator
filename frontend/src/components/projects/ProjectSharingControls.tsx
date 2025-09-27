import { useState } from 'react';
import { APIClient } from '@/services/api';
import type { Project } from '@/types';

interface ProjectSharingControlsProps {
  project: Project;
  onProjectUpdated: (project: Project) => void;
}

const normalizeSlug = (input: string): string => {
  const lower = input.trim().toLowerCase();
  const sanitized = lower.replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return sanitized;
};

const ProjectSharingControls = ({ project, onProjectUpdated }: ProjectSharingControlsProps) => {
  const [slug, setSlug] = useState(project.metadata.public_url_slug ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleShare = async (makePublic: boolean) => {
    setIsSaving(true);
    setError(null);
    setInfo(null);
    try {
      const payload = {
        is_public: makePublic,
        url_slug: makePublic ? (slug ? normalizeSlug(slug) : null) : null,
      };
      const updatedProject = await APIClient.shareProject(project.id, payload);
      setSlug(updatedProject.metadata.public_url_slug ?? '');
      onProjectUpdated(updatedProject);
      setInfo(makePublic ? 'Project is now public.' : 'Project is now private.');
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unable to update sharing settings');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const isPublic = project.metadata.is_public;
  const publicUrl = project.metadata.public_url_slug
    ? `${window.location.origin}/gallery/${project.metadata.public_url_slug}`
    : `${window.location.origin}/gallery/id/${project.id}`;

  return (
    <section className="rounded-lg border border-eink-pale-gray bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-eink-black">Sharing</h2>
          <p className="text-sm text-eink-dark-gray">Make this project available in the public gallery.</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            isPublic ? 'bg-emerald-100 text-emerald-700' : 'bg-eink-pale-gray text-eink-dark-gray'
          }`}
        >
          {isPublic ? 'Public' : 'Private'}
        </span>
      </div>

      {isPublic ? (
        <div className="mt-4 space-y-3">
          {publicUrl ? (
            <div className="text-sm text-eink-dark-gray">
              Public URL:{' '}
              <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-eink-black underline">
                {publicUrl}
              </a>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => handleShare(false)}
            disabled={isSaving}
            className="rounded-md border border-eink-pale-gray px-4 py-2 text-sm text-eink-dark-gray transition-colors hover:border-eink-black hover:text-eink-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Updating…' : 'Make private'}
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="space-y-1">
            <label htmlFor="public-slug" className="block text-sm font-medium text-eink-black">
              Custom URL (optional)
            </label>
            <input
              id="public-slug"
              type="text"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="planner-2024"
              className="w-full rounded-md border border-eink-pale-gray px-3 py-2 text-sm focus:border-eink-black focus:outline-none focus:ring-0"
            />
            <p className="text-xs text-eink-dark-gray">
              Use lowercase letters, numbers, or dashes. The gallery will use this slug in the URL.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleShare(true)}
            disabled={isSaving}
            className="rounded-md bg-eink-black px-4 py-2 text-sm font-semibold text-eink-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Publishing…' : 'Share publicly'}
          </button>
        </div>
      )}

      {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
      {info ? <div className="mt-3 text-sm text-emerald-700">{info}</div> : null}
    </section>
  );
};

export default ProjectSharingControls;
