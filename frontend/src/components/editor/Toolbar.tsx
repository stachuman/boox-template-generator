/**
 * Main toolbar for the template editor.
 * 
 * Contains primary actions and settings for the editor.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React, { useState } from 'react';
import { Save, Download, Eye, Grid, Monitor, Settings } from 'lucide-react';
import clsx from 'clsx';
import { DeviceProfile, Template } from '@/types';

interface ToolbarProps {
  profiles: DeviceProfile[];
  activeProfile: DeviceProfile | null;
  currentTemplate: Template | null;
  onProfileChange: (profile: DeviceProfile) => void;
  onTemplateMetadataUpdate: (updates: Partial<Template['metadata']>) => void;
  onSave: () => void;
  onExportPDF: () => void;
  saving: boolean;
  showGrid: boolean;
  onToggleGrid: () => void;
  onTogglePreview: () => void;
  showPreview: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({
  profiles,
  activeProfile,
  currentTemplate,
  onProfileChange,
  onTemplateMetadataUpdate,
  onSave,
  onExportPDF,
  saving,
  showGrid,
  onToggleGrid,
  onTogglePreview,
  showPreview,
}) => {
  const [showMetadataEditor, setShowMetadataEditor] = useState(false);
  return (
    <div className="toolbar flex items-center justify-between">
      {/* Left Section - Actions */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onSave}
          disabled={saving}
          className={clsx(
            'btn-primary flex items-center space-x-2',
            saving && 'opacity-50 cursor-not-allowed'
          )}
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save'}</span>
        </button>

        {/* Template Name and Settings */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-eink-gray">Template:</span>
          <span className="font-medium text-eink-black">
            {currentTemplate?.metadata.name || 'Untitled'}
          </span>
          <button
            onClick={() => setShowMetadataEditor(true)}
            className="p-1 rounded hover:bg-eink-pale-gray transition-colors"
            title="Edit template metadata"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={onExportPDF}
          className="btn-secondary flex items-center space-x-2"
        >
          <Download className="w-4 h-4" />
          <span>Export PDF</span>
        </button>

        <div className="w-px h-6 bg-eink-pale-gray" />

        <button
          onClick={onToggleGrid}
          className={clsx(
            'p-2 rounded transition-colors',
            showGrid
              ? 'bg-eink-black text-eink-white'
              : 'text-eink-gray hover:bg-eink-pale-gray'
          )}
          title={showGrid ? 'Hide Grid' : 'Show Grid'}
        >
          <Grid className="w-4 h-4" />
        </button>

        <button
          onClick={onTogglePreview}
          className={clsx(
            'p-2 rounded transition-colors',
            showPreview
              ? 'bg-eink-black text-eink-white'
              : 'text-eink-gray hover:bg-eink-pale-gray'
          )}
          title={showPreview ? 'Hide Preview' : 'Show Preview'}
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>

      {/* Right Section - Device Profile */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <Monitor className="w-4 h-4 text-eink-gray" />
          <span className="text-sm text-eink-gray">Profile:</span>
        </div>
        
        <select
          value={activeProfile?.name || ''}
          onChange={(e) => {
            const profile = profiles.find(p => p.name === e.target.value);
            if (profile) {
              onProfileChange(profile);
            }
          }}
          className="input-field text-sm"
        >
          <option value="">Select Device Profile</option>
          {profiles.map((profile) => (
            <option key={profile.name} value={profile.name}>
              {profile.name}
            </option>
          ))}
        </select>

        {activeProfile && (
          <div className="text-xs text-eink-light-gray">
            {activeProfile.display.screen_size[0]}×{activeProfile.display.screen_size[1]} 
            @ {activeProfile.display.ppi}ppi
          </div>
        )}
      </div>

      {/* Template Metadata Editor Modal */}
      {showMetadataEditor && currentTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-96 max-w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Template Settings</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Template Name</label>
                  <input
                    type="text"
                    value={currentTemplate.metadata.name}
                    onChange={(e) => onTemplateMetadataUpdate({ name: e.target.value })}
                    className="input-field w-full"
                    placeholder="Enter template name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={currentTemplate.metadata.description || ''}
                    onChange={(e) => onTemplateMetadataUpdate({ description: e.target.value })}
                    className="input-field w-full resize-none"
                    rows={3}
                    placeholder="Enter template description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select
                    value={currentTemplate.metadata.category}
                    onChange={(e) => onTemplateMetadataUpdate({ category: e.target.value })}
                    className="input-field w-full"
                  >
                    <option value="general">General</option>
                    <option value="business">Business</option>
                    <option value="personal">Personal</option>
                    <option value="education">Education</option>
                    <option value="forms">Forms</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Author</label>
                  <input
                    type="text"
                    value={currentTemplate.metadata.author || ''}
                    onChange={(e) => onTemplateMetadataUpdate({ author: e.target.value })}
                    className="input-field w-full"
                    placeholder="Enter author name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Device Profile</label>
                  <div className="text-sm text-eink-gray">
                    {activeProfile ? activeProfile.name : 'No profile selected'}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 mt-6">
                <button
                  onClick={() => setShowMetadataEditor(false)}
                  className="btn-secondary"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Toolbar;