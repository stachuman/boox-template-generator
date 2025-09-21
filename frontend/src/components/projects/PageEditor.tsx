import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Code, Layout } from 'lucide-react';
import { Project, NamedPage, Template, AddPageRequest, UpdatePageRequest } from '@/types';
import { APIClient } from '@/services/api';
import TemplateEditor from '@/components/TemplateEditor';

const PageEditor: React.FC = () => {
  const { projectId, pageName } = useParams<{ projectId: string; pageName?: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [currentPage, setCurrentPage] = useState<NamedPage | null>(null);
  const [pageData, setPageData] = useState({
    name: '',
    description: ''
  });
  const [currentTemplate, setCurrentTemplate] = useState<Template | null>(null);
  const [yamlContent, setYamlContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNewPage, setIsNewPage] = useState(false);
  const [viewMode, setViewMode] = useState<'visual' | 'yaml'>('visual');

  useEffect(() => {
    if (projectId) {
      loadProject();
    }
  }, [projectId, pageName]);

  const loadProject = async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      setError(null);
      const projectData = await APIClient.getProject(projectId);
      setProject(projectData);

      if (pageName && pageName !== 'new') {
        // Editing existing page
        const decodedPageName = decodeURIComponent(pageName);
        const page = projectData.pages.find(p => p.name === decodedPageName);
        if (page) {
          setCurrentPage(page);
          setPageData({
            name: page.name,
            description: page.description
          });
          setCurrentTemplate(page.template);
          setYamlContent(JSON.stringify(page.template, null, 2));
          setIsNewPage(false);
        } else {
          setError(`Page "${decodedPageName}" not found`);
        }
      } else {
        // Creating new page
        setIsNewPage(true);
        setPageData({
          name: '',
          description: ''
        });
        const defaultTemplate = generateDefaultTemplate(projectData);
        setCurrentTemplate(defaultTemplate);
        setYamlContent(JSON.stringify(defaultTemplate, null, 2));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const generateDefaultTemplate = (project: Project): Template => {
    return {
      schema_version: "1.0",
      metadata: {
        name: "New Page",
        description: "",
        category: project.metadata.category,
        version: "1.0",
        author: project.metadata.author,
        created: new Date().toISOString(),
        profile: project.metadata.device_profile
      },
      canvas: {
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

  const handleSave = async () => {
    if (!project || !pageData.name.trim() || !currentTemplate) {
      setError('Page name and template are required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Update template metadata with current page data
      const templateToSave: Template = {
        ...currentTemplate,
        metadata: {
          ...currentTemplate.metadata,
          name: pageData.name.trim(),
          description: pageData.description.trim()
        }
      };

      let updatedProject: Project;

      if (isNewPage) {
        const request: AddPageRequest = {
          name: pageData.name.trim(),
          template_yaml: JSON.stringify(templateToSave, null, 2),
          description: pageData.description.trim()
        };
        updatedProject = await APIClient.addNamedPage(project.id, request);
      } else if (currentPage) {
        const request: UpdatePageRequest = {
          template_yaml: JSON.stringify(templateToSave, null, 2),
          new_name: pageData.name.trim() !== currentPage.name ? pageData.name.trim() : undefined,
          description: pageData.description.trim()
        };
        updatedProject = await APIClient.updateNamedPage(project.id, currentPage.name, request);
      } else {
        throw new Error('Invalid page state');
      }

      setProject(updatedProject);

      // Navigate back to project editor
      navigate(`/projects/${project.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to save page');
    } finally {
      setSaving(false);
    }
  };

  const handleTemplateChange = (template: Template | null, yamlString: string) => {
    setCurrentTemplate(template);
    setYamlContent(yamlString);
  };

  const handleYamlChange = (yamlString: string) => {
    setYamlContent(yamlString);
    try {
      const parsedTemplate = JSON.parse(yamlString) as Template;
      setCurrentTemplate(parsedTemplate);
    } catch (err) {
      // Invalid YAML/JSON, keep current template
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-eink-dark-gray">Loading page editor...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-eink-dark-gray mb-2">Project not found</h3>
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
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-eink-light-gray bg-white">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/projects/${project.id}`)}
            className="text-eink-dark-gray hover:text-eink-black transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-eink-black">
              {isNewPage ? 'Create New Page' : `Edit ${currentPage?.name}`}
            </h1>
            <p className="text-sm text-eink-dark-gray">
              {project.metadata.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex border border-eink-light-gray rounded-lg">
            <button
              onClick={() => setViewMode('visual')}
              className={`flex items-center gap-2 px-3 py-2 rounded-l-lg transition-colors ${
                viewMode === 'visual'
                  ? 'bg-eink-black text-white'
                  : 'text-eink-dark-gray hover:bg-gray-50'
              }`}
            >
              <Layout className="w-4 h-4" />
              Visual
            </button>
            <button
              onClick={() => setViewMode('yaml')}
              className={`flex items-center gap-2 px-3 py-2 rounded-r-lg transition-colors ${
                viewMode === 'yaml'
                  ? 'bg-eink-black text-white'
                  : 'text-eink-dark-gray hover:bg-gray-50'
              }`}
            >
              <Code className="w-4 h-4" />
              YAML
            </button>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !pageData.name.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-eink-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Page'}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border-b border-red-200">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Page Metadata */}
      <div className="p-4 bg-gray-50 border-b border-eink-light-gray">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="page-name" className="block text-sm font-medium text-eink-black mb-1">
                Page Name *
              </label>
              <input
                type="text"
                id="page-name"
                value={pageData.name}
                onChange={(e) => setPageData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-eink-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-eink-black focus:border-transparent"
                placeholder="Enter page name"
                required
              />
            </div>
            <div>
              <label htmlFor="page-description" className="block text-sm font-medium text-eink-black mb-1">
                Description
              </label>
              <input
                type="text"
                id="page-description"
                value={pageData.description}
                onChange={(e) => setPageData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-eink-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-eink-black focus:border-transparent"
                placeholder="Describe this page (optional)"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'visual' ? (
          <TemplateEditor
            yamlContent={yamlContent}
            onTemplateChange={handleTemplateChange}
            projectProfile={project.metadata.device_profile}
            hidePageManager={true}
            hideCompilePanel={true}
          />
        ) : (
          <div className="h-full p-6">
            <div className="max-w-4xl mx-auto h-full">
              <div className="mb-4">
                <label htmlFor="template-yaml" className="block text-sm font-medium text-eink-black mb-2">
                  Template YAML
                </label>
                <p className="text-sm text-eink-dark-gray mb-3">
                  Edit the template structure directly. You can include tokens like {`{date}`}, {`{year}`}, etc. for dynamic content.
                </p>
              </div>

              <div className="h-[calc(100%-80px)] border border-eink-light-gray rounded-lg overflow-hidden">
                <textarea
                  id="template-yaml"
                  value={yamlContent}
                  onChange={(e) => handleYamlChange(e.target.value)}
                  className="w-full h-full p-4 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-eink-black focus:ring-inset"
                  placeholder="Template YAML structure..."
                  style={{ fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Help Section - only show in YAML mode */}
      {viewMode === 'yaml' && (
        <div className="p-4 bg-blue-50 border-t border-blue-200">
          <div className="max-w-4xl mx-auto">
            <h4 className="font-semibold text-blue-900 mb-2">Available Dynamic Tokens</h4>
            <div className="text-sm text-blue-800 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <strong>Date tokens:</strong><br />
                {`{date}, {date_long}, {year}, {month}, {month_name}, {day}`}
              </div>
              <div>
                <strong>Sequence tokens:</strong><br />
                {`{index}, {index_padded}, {total}`}
              </div>
              <div>
                <strong>Usage:</strong><br />
                These tokens will be replaced with actual values during compilation.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PageEditor;