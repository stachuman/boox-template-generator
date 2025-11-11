import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Download, RefreshCw, Edit2, Check, X, Eye, Trash2 } from 'lucide-react';
import { Project, Plan, DeviceProfile, Widget } from '@/types';
import { useProjectStore } from '@/stores/projectStore';
import { APIClient, downloadBlob } from '@/services/api';
import PlanEditor from './PlanEditor';
import PlanPreview from './PlanPreview';
import CreateMasterModal from './CreateMasterModal';
import ProjectSharingControls from './ProjectSharingControls';
import PDFJobStatusComponent from './PDFJobStatus';

/**
 * Generate a human-readable breakdown of widget types.
 * Simplifies widget type names for display.
 */
function getWidgetTypeBreakdown(widgets: Widget[]): string {
  if (widgets.length === 0) return 'No widgets';

  const counts: Record<string, number> = {};

  widgets.forEach(w => {
    // Simplify widget type names for readability
    const shortType = w.type
      .replace('_block', '')
      .replace('_grid', '')
      .replace('_list', '')
      .replace('_', ' ');
    counts[shortType] = (counts[shortType] || 0) + 1;
  });

  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)  // Sort by count descending
    .map(([type, count]) => `${count} ${type}`)
    .join(', ');
}

const ProjectEditor: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const updateProjectList = useProjectStore((state) => state.updateProject);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'masters' | 'plan' | 'preview' | 'sharing'>('masters');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compileWarnings] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<DeviceProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState<boolean>(false);
  const [savingProfile, setSavingProfile] = useState<boolean>(false);
  const [showCreateMasterModal, setShowCreateMasterModal] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState<string>('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [tempDescription, setTempDescription] = useState<string>('');
  const [creatingPDF, setCreatingPDF] = useState<boolean>(false);
  const [jobInProgress, setJobInProgress] = useState<boolean>(false);
  const [currentPDFJobId, setCurrentPDFJobId] = useState<string | null>(null);
  // Keep job ID for localStorage persistence and debugging (not used for UI logic)
  const [_completedPDFJobId, setCompletedPDFJobId] = useState<string | null>(null);
  // Following CLAUDE.md Rule #3: Track ACTUAL PDF existence, not just job state
  const [pdfExists, setPdfExists] = useState<boolean>(false);

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

    // Following CLAUDE.md Rule #3: Clear stale error state on project load
    setError(null);

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
        // Job belongs to different project - clear it
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

      // Job exists but has failed/cancelled status - clear it
      persistActiveJob(null);
    } catch (err: any) {
      // Following CLAUDE.md Rule #3: Don't show errors for stale job state - PDF existence is what matters
      // Only clear localStorage for permanent failures (404 = job doesn't exist)
      const is404 = err.status === 404 ||
                    err.response?.status === 404 ||
                    err.message?.includes('404') ||
                    err.message?.includes('Not Found');

      if (is404) {
        console.warn('Active PDF job not found (404), clearing storage:', storedJobId);
        persistActiveJob(null);
      } else {
        // Likely stale job from previous session - clear it to avoid repeated errors
        console.warn('Failed to restore active PDF job (clearing stale localStorage):', err);
        persistActiveJob(null);
      }
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
        // Job belongs to different project - clear it
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
        // Job status changed from completed to in-progress (rare edge case)
        persistCompletedJob(null);
        persistActiveJob(job.id);
        setCurrentPDFJobId(job.id);
        setCompletedPDFJobId(null);
        setJobInProgress(true);
        return true;
      }

      // Job exists but has failed/cancelled status - clear it
      persistCompletedJob(null);
    } catch (err: any) {
      // Following CLAUDE.md Rule #3: Don't show errors for stale job state - PDF existence is what matters
      // Only clear localStorage for permanent failures (404 = job doesn't exist)
      const is404 = err.status === 404 ||
                    err.response?.status === 404 ||
                    err.message?.includes('404') ||
                    err.message?.includes('Not Found');

      if (is404) {
        console.warn('Completed PDF job not found (404), clearing storage:', storedJobId);
        persistCompletedJob(null);
      } else {
        // Likely stale job from previous session - clear it to avoid repeated errors
        console.warn('Failed to restore completed PDF job (clearing stale localStorage):', err);
        persistCompletedJob(null);
      }
    }

    return false;
  };

  useEffect(() => {
    // Handle tab parameter from URL and reload project data
    const tabParam = searchParams.get('tab');
    if (tabParam && ['masters', 'plan', 'preview', 'sharing'].includes(tabParam)) {
      setActiveTab(tabParam as 'masters' | 'plan' | 'preview' | 'sharing');
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

  // If a compiled PDF already exists when loading the project, show it automatically
  // Following CLAUDE.md Rule #3: Check ACTUAL file existence, not just job records
  useEffect(() => {
    const checkExistingPDF = async () => {
      if (!project) return;
      const exists = await APIClient.hasCompiledPDF(project.id);
      setPdfExists(exists); // Track actual PDF existence
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
      setPdfExists(exists); // Track actual PDF existence
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
  }, [activeTab, project]);

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

      // Check if device profile exists - warn user if not
      // This happens when profiles are renamed/removed (e.g., boox-tab-ultra-c split into -portrait/-landscape)
      if (profiles.length > 0) {
        const profileExists = profiles.some(p => p.name === projectData.metadata.device_profile);
        if (!profileExists) {
          setError(
            `Device profile '${projectData.metadata.device_profile}' is not available. ` +
            `Please select a valid device profile from the Preview tab.`
          );
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };



  const handleCreatePDF = async () => {
    if (!project) return;

    setError(null);
    setCreatingPDF(true);
    setJobInProgress(true);

    // IMPORTANT: Clear old job first to force component remount
    setCurrentPDFJobId(null);
    setCompletedPDFJobId(null);
    // Don't clear pdfExists yet - old PDF still exists until new one replaces it
    persistCompletedJob(null);

    try {
      const job = await APIClient.createPDFJob({
        project_id: project.id,
        deterministic: false,
        strict_mode: false,
      });

      console.log('[ProjectEditor] Created new job:', job.id);

      // Show job status component with NEW job ID
      setCurrentPDFJobId(job.id);
      persistActiveJob(job.id);

      console.log('[ProjectEditor] State updated, currentPDFJobId should be:', job.id);
    } catch (err: any) {
      setError(err.message || 'Failed to create PDF job');
      persistActiveJob(null);
      setJobInProgress(false);
      setCurrentPDFJobId(null);
    }
    finally {
      setCreatingPDF(false);
    }
  };

  // Following CLAUDE.md Rule #5: Better solution for e-ink - open PDF directly
  // Following CLAUDE.md Rule #3: Proper authentication handling
  const handleOpenPDF = async () => {
    if (!project) {
      setError('Project not loaded');
      return;
    }

    try {
      // Download PDF with authentication (inline mode for viewing)
      const blob = await APIClient.downloadProjectPDF(project.id, true);

      // Create object URL from authenticated blob
      const url = URL.createObjectURL(blob);

      // Open in new tab - works reliably on all devices including e-ink
      window.open(url, '_blank');

      // Clean up object URL after some time (blob is already loaded in new tab)
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (err: any) {
      const is404 = err.status === 404 ||
                    err.response?.status === 404 ||
                    err.message?.includes('404') ||
                    err.message?.includes('Not Found');

      if (is404) {
        setError('PDF not found. It may have been deleted.');
        setPdfExists(false);
      } else {
        setError(err.message || 'Failed to open PDF. Please try again.');
      }
    }
  };

  // Following CLAUDE.md Rule #3: Download with proper fallback for devices where it works
  const handleDownloadReadyPDF = async () => {
    if (!project) {
      setError('Project not loaded');
      return;
    }

    // Verify PDF actually exists before attempting download
    try {
      const exists = await APIClient.hasCompiledPDF(project.id);
      if (!exists) {
        setError('PDF not found. It may have been deleted.');
        setPdfExists(false);
        return;
      }
    } catch (err: any) {
      console.error('Failed to check PDF existence:', err);
      // Continue with download attempt - hasCompiledPDF might have transient error
    }

    try {
      // Download from project endpoint (PDF is stored by project ID)
      const blob = await APIClient.downloadProjectPDF(project.id);
      const filename = `${project.metadata.name.replace(/[^a-zA-Z0-9\-_\s]/g, '').trim()}.pdf`;
      downloadBlob(blob, filename);
    } catch (err: any) {
      // Only clear PDF existence state if PDF is permanently gone (404)
      // Keep it for transient download errors (network, auth, server errors)
      const is404 = err.status === 404 ||
                    err.response?.status === 404 ||
                    err.message?.includes('404') ||
                    err.message?.includes('Not Found');

      if (is404) {
        setError('PDF not found. It may have been deleted or expired.');
        setPdfExists(false);
        persistCompletedJob(null);
        setCompletedPDFJobId(null);
      } else {
        // Following CLAUDE.md Rule #3: Explicit error with fallback suggestion
        setError('Download failed. Try "Open PDF" button or use browser\'s download feature.');
        // Keep PDF existence state - PDF still exists, download just failed
      }
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

  const handleUpdateProjectDescription = async (newDescription: string) => {
    if (!project) return;

    try {
      setSavingProfile(true); // Reuse loading state
      setError(null);
      const updatedProject = await APIClient.updateProject(project.id, { description: newDescription.trim() });
      setProject(updatedProject);
      updateProjectList(updatedProject.id, { metadata: updatedProject.metadata });
      setEditingDescription(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update project description');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDescriptionEdit = () => {
    if (project) {
      setTempDescription(project.metadata.description || '');
      setEditingDescription(true);
    }
  };

  const handleDescriptionSave = () => {
    if (tempDescription.trim() !== (project?.metadata.description || '')) {
      handleUpdateProjectDescription(tempDescription);
    } else {
      setEditingDescription(false);
    }
  };

  const handleDescriptionCancel = () => {
    setTempDescription(project?.metadata.description || '');
    setEditingDescription(false);
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
    } catch (err: any) {
      setError(err.message || 'Failed to update device profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleRenameMaster = async (masterName: string) => {
    if (!project) return;

    // Prompt for new name
    const newName = prompt(`Rename master "${masterName}" to:`, masterName);

    // User cancelled
    if (newName === null) return;

    // User entered same name
    if (newName.trim() === masterName) return;

    // User entered empty name
    if (!newName.trim()) {
      alert('Master name cannot be empty');
      return;
    }

    // Validate name format (only letters, numbers, spaces, hyphens, underscores)
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(newName)) {
      alert('Master name can only contain letters, numbers, spaces, hyphens, and underscores');
      return;
    }

    try {
      const updatedProject = await APIClient.updateMaster(project.id, masterName, { new_name: newName.trim() });
      setProject(updatedProject);
      updateProjectList(updatedProject.id, { metadata: updatedProject.metadata, masters: updatedProject.masters, plan: updatedProject.plan });
    } catch (err: any) {
      console.error('Failed to rename master:', err);
      alert(`Failed to rename master: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleDuplicateMaster = async (masterName: string) => {
    if (!project) return;

    // Prompt for new name
    const defaultName = `${masterName} - copy`;
    const newName = prompt(`Enter name for duplicated master:`, defaultName);

    // User cancelled
    if (newName === null) return;

    // User entered empty name
    if (!newName.trim()) {
      alert('Master name cannot be empty');
      return;
    }

    // Validate name format (only letters, numbers, spaces, hyphens, underscores)
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(newName)) {
      alert('Master name can only contain letters, numbers, spaces, hyphens, and underscores');
      return;
    }

    try {
      const updatedProject = await APIClient.duplicateMaster(project.id, masterName, undefined, newName.trim());
      setProject(updatedProject);
      updateProjectList(updatedProject.id, { metadata: updatedProject.metadata, masters: updatedProject.masters, plan: updatedProject.plan });
    } catch (err: any) {
      console.error('Failed to duplicate master:', err);
      alert(`Failed to duplicate master: ${err.response?.data?.detail || err.message}`);
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

  const handleCreateMaster = async (masterName: string) => {
    if (!project) {
      setError('Project not loaded');
      return;
    }

    if (!masterName.trim()) {
      setError('Master name is required');
      return;
    }

    setShowCreateMasterModal(false);

    try {
      // Create empty master immediately (following CLAUDE.md - explicit action, no silent defaults)
      const emptyTemplate = {
        schema_version: "1.0",
        metadata: {
          name: masterName.trim(),
          description: "",
          category: project.metadata.category || "general",
          version: "1.0",
          author: project.metadata.author || "",
          created: new Date().toISOString(),
          profile: project.metadata.device_profile
        },
        canvas: project.default_canvas || {
          dimensions: {
            width: 612,
            height: 792,
            margins: [72, 72, 72, 72]
          },
          coordinate_system: "top_left",
          background: "#ffffff"
        },
        widgets: [],
        navigation: {},
        export: {
          default_mode: "interactive"
        }
      };

      const request = {
        name: masterName.trim(),
        template_yaml: JSON.stringify(emptyTemplate, null, 2),
        description: ''
      };

      // Create the master via API
      const updatedProject = await APIClient.addMaster(project.id, request);
      setProject(updatedProject);

      // Navigate to the newly created master for editing
      navigate(`/projects/${project.id}/masters/${encodeURIComponent(masterName.trim())}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create master');
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
            {editingDescription ? (
              <div className="flex items-center gap-2 mt-2">
                <textarea
                  value={tempDescription}
                  onChange={(e) => setTempDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') handleDescriptionCancel();
                    if (e.key === 'Enter' && e.ctrlKey) handleDescriptionSave();
                  }}
                  placeholder="Enter project description..."
                  className="flex-1 text-sm text-eink-dark-gray bg-white border border-eink-light-gray rounded px-2 py-1 focus:outline-none focus:border-eink-black resize-none"
                  rows={2}
                  autoFocus
                  disabled={savingProfile}
                />
                <button
                  onClick={handleDescriptionSave}
                  disabled={savingProfile}
                  className="text-green-600 hover:text-green-700 disabled:opacity-50"
                  title="Save description (Ctrl+Enter)"
                >
                  <Check className="w-5 h-5" />
                </button>
                <button
                  onClick={handleDescriptionCancel}
                  disabled={savingProfile}
                  className="text-red-600 hover:text-red-700 disabled:opacity-50"
                  title="Cancel (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <p className="text-eink-dark-gray">
                  {project.metadata.description || 'No description'}
                </p>
                <button
                  onClick={handleDescriptionEdit}
                  className="text-eink-dark-gray hover:text-eink-black transition-colors"
                  title="Edit project description"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="text-sm text-eink-dark-gray">
          Updated: {formatDate(project.metadata.updated_at)}
        </div>
      </div>

      {/* Device Profile Selection - Project-wide Setting */}
      <div className="mb-6 p-4 bg-white border-2 border-eink-light-gray rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <label className="text-sm font-semibold text-eink-dark-gray mb-1">Device Profile</label>
              <div className="text-xs text-eink-gray mb-2">Target device for this project</div>
              <div className="w-80">
                <ProfileSelect
                  value={project.metadata.device_profile}
                  profiles={profiles}
                  loading={profilesLoading || savingProfile}
                  onChange={handleChangeProfile}
                />
              </div>
            </div>
            {(() => {
              const currentProfile = profiles.find(p => p.name === project.metadata.device_profile);
              if (!currentProfile) return null;

              const screenSize = currentProfile.display?.screen_size || [0, 0];
              const ppi = currentProfile.display?.ppi || 0;
              const physicalSize = currentProfile.display?.physical_size || 'Unknown';
              const isColor = currentProfile.display?.color || false;

              return (
                <div className="flex flex-col gap-1 text-sm text-eink-dark-gray">
                  <div><span className="font-medium">Canvas:</span> {screenSize[0]} × {screenSize[1]}px</div>
                  <div><span className="font-medium">Display:</span> {physicalSize} @ {ppi} PPI</div>
                  <div><span className="font-medium">Type:</span> {isColor ? 'Color E-ink' : 'Grayscale E-ink'}</div>
                </div>
              );
            })()}
          </div>
          {savingProfile && (
            <div className="flex items-center gap-2 text-sm text-eink-dark-gray">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Saving...
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Progress Tracker */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-blue-900 mb-3">Project Progress</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              {/* Step 1: Pages Designed */}
              <div className="flex items-start gap-2">
                {project.masters.length > 0 ? (
                  <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 000 2h4a1 1 0 100-2H8z" clipRule="evenodd" />
                  </svg>
                )}
                <div>
                  <div className={`font-medium ${project.masters.length > 0 ? 'text-green-900' : 'text-gray-600'}`}>
                    Pages Designed
                  </div>
                  <div className="text-xs text-gray-600">
                    {project.masters.length} page{project.masters.length !== 1 ? 's' : ''} created
                  </div>
                </div>
              </div>

              {/* Step 2: Structure Defined */}
              <div className="flex items-start gap-2">
                {project.plan?.sections && project.plan.sections.length > 0 ? (
                  <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 000 2h4a1 1 0 100-2H8z" clipRule="evenodd" />
                  </svg>
                )}
                <div>
                  <div className={`font-medium ${project.plan?.sections && project.plan.sections.length > 0 ? 'text-green-900' : 'text-gray-600'}`}>
                    Structure Defined
                  </div>
                  <div className="text-xs text-gray-600">
                    {project.plan?.sections ? `${project.plan.sections.length} section${project.plan.sections.length !== 1 ? 's' : ''}` : 'Not configured'}
                  </div>
                </div>
              </div>

              {/* Step 3: PDF Generated - Following CLAUDE.md Rule #3: Check actual file existence */}
              <div className="flex items-start gap-2">
                {pdfExists ? (
                  <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 000 2h4a1 1 0 100-2H8z" clipRule="evenodd" />
                  </svg>
                )}
                <div>
                  <div className={`font-medium ${pdfExists ? 'text-green-900' : 'text-gray-600'}`}>
                    PDF Generated
                  </div>
                  <div className="text-xs text-gray-600">
                    {pdfExists ? 'Ready for download' : 'Not yet created'}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <a
            href="https://github.com/stachuman/boox-template-generator/blob/main/TUTORIAL.md"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-4 flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 hover:underline whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            View Tutorial
          </a>
        </div>
      </div>

      {/* Tab Navigation - Moved to top with improved styling */}
      <div className="mb-6 bg-white border-b-2 border-eink-pale-gray">
        <nav className="flex space-x-1">
          <button
            onClick={() => setActiveTab('masters')}
            className={`py-3 px-6 font-medium transition-all flex items-center gap-2 ${
              activeTab === 'masters'
                ? 'bg-eink-black text-white'
                : 'bg-eink-pale-gray text-eink-dark-gray hover:bg-eink-light-gray hover:text-eink-black'
            }`}
            title="Create reusable page templates for your PDF"
          >
            <span className="text-xs opacity-70">STEP 1</span>
            Design Pages
          </button>
          <button
            onClick={() => setActiveTab('plan')}
            className={`py-3 px-6 font-medium transition-all flex items-center gap-2 ${
              activeTab === 'plan'
                ? 'bg-eink-black text-white'
                : 'bg-eink-pale-gray text-eink-dark-gray hover:bg-eink-light-gray hover:text-eink-black'
            }`}
            title="Configure how pages are combined and repeated in your PDF"
          >
            <span className="text-xs opacity-70">STEP 2</span>
            Define Structure
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`py-3 px-6 font-medium transition-all flex items-center gap-2 ${
              activeTab === 'preview'
                ? 'bg-eink-black text-white'
                : 'bg-eink-pale-gray text-eink-dark-gray hover:bg-eink-light-gray hover:text-eink-black'
            }`}
            title="Generate your final PDF file for download"
          >
            <span className="text-xs opacity-70">STEP 3</span>
            Generate PDF
          </button>
          <button
            onClick={() => setActiveTab('sharing')}
            className={`py-3 px-6 font-medium transition-all flex items-center gap-2 ${
              activeTab === 'sharing'
                ? 'bg-eink-black text-white'
                : 'bg-eink-pale-gray text-eink-dark-gray hover:bg-eink-light-gray hover:text-eink-black'
            }`}
            title="Make your project public so others can use it"
          >
            <span className="text-xs opacity-70">OPTIONAL</span>
            Share
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
            <div className="max-w-2xl mx-auto">
              <div className="text-center py-12 border-2 border-dashed border-eink-light-gray rounded-lg bg-white">
                <svg className="w-16 h-16 mx-auto text-eink-light-gray mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-xl font-semibold text-eink-black mb-2">Create Your First Page Design</h3>
                <p className="text-eink-dark-gray mb-6 max-w-md mx-auto">
                  Page designs (masters) are reusable templates. Create one for each type of page in your PDF
                  (e.g., daily page, weekly page, cover page).
                </p>
                <button
                  onClick={() => setShowCreateMasterModal(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-eink-black text-white rounded-lg hover:bg-gray-800 transition-colors text-lg"
                >
                  <Plus className="w-5 h-5" />
                  Create First Page Design
                </button>
                <div className="mt-6 pt-6 border-t border-eink-pale-gray">
                  <p className="text-sm text-eink-dark-gray mb-2">💡 <strong>What to design?</strong></p>
                  <p className="text-sm text-eink-dark-gray max-w-md mx-auto">
                    Add widgets like text fields, checkboxes, tables, and images to create your page layout.
                    You can use the same design multiple times in Step 2.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {project.masters.map((master) => (
                <div
                  key={master.name}
                  className="bg-white border border-eink-light-gray rounded-lg p-4 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-eink-black mb-1">
                        {master.name}
                      </h3>
                      {master.description && (
                        <p className="text-eink-dark-gray text-sm line-clamp-2 mb-2">
                          {master.description}
                        </p>
                      )}
                      <div className="space-y-1 mt-2">
                        <div className="text-xs text-eink-dark-gray">
                          📦 {getWidgetTypeBreakdown(master.widgets)}
                        </div>
                        {master.used_variables && master.used_variables.length > 0 && (
                          <div className="text-xs text-eink-dark-gray">
                            🔗 Uses: {master.used_variables.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => navigate(`/projects/${project.id}/masters/${encodeURIComponent(master.name)}`)}
                        className="text-eink-light-gray hover:text-eink-blue transition-colors px-2 py-1 text-sm"
                        title="Edit master"
                      >
                        📝
                      </button>
                      <button
                        onClick={() => handleRenameMaster(master.name)}
                        className="text-eink-light-gray hover:text-eink-blue transition-colors px-2 py-1 text-sm"
                        title="Rename master"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDuplicateMaster(master.name)}
                        className="text-eink-light-gray hover:text-eink-blue transition-colors px-2 py-1 text-sm"
                        title="Duplicate master"
                      >
                        📋
                      </button>
                      <button
                        onClick={() => handleDeleteMaster(master.name)}
                        className="text-eink-light-gray hover:text-red-600 transition-colors px-2 py-1"
                        title="Delete master"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
          {project.masters.length === 0 ? (
            <div className="max-w-2xl mx-auto">
              <div className="text-center py-12 border-2 border-dashed border-eink-light-gray rounded-lg bg-white">
                <svg className="w-16 h-16 mx-auto text-eink-light-gray mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                <h3 className="text-xl font-semibold text-eink-black mb-2">First, Design Some Pages</h3>
                <p className="text-eink-dark-gray mb-6 max-w-md mx-auto">
                  Before you can define your PDF structure, you need to create at least one page design in Step 1.
                </p>
                <button
                  onClick={() => setActiveTab('masters')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-eink-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Go to Step 1: Design Pages
                </button>
                <div className="mt-6 pt-6 border-t border-eink-pale-gray">
                  <p className="text-sm text-eink-dark-gray mb-2">💡 <strong>What happens here?</strong></p>
                  <p className="text-sm text-eink-dark-gray max-w-md mx-auto">
                    In this step, you'll configure how your page designs are combined and repeated to create the final PDF.
                    For example: "Use 'daily page' 30 times" or "Use 'cover' once, then 'weekly page' 52 times".
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      )}

      {activeTab === 'preview' && (
        <div>
          {(project.masters.length === 0 || !project.plan?.sections || project.plan.sections.length === 0) ? (
            <div className="max-w-2xl mx-auto">
              <div className="text-center py-12 border-2 border-dashed border-eink-light-gray rounded-lg bg-white">
                <svg className="w-16 h-16 mx-auto text-eink-light-gray mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <h3 className="text-xl font-semibold text-eink-black mb-2">Complete Previous Steps First</h3>
                <p className="text-eink-dark-gray mb-6 max-w-md mx-auto">
                  Before you can generate a PDF, you need to complete the previous steps.
                </p>

                <div className="space-y-3 mb-6 max-w-md mx-auto text-left">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                    {project.masters.length > 0 ? (
                      <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 000 2h4a1 1 0 100-2H8z" clipRule="evenodd" />
                      </svg>
                    )}
                    <div className="flex-1">
                      <div className="font-medium text-sm">Step 1: Design Pages</div>
                      <div className="text-xs text-gray-600">{project.masters.length} page{project.masters.length !== 1 ? 's' : ''} created</div>
                    </div>
                    {project.masters.length === 0 && (
                      <button
                        onClick={() => setActiveTab('masters')}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Go →
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                    {project.plan?.sections && project.plan.sections.length > 0 ? (
                      <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 000 2h4a1 1 0 100-2H8z" clipRule="evenodd" />
                      </svg>
                    )}
                    <div className="flex-1">
                      <div className="font-medium text-sm">Step 2: Define Structure</div>
                      <div className="text-xs text-gray-600">
                        {project.plan?.sections ? `${project.plan.sections.length} section${project.plan.sections.length !== 1 ? 's' : ''}` : 'Not configured'}
                      </div>
                    </div>
                    {(!project.plan?.sections || project.plan.sections.length === 0) && (
                      <button
                        onClick={() => setActiveTab('plan')}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Go →
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-eink-pale-gray">
                  <p className="text-sm text-eink-dark-gray mb-2">💡 <strong>What happens here?</strong></p>
                  <p className="text-sm text-eink-dark-gray max-w-md mx-auto">
                    Once you've designed pages and defined the structure, you can generate your final PDF file
                    optimized for your e-ink device. The PDF will be created based on your configuration.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* PDF Generation Actions */}
              <div className="mb-6 p-4 bg-gray-50 border border-eink-light-gray rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-eink-dark-gray">
                    <div className="font-semibold mb-1">Ready to generate PDF</div>
                    <div className="text-xs">
                      <span className="font-medium">Masters:</span> {project.masters.length} • <span className="font-medium">Sections:</span> {project.plan.sections.length}
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
                {/* Following CLAUDE.md Rule #5: Better UX for e-ink devices - open + download */}
                {pdfExists && (
                  <>
                    <button
                      onClick={handleOpenPDF}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      title="Open PDF in new tab (recommended for e-ink devices)"
                    >
                      <Eye className="w-5 h-5" />
                      Open PDF
                    </button>
                    <button
                      onClick={handleDownloadReadyPDF}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      title="Download PDF file"
                    >
                      <Download className="w-5 h-5" />
                      Download
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* PDF Job Status */}
          {currentPDFJobId && (
            <div className="mb-6">
              <PDFJobStatusComponent
                jobId={currentPDFJobId}
                autoDownload={false}
                onComplete={async (job) => {
                  console.log('[ProjectEditor] Job completed:', job.id);
                  setCompletedPDFJobId(job.id);
                  setCurrentPDFJobId(job.id);
                  setJobInProgress(false);
                  setPdfExists(true); // PDF now exists on disk
                  persistActiveJob(null);
                  persistCompletedJob(job.id);

                  // Auto-refresh preview
                  if (project) {
                    try {
                      const url = await createPreviewUrl(project.id);
                      setPreviewUrl(url);
                    } catch (err) {
                      console.error('Failed to auto-refresh preview:', err);
                    }
                  }
                }}
                onError={() => {
                  setJobInProgress(false);
                  persistActiveJob(null);
                  persistCompletedJob(null);
                }}
                onCancel={() => {
                  setJobInProgress(false);
                  persistActiveJob(null);
                  persistCompletedJob(null);
                }}
              />
            </div>
          )}

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
            <h3 className="font-semibold mb-3">PDF Preview</h3>

            {previewUrl ? (
              <div className="overflow-hidden border rounded bg-gray-50 p-2">
                <iframe title="PDF Preview" src={previewUrl} className="w-full h-[70vh]" style={{ border: 0 }} />
              </div>
            ) : (
              <div className="text-sm text-eink-dark-gray">No preview yet. Create PDF to generate and preview it.</div>
            )}
          </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'sharing' && (
        <div>
          <h2 className="text-lg font-semibold text-eink-black mb-4">Project Sharing</h2>
          <ProjectSharingControls project={project} onProjectUpdated={handleProjectUpdated} />
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
