import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Code, Layout, Grid } from 'lucide-react';
import { Project, Master, Template, AddMasterRequest, UpdateMasterRequest } from '@/types';
import { APIClient } from '@/services/api';
import TemplateEditor from '@/components/TemplateEditor';

const MasterEditor: React.FC = () => {
  const { projectId, masterName } = useParams<{ projectId: string; masterName?: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [currentMaster, setCurrentMaster] = useState<Master | null>(null);
  const [masterNameValue, setMasterNameValue] = useState('');
  const [currentTemplate, setCurrentTemplate] = useState<Template | null>(null);
  const [yamlContent, setYamlContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNewMaster, setIsNewMaster] = useState(false);
  const [viewMode, setViewMode] = useState<'visual' | 'yaml'>('visual');
  const [showGrid, setShowGrid] = useState(false);

  useEffect(() => {
    if (projectId) {
      loadProject();
    }
  }, [projectId, masterName]);

  const loadProject = async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      setError(null);
      const projectData = await APIClient.getProject(projectId);
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
        setMasterNameValue('');
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

  const convertMasterToTemplate = (master: Master, project: Project): Template => {
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
      canvas: project.default_canvas || {
        dimensions: {
          width: 612,
          height: 792,
          margins: [72, 72, 72, 72]
        },
        coordinate_system: "top_left",
        background: "#ffffff"
      },
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
  };

  const handleTemplateChange = (template: Template | null, yamlContent: string) => {
    setCurrentTemplate(template);
    setYamlContent(yamlContent);
  };



  const handleSave = async () => {
    if (!project || !currentTemplate) return;

    if (!masterNameValue.trim()) {
      setError('Master name is required');
      return;
    }

    try {
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
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Master Name Input */}
          <input
            type="text"
            value={masterNameValue}
            onChange={(e) => setMasterNameValue(e.target.value)}
            placeholder="Master name..."
            className="px-3 py-2 border border-eink-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-eink-black focus:border-transparent text-sm"
          />

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving || !masterNameValue.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-eink-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : (isNewMaster ? 'Create Master' : 'Save Changes')}
          </button>
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
              className="w-full h-full font-mono text-sm border border-eink-light-gray rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-eink-black"
              placeholder="YAML content will appear here..."
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default MasterEditor;