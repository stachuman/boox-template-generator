/**
 * Main template editor component.
 * 
 * Provides the core editing interface with canvas, tools, and preview.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

import { useEditorStore } from '@/stores/editorStore';
import { APIClient, APIClientError } from '@/services/api';
import { DeviceProfile, Template } from '@/types';

import Toolbar from './editor/Toolbar';
import WidgetPalette from './editor/WidgetPalette';
import PageManager from './editor/PageManager';
import Canvas from './editor/Canvas';
import PropertiesPanel from './editor/PropertiesPanel';
import PreviewPanel from './editor/PreviewPanel';
import CompilePanel from './editor/CompilePanel';

interface TemplateEditorProps {
  yamlContent?: string;
  onTemplateChange?: (template: Template | null, yamlContent: string) => void;
  projectProfile?: string;
  hidePageManager?: boolean;
  hideCompilePanel?: boolean;
  hideToolbar?: boolean;
  showGrid?: boolean;
  onToggleGrid?: () => void;
  readOnly?: boolean;
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({
  yamlContent,
  onTemplateChange,
  projectProfile,
  hidePageManager = false,
  hideCompilePanel = false,
  hideToolbar = false,
  showGrid: externalShowGrid,
  onToggleGrid: externalOnToggleGrid,
  readOnly = false
}) => {
  const { templateId } = useParams<{ templateId: string }>();
  const canvasScrollRef = React.useRef<HTMLDivElement>(null);

  const {
    currentTemplate,
    activeProfile,
    showGrid: internalShowGrid,
    selectedIds,
    setCurrentTemplate,
    setActiveProfile,
    setShowGrid,
    updateTemplateMetadata,
    resetEditor,
    alignSelected,
    distributeSelected,
    equalizeSizeSelected,
    setCanvasScrollContainer,
  } = useEditorStore();

  // Use external grid state if provided, otherwise use internal
  const showGrid = externalShowGrid !== undefined ? externalShowGrid : internalShowGrid;
  const onToggleGrid = externalOnToggleGrid || (() => setShowGrid(!showGrid));

  // Sync external grid state with internal store when external control is used
  useEffect(() => {
    if (externalShowGrid !== undefined) {
      setShowGrid(externalShowGrid);
    }
  }, [externalShowGrid, setShowGrid]);

  // Set canvas scroll container ref
  useEffect(() => {
    setCanvasScrollContainer(canvasScrollRef.current);
    return () => setCanvasScrollContainer(null);
  }, [setCanvasScrollContainer]);

  const [profiles, setProfiles] = useState<DeviceProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compiledYaml, setCompiledYaml] = useState<string | null>(null);
  const [showCompile, setShowCompile] = useState(false);

  useEffect(() => {
    loadProfiles();
    // Ensure fresh state when creating a new template or switching templates
    if (templateId) {
      // Reset then load the requested template to avoid residual state
      resetEditor();
      loadTemplate(templateId);
    } else if (yamlContent) {
      // Project-based mode: load from yamlContent prop
      try {
        const template = JSON.parse(yamlContent) as Template;
        setCurrentTemplate(template);
        setLoading(false);
      } catch (err) {
        setError('Invalid template YAML');
        setLoading(false);
      }
    } else {
      // New template flow: hard reset to default empty template
      resetEditor();
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, yamlContent]);

  // Call onTemplateChange when template changes (for project-based mode)
  useEffect(() => {
    if (onTemplateChange && currentTemplate) {
      const yamlString = JSON.stringify(currentTemplate, null, 2);
      onTemplateChange(currentTemplate, yamlString);
    }
  }, [currentTemplate, onTemplateChange]);

  const loadProfiles = async () => {
    try {
      const profilesData = await APIClient.getProfiles();
      setProfiles(profilesData);

      // Set project profile if provided, otherwise use default
      if (projectProfile) {
        const profile = profilesData.find(p => p.name === projectProfile);
        if (profile) {
          setActiveProfile(profile);
        }
      } else if (!activeProfile && profilesData.length > 0) {
        setActiveProfile(profilesData[0]);
      }
    } catch (err) {
      if (err instanceof APIClientError) {
        setError(err.apiError.message);
      } else {
        setError('Failed to load device profiles');
      }
    }
  };

  const loadTemplate = async (id: string) => {
    try {
      setLoading(true);
      const template = await APIClient.getTemplate(id);

      if (template.parsed_template) {
        setCurrentTemplate(template.parsed_template as any);
      } else {
        console.warn('Parsed template not present in response');
      }

      // Try set active profile based on template
      if (template.profile && profiles.length > 0) {
        const p = profiles.find(p => p.name === template.profile);
        if (p) setActiveProfile(p);
      }
      
    } catch (err) {
      if (err instanceof APIClientError) {
        setError(err.apiError.message);
      } else {
        setError('Failed to load template');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentTemplate || !currentTemplate.metadata.profile) {
      alert('Please select a device profile before saving');
      return;
    }

    try {
      setSaving(true);
      
      // Prefer compiled YAML if available (fully resolved). Otherwise, JSON placeholder.
      const yamlContent = compiledYaml || JSON.stringify(currentTemplate, null, 2);
      
      if (templateId) {
        // Update existing template
        await APIClient.updateTemplate(templateId, {
          name: currentTemplate.metadata.name,
          description: currentTemplate.metadata.description,
          profile: currentTemplate.metadata.profile,
          yaml_content: yamlContent,
        });
      } else {
        // Create new template
        await APIClient.createTemplate({
          name: currentTemplate.metadata.name,
          description: currentTemplate.metadata.description,
          profile: currentTemplate.metadata.profile,
          yaml_content: yamlContent,
        });
      }
      
      alert('Template saved successfully!');
    } catch (err) {
      if (err instanceof APIClientError) {
        alert(`Failed to save template: ${err.apiError.message}`);
      } else {
        alert('Failed to save template');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleExportPDF = async () => {
    if (!currentTemplate || !activeProfile) {
      alert('Please select a device profile before exporting');
      return;
    }

    try {
      // Export requires resolved YAML. Use compiled YAML from Build.
      if (!compiledYaml) {
        alert('Please click Build, then Compile & Open before exporting the final PDF.');
        return;
      }
      const yamlContent = compiledYaml;
      
      const pdfBlob = await APIClient.generatePDF({
        yaml_content: yamlContent,
        profile: activeProfile.name,
        deterministic: true,
      });
      
      // Download PDF
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentTemplate.metadata.name}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (err) {
      if (err instanceof APIClientError) {
        alert(`Failed to export PDF: ${err.apiError.message}`);
      } else {
        alert('Failed to export PDF');
      }
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-eink-black border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-eink-gray">Loading editor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p className="text-eink-gray mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="btn-primary">
            Reload
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Main Toolbar */}
      {!hideToolbar && (
        <Toolbar
        profiles={profiles}
        activeProfile={activeProfile}
        currentTemplate={currentTemplate}
        onProfileChange={setActiveProfile}
        onTemplateMetadataUpdate={updateTemplateMetadata}
        onSave={onTemplateChange ? undefined : handleSave}
        onExportPDF={onTemplateChange ? undefined : handleExportPDF}
        onOpenCompile={onTemplateChange || hideCompilePanel ? undefined : () => setShowCompile(true)}
        saving={saving}
        showGrid={showGrid}
        onToggleGrid={onToggleGrid}
        onTogglePreview={() => setShowPreview(!showPreview)}
        showPreview={showPreview}
        showWidgetPalette={true}
        showPagesPanel={true}
        showRightPanel={true}
        onToggleWidgetPalette={() => {}}
        onTogglePagesPanel={undefined}
        onToggleRightPanel={() => {}}
        hideProfileSelector={!!onTemplateChange}
        hidePreviewButton={!!onTemplateChange}
        selectedCount={selectedIds?.length || 0}
        onAlignLeft={() => alignSelected('left')}
        onAlignCenter={() => alignSelected('center')}
        onAlignRight={() => alignSelected('right')}
        onAlignTop={() => alignSelected('top')}
        onAlignMiddle={() => alignSelected('middle')}
        onAlignBottom={() => alignSelected('bottom')}
        onDistributeH={() => distributeSelected('horizontal')}
        onDistributeV={() => distributeSelected('vertical')}
        onEqualizeW={() => equalizeSizeSelected('width')}
        onEqualizeH={() => equalizeSizeSelected('height')}
        />
      )}

      {/* Main Editor Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Widget Palette */}
        <div className="w-56 border-r border-eink-pale-gray bg-eink-white">
          <WidgetPalette />
        </div>

        {/* Page Management Panel */}
        {!hidePageManager && <PageManager />}

        {/* Center - Canvas Area */}
        <div className="flex-1 flex flex-col">
          <div
            ref={canvasScrollRef}
            className="flex-1 overflow-auto bg-eink-off-white p-4"
          >
            <Canvas readOnly={readOnly} />
          </div>
        </div>

        {/* Right Sidebar - Properties or Preview */}
        {!readOnly && (
          <div className="w-64 border-l border-eink-pale-gray bg-eink-white">
            {showPreview ? (
              <PreviewPanel />
            ) : (
              <PropertiesPanel />
            )}
          </div>
        )}
      </div>
      {showCompile && !hideCompilePanel && (
        <CompilePanel
          onClose={() => setShowCompile(false)}
          onApplyTemplate={(parsed, yaml) => {
            setCurrentTemplate(parsed as any);
            setCompiledYaml(yaml);
            // If compiled template has a profile, reflect it into activeProfile
            try {
              const profName = (parsed as any)?.metadata?.profile;
              if (profName && profiles.length) {
                const prof = profiles.find(p => p.name === profName);
                if (prof) setActiveProfile(prof);
              }
            } catch {}
            setShowCompile(false);
          }}
        />
      )}
    </div>
  );
};

export default TemplateEditor;
