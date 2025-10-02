import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Download, RefreshCw, Edit2, Check, X } from 'lucide-react';
import { Project, Master, Plan, CompilationResult, DeviceProfile } from '@/types';
import { useProjectStore } from '@/stores/projectStore';
import { APIClient, downloadBlob } from '@/services/api';
import PlanEditor from './PlanEditor';
import PlanPreview from './PlanPreview';
import CreateMasterModal from './CreateMasterModal';
import ProjectSharingControls from './ProjectSharingControls';
import PDFJobStatusComponent from './PDFJobStatus';

const ProjectEditor: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const updateProjectList = useProjectStore((state) => state.updateProject);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'masters' | 'plan' | 'preview'>('masters');
  const [compiledTemplate, setCompiledTemplate] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewPage, setPreviewPage] = useState<number>(1);
  const [previewScale, setPreviewScale] = useState<number>(0.7);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [compileWarnings, setCompileWarnings] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<DeviceProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState<boolean>(false);
  const [savingProfile, setSavingProfile] = useState<boolean>(false);
  const [showCreateMasterModal, setShowCreateMasterModal] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState<string>('');
  const [creatingPDF, setCreatingPDF] = useState<boolean>(false);
  const [jobInProgress, setJobInProgress] = useState<boolean>(false);
  const [currentPDFJobId, setCurrentPDFJobId] = useState<string | null>(null);
  const [completedPDFJobId, setCompletedPDFJobId] = useState<string | null>(null);

  const storageAvailable = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  const getActiveJobKey = () => (projectId ? `einkpdf:pdfjob:active:${projectId}` : null);
  const getCompletedJobKey = () => (projectId ? `einkpdf:pdfjob:completed:${projectId}` : null);

  const persistValue = (key: string | null, value: string | null) => {
    if (!key || !storageAvailable) return;
    try {
      if (value) {
        window.localStorage.setItem(key, value);
      } else {
        window.localStorage.removeItem(key);
      }
    } catch (err) {
      console.warn('Failed to persist PDF job state', err);
    }
  };

  const readValue = (key: string | null): string | null => {
    if (!key || !storageAvailable) return null;
    try {
      return window.localStorage.getItem(key);
    } catch (err) {
      console.warn('Failed to read PDF job state', err);
      return null;
    }
  };

  const persistActiveJob = (jobId: string | null) => persistValue(getActiveJobKey(), jobId);
  const persistCompletedJob = (jobId: string | null) => persistValue(getCompletedJobKey(), jobId);

  // Helper function to create authenticated PDF preview URL
  const createPreviewUrl = async (projectId: string): Promise<string> => {
    try {
      const blob = await APIClient.downloadProjectPDF(projectId, true);
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('Failed to create preview URL:', error);
      throw error;
    }
  };

  useEffect(() => {
    if (!projectId) return;

    loadProject();

    const initializeJobs = async () => {
      const hasActive = await restoreActiveJobFromStorage();
      if (hasActive) return;

      const hasCompleted = await restoreCompletedJobFromStorage();
      if (!hasCompleted) {
        await checkForCompletedPDFJobs();
      }
    };

    initializeJobs();
  }, [projectId]);

  // Check for existing PDF jobs for this project (any status)
  const checkForCompletedPDFJobs = async () => {
    if (!projectId) return;

    try {
      // Check for all jobs (no status filter to get pending/processing/completed)
      const response = await APIClient.listPDFJobs(undefined, 50, 0);

      // Find most recent job for THIS project (jobs are sorted by created_at descending)
      const mostRecentJob = response.jobs.find(job => job.project_id === projectId);

      if (mostRecentJob) {
        setCurrentPDFJobId(mostRecentJob.id);

        if (mostRecentJob.status === 'pending' || mostRecentJob.status === 'processing') {
          // Show ongoing job status
          setJobInProgress(true);
          setCompletedPDFJobId(null);
          persistActiveJob(mostRecentJob.id);
          persistCompletedJob(null);
        } else if (mostRecentJob.status === 'completed') {
          setJobInProgress(false);
          setCompletedPDFJobId(mostRecentJob.id);
          persistActiveJob(null);
          persistCompletedJob(mostRecentJob.id);
        } else {
          // Failed or cancelled job
          setJobInProgress(false);
          setCompletedPDFJobId(null);
          persistActiveJob(null);
          persistCompletedJob(null);
        }
      } else {
        setCurrentPDFJobId(null);
        setJobInProgress(false);
        persistActiveJob(null);
        persistCompletedJob(null);
      }
    } catch (err) {
      console.error('Failed to check for PDF jobs:', err);
      // Non-fatal error, don't block UI
    }
  };

  const restoreActiveJobFromStorage = async (): Promise<boolean> => {
    if (!projectId) return false;

    const storedJobId = readValue(getActiveJobKey());
    if (!storedJobId) return false;

    try {
      const job = await APIClient.getPDFJob(storedJobId);
      if (job.project_id && job.project_id !== projectId) {
        persistActiveJob(null);
        return false;
      }

      if (job.status === 'pending' || job.status === 'processing') {
        setCurrentPDFJobId(job.id);
        setCompletedPDFJobId(null);
        setJobInProgress(true);
        return true;
      }

      if (job.status === 'completed') {
        setCurrentPDFJobId(job.id);
        setCompletedPDFJobId(job.id);
        setJobInProgress(false);
        persistActiveJob(null);
        persistCompletedJob(job.id);
        return true;
      }

      persistActiveJob(null);
    } catch (err) {
      console.warn('Failed to restore active PDF job', err);
      persistActiveJob(null);
    }

    return false;
  };

  const restoreCompletedJobFromStorage = async (): Promise<boolean> => {
    if (!projectId) return false;

    const storedJobId = readValue(getCompletedJobKey());
    if (!storedJobId) return false;

    try {
      const job = await APIClient.getPDFJob(storedJobId);
      if (job.project_id && job.project_id !== projectId) {
        persistCompletedJob(null);
        return false;
      }

      if (job.status === 'completed') {
        setCurrentPDFJobId(job.id);
        setCompletedPDFJobId(job.id);
        setJobInProgress(false);
        return true;
      }

      if (job.status === 'pending' || job.status === 'processing') {
        persistCompletedJob(null);
        persistActiveJob(job.id);
        setCurrentPDFJobId(job.id);
        setCompletedPDFJobId(null);
        setJobInProgress(true);
        return true;
      }

      persistCompletedJob(null);
    } catch (err) {
      console.warn('Failed to restore completed PDF job', err);
      persistCompletedJob(null);
    }

    return false;
  };

  useEffect(() => {
    // Handle tab parameter from URL and reload project data
    const tabParam = searchParams.get('tab');
    if (tabParam && ['masters', 'plan', 'preview'].includes(tabParam)) {
      setActiveTab(tabParam as 'masters' | 'plan' | 'preview');
      // Reload project data when returning from sub-routes with tab parameter
      if (projectId) {
        loadProject();
      }
    }
  }, [searchParams, projectId]);

  useEffect(() => {
    // Load available device profiles for selector
    const loadProfiles = async () => {
      try {
        setProfilesLoading(true);
        const list = await APIClient.getProfiles();
        setProfiles(list);
      } catch (err) {
        // Non-fatal; keep selector read-only if profiles fail to load
        console.warn('Failed to load device profiles');
      } finally {
        setProfilesLoading(false);
      }
    };
    loadProfiles();
  }, []);

  // Auto-update iframe page when preview URL is available
  useEffect(() => {
    if (project && previewUrl) {
      // Clean up previous blob URL to prevent memory leaks
      URL.revokeObjectURL(previewUrl);
      createPreviewUrl(project.id).then(url => {
        setPreviewUrl(url);
      }).catch(err => {
        console.error('Failed to update preview URL:', err);
        setPreviewUrl(null);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewPage]);

  // If a compiled PDF already exists when loading the project, show it automatically
  useEffect(() => {
    const checkExistingPDF = async () => {
      if (!project) return;
      const exists = await APIClient.hasCompiledPDF(project.id);
      if (exists) {
        try {
          const url = await createPreviewUrl(project.id);
          setPreviewUrl(url);
        } catch (err) {
          console.error('Failed to load existing PDF preview:', err);
        }
        // Do not auto-switch tabs; respect user's current tab selection
      }
    };
    checkExistingPDF();
  }, [project]);

  // When switching to Preview tab, auto-load existing PDF if available
  useEffect(() => {
    const maybeLoad = async () => {
      if (activeTab !== 'preview' || !project) return;
      const exists = await APIClient.hasCompiledPDF(project.id);
      if (exists) {
        try {
          const url = await createPreviewUrl(project.id);
          setPreviewUrl(url);
        } catch (err) {
          console.error('Failed to load preview when switching tabs:', err);
        }
      }
    };
    maybeLoad();
  }, [activeTab, project, previewPage]);

  // Cleanup blob URLs when component unmounts to prevent memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const loadProject = async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      setError(null);
      const projectData = await APIClient.getProject(projectId);
      setProject(projectData);
      updateProjectList(projectData.id, { metadata: projectData.metadata, masters: projectData.masters, plan: projectData.plan });
    } catch (err: any) {
      setError(err.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };


  const handlePreviewPDF = async () => {
    if (!project) return;
    try {
      // Ensure compiled PDF exists
      let needCompile = !compiledTemplate;
      if (!compiledTemplate) {
        const result: CompilationResult = await APIClient.compileProject(project.id);
        setCompiledTemplate(result.template_yaml);
        const tp = (result.compilation_stats && result.compilation_stats.total_pages) ? result.compilation_stats.total_pages : 1;
        setTotalPages(tp);
        setPreviewPage(1);
      }
      // Check compiled PDF availability; compile if missing (e.g., cleaned up)
      const available = await APIClient.hasCompiledPDF(project.id);
      if (!available) {
        const result: CompilationResult = await APIClient.compileProject(project.id);
        setCompiledTemplate(result.template_yaml);
      }
      try {
        const url = await createPreviewUrl(project.id);
        setPreviewUrl(url);
      } catch (urlErr) {
        console.error('Failed to create preview URL:', urlErr);
        throw new Error('Failed to create preview URL');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to prepare preview');
    }
  };

  const handleCreatePDF = async () => {
    if (!project) return;

    setError(null);
    setCreatingPDF(true);
    setJobInProgress(true);
    persistCompletedJob(null);

    try {
      const job = await APIClient.createPDFJob({
        project_id: project.id,
        deterministic: false,
        strict_mode: false,
      });

      // Show job status component
      setCurrentPDFJobId(job.id);
      setCompletedPDFJobId(null); // Clear any previous completed job
      persistActiveJob(job.id);
      persistCompletedJob(null);
    } catch (err: any) {
      setError(err.message || 'Failed to create PDF job');
      persistActiveJob(null);
      setJobInProgress(false);
    }
    finally {
      setCreatingPDF(false);
    }
  };

  const handleDownloadReadyPDF = async () => {
    if (!completedPDFJobId || !project) return;

    try {
      const blob = await APIClient.downloadPDFJob(completedPDFJobId);
      const filename = `${project.metadata.name.replace(/[^a-zA-Z0-9\-_\s]/g, '').trim()}.pdf`;
      downloadBlob(blob, filename);
    } catch (err: any) {
      setError(err.message || 'Failed to download PDF');
      persistCompletedJob(null);
    }
  };

  const handleUpdateProjectName = async (newName: string) => {
    if (!project || !newName.trim()) return;

    try {
      setSavingProfile(true); // Reuse loading state
      setError(null);
      const updatedProject = await APIClient.updateProject(project.id, { name: newName.trim() });
      setProject(updatedProject);
      updateProjectList(updatedProject.id, { metadata: updatedProject.metadata });
      setEditingName(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update project name');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleNameEdit = () => {
    if (project) {
      setTempName(project.metadata.name);
      setEditingName(true);
    }
  };

  const handleNameSave = () => {
    if (tempName.trim() !== project?.metadata.name) {
      handleUpdateProjectName(tempName);
    } else {
      setEditingName(false);
    }
  };

  const handleNameCancel = () => {
    setTempName(project?.metadata.name || '');
    setEditingName(false);
  };

  const handleProjectUpdated = (updatedProject: Project) => {
    setProject(updatedProject);
    updateProjectList(updatedProject.id, { metadata: updatedProject.metadata, masters: updatedProject.masters, plan: updatedProject.plan });
  };

  const handleChangeProfile = async (newProfile: string) => {
    if (!project || newProfile === project.metadata.device_profile) return;
    try {
      setSavingProfile(true);
      setError(null);
      const updated = await APIClient.updateProject(project.id, { device_profile: newProfile });
      setProject(updated);
      updateProjectList(updated.id, { metadata: updated.metadata, plan: updated.plan, masters: updated.masters });
      setCompiledTemplate(null);
    } catch (err: any) {
      setError(err.message || 'Failed to update device profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeleteMaster = async (masterName: string) => {
    if (!project || !confirm(`Are you sure you want to delete master "${masterName}"?`)) return;

    try {
      const updatedProject = await APIClient.removeMaster(project.id, masterName);
      setProject(updatedProject);
      updateProjectList(updatedProject.id, { metadata: updatedProject.metadata, masters: updatedProject.masters, plan: updatedProject.plan });
    } catch (err: any) {
      setError(err.message || 'Failed to delete master');
    }
  };

  const handleSavePlan = async (plan: Plan) => {
    if (!project) return;

    try {
      setError(null);
      const updatedProject = await APIClient.updatePlan(project.id, plan);
      setProject(updatedProject);
      updateProjectList(updatedProject.id, { metadata: updatedProject.metadata, plan: updatedProject.plan });
    } catch (err: any) {
      setError(err.message || 'Failed to save plan');
      throw err; // Re-throw to let PlanEditor handle it
    }
  };

  const handleCreateMaster = (masterName: string) => {
    if (!project) {
      setError('Project not loaded');
      return;
    }

    if (!masterName.trim()) {
      setError('Master name is required');
      return;
    }

    setShowCreateMasterModal(false);
    // Navigate to master editor with the pre-filled name
    navigate(`/projects/${project.id}/masters/new?name=${encodeURIComponent(masterName)}`);
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
        <div className="text-eink-dark-gray">Loading project...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-eink-dark-gray mb-2">Project not found</h3>
          <p className="text-eink-dark-gray mb-4">The requested project could not be found.</p>
          <button
            onClick={() => navigate('/projects')}
            className="px-4 py-2 bg-eink-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/projects')}
            className="text-eink-dark-gray hover:text-eink-black transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleNameSave();
                      if (e.key === 'Escape') handleNameCancel();
                    }}
                    className="text-2xl font-bold text-eink-black bg-white border border-eink-light-gray rounded px-2 py-1 focus:outline-none focus:border-eink-black"
                    autoFocus
                    disabled={savingProfile}
                  />
                  <button
                    onClick={handleNameSave}
                    disabled={savingProfile || !tempName.trim()}
                    className="text-green-600 hover:text-green-700 disabled:opacity-50"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleNameCancel}
                    disabled={savingProfile}
                    className="text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-eink-black">{project.metadata.name}</h1>
                  <button
                    onClick={handleNameEdit}
                    className="text-eink-dark-gray hover:text-eink-black transition-colors"
                    title="Edit project name"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            <p className="text-eink-dark-gray mt-1">
              {project.metadata.description || 'No description'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCreatePDF}
            disabled={creatingPDF || jobInProgress || project.masters.length === 0 || project.plan.sections.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-eink-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creatingPDF ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Preparing job...
              </>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                Create PDF
              </>
            )}
          </button>
          {completedPDFJobId && (
            <button
              onClick={handleDownloadReadyPDF}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-5 h-5" />
              Download Ready PDF
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* PDF Job Status */}
      {currentPDFJobId && (
        <div className="mb-6">
          <PDFJobStatusComponent
            jobId={currentPDFJobId}
            autoDownload={false}
            onComplete={(job) => {
              // Job completed successfully - save job ID for download button
              setCompletedPDFJobId(job.id);
              setCurrentPDFJobId(job.id);
              setJobInProgress(false);
              persistActiveJob(null);
              persistCompletedJob(job.id);
            }}
            onError={() => {
              // Job failed
              setJobInProgress(false);
              persistActiveJob(null);
              persistCompletedJob(null);
            }}
            onCancel={() => {
              // Job cancelled
              setJobInProgress(false);
              persistActiveJob(null);
              persistCompletedJob(null);
            }}
          />
        </div>
      )}

      <div className="mb-6">
        <ProjectSharingControls project={project} onProjectUpdated={handleProjectUpdated} />
      </div>

      {/* Project Stats */}
      <div className="mb-6 p-4 bg-gray-50 border border-eink-light-gray rounded-lg">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex flex-col">
            <span className="font-medium text-eink-black mb-1">Device Profile</span>
            <div className="max-w-xs">
              <ProfileSelect
                value={project.metadata.device_profile}
                profiles={profiles}
                loading={profilesLoading || savingProfile}
                onChange={handleChangeProfile}
              />
            </div>
          </div>
          <div>
            <span className="font-medium text-eink-black">Masters:</span>
            <div className="text-eink-dark-gray">{project.masters.length}</div>
          </div>
          <div>
            <span className="font-medium text-eink-black">Plan Sections:</span>
            <div className="text-eink-dark-gray">{project.plan.sections.length}</div>
          </div>
          <div>
            <span className="font-medium text-eink-black">Updated:</span>
            <div className="text-eink-dark-gray">{formatDate(project.metadata.updated_at)}</div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-eink-light-gray mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('masters')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'masters'
                ? 'border-eink-black text-eink-black'
                : 'border-transparent text-eink-dark-gray hover:text-eink-black hover:border-gray-300'
            }`}
          >
            Masters ({project.masters.length})
          </button>
          <button
            onClick={() => setActiveTab('plan')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'plan'
                ? 'border-eink-black text-eink-black'
                : 'border-transparent text-eink-dark-gray hover:text-eink-black hover:border-gray-300'
            }`}
          >
            Plan Configuration ({project.plan.sections.length})
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'preview'
                ? 'border-eink-black text-eink-black'
                : 'border-transparent text-eink-dark-gray hover:text-eink-black hover:border-gray-300'
            }`}
          >
            Preview & Compile
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'masters' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-eink-black">Master Templates</h2>
            <button
              onClick={() => setShowCreateMasterModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-eink-black text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-5 h-5" />
              New Master
            </button>
          </div>

          {project.masters.length === 0 ? (
            <div className="text-center py-12 border border-eink-light-gray rounded-lg">
              <h3 className="text-lg font-medium text-eink-dark-gray mb-2">No masters yet</h3>
              <p className="text-eink-dark-gray mb-4">
                Create your first master template to start building your project
              </p>
              <button
                onClick={() => setShowCreateMasterModal(true)}
                className="px-4 py-2 bg-eink-black text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                Create First Master
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {project.masters.map((master) => (
                <div
                  key={master.name}
                  className="bg-white border border-eink-light-gray rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => navigate(`/projects/${project.id}/masters/${encodeURIComponent(master.name)}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-eink-black mb-1">
                        {master.name}
                      </h3>
                      {master.description && (
                        <p className="text-eink-dark-gray text-sm line-clamp-2">
                          {master.description}
                        </p>
                      )}
                      <div className="text-xs text-eink-dark-gray mt-2">
                        {master.widgets.length} widgets
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteMaster(master.name);
                      }}
                      className="text-eink-light-gray hover:text-red-600 transition-colors p-1"
                      title="Delete master"
                    >
                      ×
                    </button>
                  </div>

                  <div className="text-sm text-eink-dark-gray">
                    <span>Updated {formatDate(master.updated_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'plan' && (
        <div>
          {/* Debug info */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
            <strong>Debug Info:</strong> Available masters: {project.masters.length}
            {project.masters.length > 0 && (
              <span> - {project.masters.map(m => m.name).join(', ')}</span>
            )}
          </div>
          <PlanEditor
            project={project}
            onSave={handleSavePlan}
          />
        </div>
      )}

      {activeTab === 'preview' && (
        <div>
          <PlanPreview
            plan={project.plan}
            masters={project.masters}
          />

          <div className="mt-4 p-4 border rounded-lg bg-white">
            {compileWarnings && compileWarnings.length > 0 && (
              <div className="mb-3 p-2 border border-yellow-300 bg-yellow-50 rounded text-sm text-yellow-900">
                <div className="font-medium mb-1">Warnings ({compileWarnings.length}):</div>
                <ul className="list-disc pl-5">
                  {compileWarnings.slice(0, 10).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                  {compileWarnings.length > 10 && (
                    <li>… and {compileWarnings.length - 10} more</li>
                  )}
                </ul>
              </div>
            )}
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Inline PDF Preview</h3>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 mr-3 text-sm">
                  <button
                    onClick={() => setPreviewPage(p => Math.max(1, p - 1))}
                    disabled={!previewUrl || previewPage <= 1}
                    className="px-2 py-1 border rounded disabled:opacity-50"
                    title="Previous page"
                  >
                    ◀
                  </button>
                  <span>Page</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={previewPage}
                    onChange={(e)=>setPreviewPage(Math.min(Math.max(1, Number(e.target.value)||1), totalPages))}
                    className="w-16 px-2 py-1 border rounded"
                  />
                  <span>of {totalPages}</span>
                  <button
                    onClick={() => setPreviewPage(p => Math.min(totalPages, p + 1))}
                    disabled={!previewUrl || previewPage >= totalPages}
                    className="px-2 py-1 border rounded disabled:opacity-50"
                    title="Next page"
                  >
                    ▶
                  </button>
                </div>
                {/* Scale control removed; browser PDF viewer handles zoom */}
                <button
                  onClick={handlePreviewPDF}
                  className="px-3 py-1.5 border rounded"
                  title={'Render preview'}
                >
                  Render Preview
                </button>
                {/* Removed Open in New Tab button; separate Download button exists in header */}
              </div>
            </div>

            {previewUrl ? (
              <div className="overflow-hidden border rounded bg-gray-50 p-2">
                <iframe title="PDF Preview" src={previewUrl} className="w-full h-[70vh]" style={{ border: 0 }} />
              </div>
            ) : (
              <div className="text-sm text-eink-dark-gray">No preview yet. Click "Render Preview" after compiling to display it here.</div>
            )}
          </div>
        </div>
      )}

      {/* Create Master Modal */}
      {showCreateMasterModal && (
        <CreateMasterModal
          onClose={() => setShowCreateMasterModal(false)}
          onSubmit={handleCreateMaster}
        />
      )}
    </div>
  );
};

export default ProjectEditor;

// Inline profile selector component using the shared Select
import { Select, SelectItem } from '@/components/ui/select';

const ProfileSelect: React.FC<{
  value: string;
  profiles: DeviceProfile[];
  loading?: boolean;
  onChange: (value: string) => void;
}> = ({ value, profiles, loading, onChange }) => {
  // Map profile objects to names (slug stored by backend)
  const names = profiles.map(p => p.name).sort();
  return (
    <Select
      value={value}
      onValueChange={onChange}
      placeholder={loading ? 'Loading profiles…' : 'Select device profile'}
      className={loading ? 'opacity-60 pointer-events-none' : ''}
    >
      {names.map(name => (
        <SelectItem key={name} value={name}>{name}</SelectItem>
      ))}
    </Select>
  );
};
