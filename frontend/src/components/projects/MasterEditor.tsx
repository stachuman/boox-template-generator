import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Code, Layout, Grid, Download, Loader2,
  AlignLeft, AlignCenter, AlignRight,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter,
  ArrowLeftRight, ArrowUpDown
} from 'lucide-react';
import { useEditorStore } from '@/stores/editorStore';
import { Project, ProjectMaster, Template, Canvas, AddMasterRequest, UpdateMasterRequest } from '@/types';
import { APIClient } from '@/services/api';
import TemplateEditor from '@/components/TemplateEditor';

const MasterEditor: React.FC = () => {
  const { projectId, masterName } = useParams<{ projectId: string; masterName?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [project, setProject] = useState<Project | null>(null);
  const [currentMaster, setCurrentMaster] = useState<ProjectMaster | null>(null);
  const [masterNameValue, setMasterNameValue] = useState('');
  const [currentTemplate, setCurrentTemplate] = useState<Template | null>(null);
  const [yamlContent, setYamlContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNewMaster, setIsNewMaster] = useState(false);
  const [viewMode, setViewMode] = useState<'visual' | 'yaml'>('visual');
  const [showGrid, setShowGrid] = useState(false);
  const [exportingPNG, setExportingPNG] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Get editor state for alignment tools
  const { selectedIds, alignSelected, distributeSelected, equalizeSizeSelected } = useEditorStore();

  useEffect(() => {
    if (projectId) {
      loadProject();
    }
  }, [projectId, masterName, searchParams]);

  const loadProject = async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      setError(null);

      // Auto-validate and fix canvas dimensions if needed
      // This ensures canvas always matches the device profile
      // If validation fails (e.g., profile doesn't exist), load project anyway
      // but display error to user
      let projectData;
      try {
        projectData = await APIClient.validateCanvasDimensions(projectId);
      } catch (validationErr: any) {
        // If canvas validation fails, try to load project without validation
        // User will see the error and be prompted to select a valid profile
        console.warn('Canvas validation failed:', validationErr);
        projectData = await APIClient.getProject(projectId);

        // Set error to guide user
        if (validationErr.message && validationErr.message.includes('Device profile')) {
          setError(
            `${validationErr.message}\n\n` +
            'Please update the device profile in the project editor before editing masters.'
          );
        } else {
          setError(validationErr.message || 'Failed to validate canvas dimensions');
        }
      }
      setProject(projectData);

      if (masterName && masterName !== 'new') {
        // Editing existing master
        const decodedMasterName = decodeURIComponent(masterName);
        const master = projectData.masters.find(m => m.name === decodedMasterName);
        if (master) {
          setCurrentMaster(master);
          setMasterNameValue(master.name);
          const template = convertMasterToTemplate(master, projectData);
          setCurrentTemplate(template);
          // Initialize with a basic YAML structure - TemplateEditor will sync properly
          setYamlContent(JSON.stringify(template, null, 2));
          setIsNewMaster(false);
        } else {
          setError(`Master "${decodedMasterName}" not found`);
        }
      } else {
        // Creating new master
        setIsNewMaster(true);
        // Check for pre-filled name from search params
        const prefilledName = searchParams.get('name');
        setMasterNameValue(prefilledName || '');
        const defaultTemplate = generateDefaultTemplate(projectData);
        setCurrentTemplate(defaultTemplate);
        // Initialize with the default template structure
        setYamlContent(JSON.stringify(defaultTemplate, null, 2));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const convertMasterToTemplate = (master: ProjectMaster, project: Project): Template => {
    console.log('Converting master to template:', master.name, 'widgets:', master.widgets?.length || 0);
    return {
      schema_version: "1.0",
      metadata: {
        name: master.name,
        description: master.description,
        category: project.metadata.category,
        version: "1.0",
        author: project.metadata.author,
        created: master.created_at,
        profile: project.metadata.device_profile
      },
      canvas: (project.default_canvas?.dimensions ? project.default_canvas : {
        dimensions: {
          width: 612,
          height: 792,
          margins: [72, 72, 72, 72]
        },
        coordinate_system: "top_left",
        background: "#ffffff"
      }) as Canvas,
      widgets: master.widgets || [],
      navigation: {},
      export: {
        default_mode: "interactive"
      }
    };
  };

  const generateDefaultTemplate = (project: Project): Template => {
    return {
      schema_version: "1.0",
      metadata: {
        name: "New Master",
        description: "",
        category: project.metadata.category,
        version: "1.0",
        author: project.metadata.author,
        created: new Date().toISOString(),
        profile: project.metadata.device_profile
      },
      canvas: (project.default_canvas?.dimensions ? project.default_canvas : {
        dimensions: {
          width: 612,
          height: 792,
          margins: [72, 72, 72, 72]
        },
        coordinate_system: "top_left",
        background: "#ffffff"
      }) as Canvas,
      widgets: [],
      navigation: {},
      export: {
        default_mode: "interactive"
      }
    };
  };

  const handleTemplateChange = (template: Template | null, yamlContent: string) => {
    setCurrentTemplate(template);
    setYamlContent(yamlContent);
  };

  const saveProject = async () => {
    if (!masterNameValue.trim()) {
      setError('Master name is required');
      return;
    }
    if (!project) {
      setError('Project not loaded');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      setSaveSuccess(false);
      const templateYaml = yamlContent;

      if (isNewMaster) {
        // Create new master
        const request: AddMasterRequest = {
          name: masterNameValue.trim(),
          template_yaml: templateYaml,
          description: ''
        };

        const updatedProject = await APIClient.addMaster(project.id, request);
        setProject(updatedProject);

        // After creating, switch to edit mode for this master
        setIsNewMaster(false);
        const newMaster = updatedProject.masters.find(m => m.name === masterNameValue.trim());
        if (newMaster) {
          setCurrentMaster(newMaster);
        }
      } else if (currentMaster) {
        // Update existing master
        const request: UpdateMasterRequest = {
          template_yaml: templateYaml,
          new_name: masterNameValue.trim() !== currentMaster.name ? masterNameValue.trim() : undefined,
          description: ''
        };

        const updatedProject = await APIClient.updateMaster(project.id, currentMaster.name, request);
        setProject(updatedProject);

        // Update current master if name changed
        if (request.new_name) {
          const renamedMaster = updatedProject.masters.find(m => m.name === request.new_name);
          if (renamedMaster) {
            setCurrentMaster(renamedMaster);
          }
        }
      }

      // Show success feedback
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);

    } catch (err: any) {
      setError(err.message || 'Failed to save master');
    } finally {
      setSaving(false);
    }
  }

  const handleSave = async () => {
    if (!project || !currentTemplate) return;

    if (!masterNameValue.trim()) {
      setError('Master name is required');
      return;
    }

    //try {
    saveProject();
    // Navigate back to project with masters tab active
    // navigate(`/projects/${project.id}?tab=masters`);

      /* 
      setSaving(true);
      setError(null);


      const templateYaml = yamlContent;

      if (isNewMaster) {
        // Create new master
        const request: AddMasterRequest = {
          name: masterNameValue.trim(),
          template_yaml: templateYaml,
          description: ''
        };

        const updatedProject = await APIClient.addMaster(project.id, request);
        setProject(updatedProject);

        // Navigate back to project with masters tab active
        navigate(`/projects/${project.id}?tab=masters`);
      } else if (currentMaster) {
        // Update existing master
        const request: UpdateMasterRequest = {
          template_yaml: templateYaml,
          new_name: masterNameValue.trim() !== currentMaster.name ? masterNameValue.trim() : undefined,
          description: ''
        };

        const updatedProject = await APIClient.updateMaster(project.id, currentMaster.name, request);
        setProject(updatedProject);

        // Navigate back to project with masters tab active
        navigate(`/projects/${project.id}?tab=masters`);
      }
        
    } catch (err: any) {
      setError(err.message || 'Failed to save master');
    } finally {
      setSaving(false);
    } */
  };

  const handleExportPNG = async () => {
    if (!project || !currentMaster) return;

    try {
      // start by saving
      saveProject();

      setExportingPNG(true);
      setError(null);

      const pngBlob = await APIClient.exportMasterAsPNG(
        project.id,
        currentMaster.name
      );

      // Create download link
      const url = URL.createObjectURL(pngBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentMaster.name}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Failed to export PNG');
    } finally {
      setExportingPNG(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-eink-dark-gray">Loading master...</div>
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
    <div className="h-full flex flex-col">
      {/* Single Consolidated Toolbar */}
      <div className="toolbar flex items-center justify-between px-4 py-2 border-b border-eink-light-gray bg-white">
        <div className="flex items-center gap-3">
          {/* Navigation */}
          <button
            onClick={() => navigate(`/projects/${project.id}?tab=masters`)}
            className="text-eink-dark-gray hover:text-eink-black transition-colors"
            title="Back to Projects"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="w-px h-6 bg-eink-pale-gray" />

          {/* View Mode Toggle */}
          <div className="flex border border-eink-light-gray rounded-lg">
            <button
              onClick={() => setViewMode('visual')}
              className={`px-3 py-2 text-sm rounded-l-lg transition-colors ${
                viewMode === 'visual'
                  ? 'bg-eink-black text-white'
                  : 'text-eink-dark-gray hover:text-eink-black'
              }`}
            >
              <Layout className="w-4 h-4 inline mr-1" />
              Visual
            </button>
            <button
              onClick={() => setViewMode('yaml')}
              className={`px-3 py-2 text-sm rounded-r-lg transition-colors ${
                viewMode === 'yaml'
                  ? 'bg-eink-black text-white'
                  : 'text-eink-dark-gray hover:text-eink-black'
              }`}
            >
              <Code className="w-4 h-4 inline mr-1" />
              YAML
            </button>
          </div>

          {/* Grid Toggle - only in visual mode */}
          {viewMode === 'visual' && (
            <>
              <div className="w-px h-6 bg-eink-pale-gray" />
              <button
                onClick={() => setShowGrid(!showGrid)}
                className={`p-2 rounded transition-colors ${
                  showGrid
                    ? 'bg-eink-black text-eink-white'
                    : 'text-eink-gray hover:bg-eink-pale-gray'
                }`}
                title={showGrid ? 'Hide Grid' : 'Show Grid'}
              >
                <Grid className="w-4 h-4" />
              </button>

              {/* Zoom controls (design canvas) */}
              <div className="flex items-center space-x-1 ml-1">
                <ZoomControls />
              </div>

              {/* Alignment Tools - Show when 2+ widgets selected */}
              {selectedIds && selectedIds.length >= 2 && (
                <>
                  <div className="w-px h-6 bg-eink-pale-gray" />
                  <div className="flex items-center space-x-1">
                    {/* Align Horizontal */}
                    <button
                      onClick={() => alignSelected('left')}
                      className="p-2 rounded hover:bg-eink-pale-gray"
                      title="Align Left"
                    >
                      <AlignLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => alignSelected('center')}
                      className="p-2 rounded hover:bg-eink-pale-gray"
                      title="Align Center (Horizontal)"
                    >
                      <AlignCenter className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => alignSelected('right')}
                      className="p-2 rounded hover:bg-eink-pale-gray"
                      title="Align Right"
                    >
                      <AlignRight className="w-4 h-4" />
                    </button>

                    <div className="w-px h-4 bg-eink-pale-gray mx-1" />

                    {/* Align Vertical */}
                    <button
                      onClick={() => alignSelected('top')}
                      className="p-2 rounded hover:bg-eink-pale-gray"
                      title="Align Top"
                    >
                      <AlignStartVertical className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => alignSelected('middle')}
                      className="p-2 rounded hover:bg-eink-pale-gray"
                      title="Align Middle (Vertical)"
                    >
                      <AlignCenterVertical className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => alignSelected('bottom')}
                      className="p-2 rounded hover:bg-eink-pale-gray"
                      title="Align Bottom"
                    >
                      <AlignEndVertical className="w-4 h-4" />
                    </button>

                    {/* Distribute - Show when 3+ widgets selected */}
                    {selectedIds.length >= 3 && (
                      <>
                        <div className="w-px h-4 bg-eink-pale-gray mx-1" />
                        <button
                          onClick={() => distributeSelected('horizontal')}
                          className="p-2 rounded hover:bg-eink-pale-gray"
                          title="Distribute Horizontally"
                        >
                          <AlignHorizontalDistributeCenter className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => distributeSelected('vertical')}
                          className="p-2 rounded hover:bg-eink-pale-gray"
                          title="Distribute Vertically"
                        >
                          <AlignVerticalDistributeCenter className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    <div className="w-px h-4 bg-eink-pale-gray mx-1" />

                    {/* Equalize Size */}
                    <button
                      onClick={() => equalizeSizeSelected('width')}
                      className="p-2 rounded hover:bg-eink-pale-gray"
                      title="Equalize Width"
                    >
                      <ArrowLeftRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => equalizeSizeSelected('height')}
                      className="p-2 rounded hover:bg-eink-pale-gray"
                      title="Equalize Height"
                    >
                      <ArrowUpDown className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Export PNG Button - only for existing masters */}
          {!isNewMaster && currentMaster && (
            <button
              onClick={handleExportPNG}
              disabled={exportingPNG}
              className="flex items-center gap-2 px-4 py-2 border border-eink-light-gray text-eink-dark-gray rounded-lg hover:bg-eink-pale-gray transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Export master as PNG template for e-ink devices"
            >
              {exportingPNG ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Export PNG
                </>
              )}
            </button>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving || !masterNameValue.trim()}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              saveSuccess
                ? 'bg-green-600 text-white'
                : 'bg-eink-black text-white hover:bg-gray-800'
            }`}
          >
            {saveSuccess ? (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Saved!
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                {saving ? 'Saving...' : (isNewMaster ? 'Create Master' : 'Save Changes')}
              </>
            )}
          </button>

          {/* Master Name Input */}
          <input
            type="text"
            value={masterNameValue}
            onChange={(e) => setMasterNameValue(e.target.value)}
            placeholder="Master name..."
            className="px-3 py-2 border border-eink-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-eink-black focus:border-transparent text-sm"
          />

        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="m-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}


      {/* Editor Content */}
      <div className="flex-1 min-h-0">
        {viewMode === 'visual' ? (
          <TemplateEditor
            yamlContent={yamlContent}
            onTemplateChange={handleTemplateChange}
            projectProfile={project.metadata.device_profile}
            hidePageManager={true}
            hideCompilePanel={true}
            hideToolbar={true}
            showGrid={showGrid}
            onToggleGrid={() => setShowGrid(!showGrid)}
          />
        ) : (
          <div className="h-full p-4">
            <textarea
              value={yamlContent}
              onChange={(e) => setYamlContent(e.target.value)}
              rows={25}
              className="w-full h-full min-h-[600px] font-mono text-sm border border-eink-light-gray rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-eink-black resize-y"
              placeholder="YAML content will appear here..."
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default MasterEditor;

// Inline zoom controls reusing editor store
const ZoomControls: React.FC = () => {
  const { zoom, setZoom, wheelMode, setWheelMode, currentTemplate, canvasContainerSize, canvasScrollContainer } = useEditorStore() as any;

  const centerCanvas = () => {
    if (!canvasScrollContainer) return;
    requestAnimationFrame(() => {
      const scrollLeft = (canvasScrollContainer.scrollWidth - canvasScrollContainer.clientWidth) / 2;
      const scrollTop = (canvasScrollContainer.scrollHeight - canvasScrollContainer.clientHeight) / 2;
      canvasScrollContainer.scrollLeft = scrollLeft;
      canvasScrollContainer.scrollTop = scrollTop;
    });
  };

  const fitWidth = () => {
    if (!currentTemplate || !canvasContainerSize) return;
    const cw = currentTemplate.canvas.dimensions.width;
    const vw = canvasContainerSize.width;
    if (cw > 0 && vw > 0) {
      setZoom(Math.max(0.1, Math.min(3, vw / cw)));
      centerCanvas();
    }
  };
  const fitPage = () => {
    if (!currentTemplate || !canvasContainerSize) return;
    const cw = currentTemplate.canvas.dimensions.width;
    const ch = currentTemplate.canvas.dimensions.height;
    const vw = canvasContainerSize.width;
    const vh = canvasContainerSize.height;
    if (cw > 0 && ch > 0 && vw > 0 && vh > 0) {
      setZoom(Math.max(0.1, Math.min(3, Math.min(vw / cw, vh / ch))));
      centerCanvas();
    }
  };
  return (
    <div className="flex items-center space-x-1">
      <button onClick={() => setZoom((zoom || 1) - 0.1)} className="px-2 py-1 text-xs border rounded" title="Zoom Out">−</button>
      <button onClick={() => setZoom(1)} className="px-2 py-1 text-xs border rounded w-16" title="Reset Zoom">{Math.round((zoom || 1) * 100)}%</button>
      <button onClick={() => setZoom((zoom || 1) + 0.1)} className="px-2 py-1 text-xs border rounded" title="Zoom In">+</button>
      <button onClick={fitWidth} className="px-2 py-1 text-xs border rounded" title="Fit to Width">Fit W</button>
      <button onClick={fitPage} className="px-2 py-1 text-xs border rounded" title="Fit to Page">Fit Page</button>
      <button
        onClick={() => setWheelMode(wheelMode === 'zoom' ? 'scroll' : 'zoom')}
        className={`px-2 py-1 text-xs border rounded ${wheelMode === 'zoom' ? 'bg-eink-black text-white' : ''}`}
        title="Toggle Wheel Mode: Scroll/Zoom"
      >
        {wheelMode === 'zoom' ? 'Wheel: Zoom' : 'Wheel: Scroll'}
      </button>
    </div>
  );
};
