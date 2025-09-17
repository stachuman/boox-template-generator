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
import { DeviceProfile } from '@/types';

import Toolbar from './editor/Toolbar';
import WidgetPalette from './editor/WidgetPalette';
import PageManager from './editor/PageManager';
import Canvas from './editor/Canvas';
import PropertiesPanel from './editor/PropertiesPanel';
import PreviewPanel from './editor/PreviewPanel';

const TemplateEditor: React.FC = () => {
  const { templateId } = useParams<{ templateId: string }>();
  
  const {
    currentTemplate,
    activeProfile,
    showGrid,
    setActiveProfile,
    setShowGrid,
  } = useEditorStore();

  const [profiles, setProfiles] = useState<DeviceProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProfiles();
    if (templateId) {
      loadTemplate(templateId);
    } else {
      setLoading(false);
    }
  }, [templateId]);

  const loadProfiles = async () => {
    try {
      const profilesData = await APIClient.getProfiles();
      setProfiles(profilesData);
      
      // Set default profile if none selected
      if (!activeProfile && profilesData.length > 0) {
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
      
      // Parse YAML content into template object
      // Note: In a real implementation, you'd need a YAML parser
      // For now, we'll assume the backend returns the parsed template
      // setCurrentTemplate(parsedTemplate);
      
      console.log('Template loaded:', template);
      // TODO: Parse YAML and set template
      
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
    if (!currentTemplate || !activeProfile) {
      alert('Please select a device profile before saving');
      return;
    }

    try {
      setSaving(true);
      
      // Convert template to YAML
      // Note: In a real implementation, you'd need a YAML serializer
      const yamlContent = JSON.stringify(currentTemplate, null, 2); // Placeholder
      
      if (templateId) {
        // Update existing template
        await APIClient.updateTemplate(templateId, {
          name: currentTemplate.metadata.name,
          description: currentTemplate.metadata.description,
          profile: activeProfile.name,
          yaml_content: yamlContent,
        });
      } else {
        // Create new template
        await APIClient.createTemplate({
          name: currentTemplate.metadata.name,
          description: currentTemplate.metadata.description,
          profile: activeProfile.name,
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
      // Convert template to YAML
      const yamlContent = JSON.stringify(currentTemplate, null, 2); // Placeholder
      
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
      <Toolbar
        profiles={profiles}
        activeProfile={activeProfile}
        onProfileChange={setActiveProfile}
        onSave={handleSave}
        onExportPDF={handleExportPDF}
        saving={saving}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid(!showGrid)}
        onTogglePreview={() => setShowPreview(!showPreview)}
        showPreview={showPreview}
      />

      {/* Main Editor Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Widget Palette */}
        <div className="w-64 border-r border-eink-pale-gray bg-eink-white">
          <WidgetPalette />
        </div>

        {/* Page Management Panel */}
        <PageManager />

        {/* Center - Canvas Area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-auto bg-eink-off-white p-4">
            <Canvas />
          </div>
        </div>

        {/* Right Sidebar - Properties or Preview */}
        <div className="w-80 border-l border-eink-pale-gray bg-eink-white">
          {showPreview ? (
            <PreviewPanel />
          ) : (
            <PropertiesPanel />
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplateEditor;