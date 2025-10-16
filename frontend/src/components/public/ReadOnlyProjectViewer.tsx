/**
 * Read-only project viewer for public gallery.
 * Displays project structure and masters without edit capabilities.
 * Follows CLAUDE.md: No dummy implementations, explicit error handling.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Eye, GitFork, Loader2, Info, FileText } from 'lucide-react';
import { PublicAPI } from '@/services/public';
import { useAuth } from '@/auth/useAuth';
import { usePublicProjectsStore } from '@/stores/public';
import { useProjectStore } from '@/stores/projectStore';
import type { Project, PlanSection } from '@/types';
import MasterEditor from '@/components/projects/MasterEditor';
import CloneDialog from './CloneDialog';

const ReadOnlyProjectViewer = () => {
  const { slug, projectId } = useParams<{ slug?: string; projectId?: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const cloneBySlug = usePublicProjectsStore((state) => state.cloneProjectBySlug);
  const cloneById = usePublicProjectsStore((state) => state.cloneProject);
  const cloningId = usePublicProjectsStore((state) => state.cloningId);
  const addProject = useProjectStore((state) => state.addProject);

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'masters' | 'plan'>('masters');
  const [selectedMasterIndex, setSelectedMasterIndex] = useState(0);
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);

  const publicProjectId = projectId || '';
  const identifier = slug ?? projectId ?? '';
  const isSubmitting = Boolean(identifier && cloningId === identifier);

  const loadProject = useCallback(async () => {
    if (!projectId) {
      setError('Missing project ID');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const projectData = await PublicAPI.getProjectDefinition(projectId);
      setProject(projectData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load project';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

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

  const backUrl = slug ? `/gallery/${slug}` : `/gallery/id/${publicProjectId}`;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-eink-dark-gray" />
          <p className="mt-4 text-sm text-eink-dark-gray">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex h-screen flex-col items-center justify-center px-4">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-2xl font-semibold text-eink-black">Project Unavailable</h1>
          <p className="text-sm text-eink-dark-gray">{error || 'Public project not found.'}</p>
          <Link
            to={backUrl}
            className="inline-flex items-center gap-2 rounded-md border border-eink-pale-gray px-4 py-2 text-sm text-eink-dark-gray hover:border-eink-black hover:text-eink-black"
          >
            <ArrowLeft className="h-4 w-4" /> Back to project details
          </Link>
        </div>
      </div>
    );
  }

  const selectedMaster = project.masters?.[selectedMasterIndex];

  // Helper to extract all variables from plan sections recursively
  const extractAllVariables = (sections: PlanSection[]): Record<string, any> => {
    const allVariables: Record<string, any> = {};

    const extractFromSection = (section: PlanSection) => {
      // Add variables from current section's context
      if (section.context && Object.keys(section.context).length > 0) {
        Object.entries(section.context).forEach(([key, value]) => {
          allVariables[key] = value;
        });
      }

      // Add counter variables (counters define variables with start/step values)
      if (section.counters && Object.keys(section.counters).length > 0) {
        Object.entries(section.counters).forEach(([key, config]) => {
          allVariables[key] = `counter(start: ${config.start}, step: ${config.step})`;
        });
      }

      // Recursively extract from nested sections
      if (section.nested && section.nested.length > 0) {
        section.nested.forEach(extractFromSection);
      }
    };

    sections.forEach(extractFromSection);
    return allVariables;
  };

  // Helper to render plan sections recursively
  const renderPlanSection = (section: PlanSection, depth: number = 0): JSX.Element => {
    const indentClass = depth > 0 ? 'ml-6' : '';

    return (
      <div key={section.kind} className={`${indentClass} space-y-2`}>
        <div className="rounded-lg border border-eink-pale-gray bg-white p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="font-semibold text-eink-black">{section.kind}</div>
              <div className="mt-2 space-y-1 text-sm text-eink-dark-gray">
                <div><span className="font-medium">Master:</span> {section.master}</div>
                <div><span className="font-medium">Generate:</span> {section.generate}</div>
                {section.count && <div><span className="font-medium">Count:</span> {section.count}</div>}
                {section.start_date && (
                  <div><span className="font-medium">Start Date:</span> {section.start_date}</div>
                )}
                {section.end_date && (
                  <div><span className="font-medium">End Date:</span> {section.end_date}</div>
                )}
                <div><span className="font-medium">Pages per Item:</span> {section.pages_per_item || 1}</div>
                {section.context && Object.keys(section.context).length > 0 && (
                  <div>
                    <span className="font-medium">Context Variables:</span>
                    <div className="ml-4 mt-1 space-y-1">
                      {Object.entries(section.context).map(([key, value]) => (
                        <div key={key} className="text-xs">
                          {key}: {String(value)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Render nested sections */}
        {section.nested && section.nested.length > 0 && (
          <div className="ml-4 space-y-2 border-l-2 border-blue-200 pl-2">
            {section.nested.map(nestedSection => renderPlanSection(nestedSection, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen flex-col">
      {/* Read-only banner */}
      <div className="flex items-center justify-between bg-blue-50 border-b border-blue-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <Eye className="h-5 w-5 text-blue-600" />
          <div>
            <div className="font-semibold text-blue-900">Read-Only Preview</div>
            <div className="text-xs text-blue-700">
              This is a public project. {isAuthenticated ? 'Clone it to make changes.' : 'Sign in to clone and edit.'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => {
                setCloneError(null);
                setDialogOpen(true);
              }}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <GitFork className="h-4 w-4" />
              {isSubmitting ? 'Cloning…' : 'Clone to Edit'}
            </button>
          ) : (
            <Link
              to="/login"
              state={{ from: window.location.pathname }}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Sign in to Clone
            </Link>
          )}
          <Link
            to={backUrl}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </div>
      </div>

      {/* Project header */}
      <div className="border-b border-eink-pale-gray bg-white px-4 py-3">
        <h1 className="text-lg font-semibold text-eink-black">{project.metadata.name}</h1>
        <p className="text-sm text-eink-dark-gray">{project.metadata.description}</p>
      </div>

      {/* View mode tabs - Masters or Plan Configuration */}
      <div className="flex items-center gap-1 border-b border-eink-pale-gray bg-white px-4">
        <button
          onClick={() => setViewMode('masters')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            viewMode === 'masters'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-eink-dark-gray hover:text-eink-black'
          }`}
        >
          Masters
        </button>
        <button
          onClick={() => setViewMode('plan')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            viewMode === 'plan'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-eink-dark-gray hover:text-eink-black'
          }`}
        >
          Plan Configuration
        </button>
      </div>

      {/* Content area - Masters or Plan */}
      {viewMode === 'masters' ? (
        // Masters view
        project.masters && project.masters.length > 0 ? (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center gap-2 border-b border-eink-pale-gray bg-white px-4">
              {project.masters.map((master, index) => (
                <button
                  key={master.name}
                  onClick={() => setSelectedMasterIndex(index)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    selectedMasterIndex === index
                      ? 'border-eink-black text-eink-black'
                      : 'border-transparent text-eink-dark-gray hover:text-eink-black'
                  }`}
                >
                  {master.name}
                </button>
              ))}
            </div>

            {/* Master editor in read-only mode */}
            {selectedMaster && (
              <div className="flex-1 overflow-hidden">
                <MasterEditor
                  projectId={project.id}
                  masterName={selectedMaster.name}
                  readOnly={true}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <Info className="mx-auto h-12 w-12 text-eink-dark-gray opacity-50" />
              <p className="mt-4 text-sm text-eink-dark-gray">This project has no masters to display.</p>
            </div>
          </div>
        )
      ) : (
        // Plan Configuration view
        <div className="flex-1 overflow-auto bg-eink-off-white p-6">
          {project.plan?.sections && project.plan.sections.length > 0 ? (
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-eink-black mb-2">Plan Configuration</h2>
                <p className="text-sm text-eink-dark-gray">
                  This defines how masters are combined and repeated to generate the final document.
                </p>
              </div>

              {/* Variables Summary */}
              {(() => {
                const allVariables = extractAllVariables(project.plan.sections);
                const variableCount = Object.keys(allVariables).length;

                return variableCount > 0 ? (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 mb-6">
                    <h3 className="font-semibold text-blue-900 mb-3">
                      Defined Variables ({variableCount})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {Object.entries(allVariables).map(([key, value]) => (
                        <div key={key} className="flex items-baseline gap-2 text-sm">
                          <code className="font-mono font-medium text-blue-800 bg-blue-100 px-2 py-0.5 rounded">
                            {'{' + key + '}'}
                          </code>
                          <span className="text-blue-700">=</span>
                          <span className="text-blue-900 truncate">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {project.plan.sections.map((section, index) => (
                <div key={index}>
                  {renderPlanSection(section)}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FileText className="mx-auto h-12 w-12 text-eink-dark-gray opacity-50" />
                <p className="mt-4 text-sm text-eink-dark-gray">This project has no plan configuration.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Clone Dialog */}
      {project && (
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
      )}
    </div>
  );
};

export default ReadOnlyProjectViewer;
