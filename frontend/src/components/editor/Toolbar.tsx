/**
 * Main toolbar for the template editor.
 * 
 * Contains primary actions and settings for the editor.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { Save, Download, Eye, Grid, Monitor } from 'lucide-react';
import clsx from 'clsx';
import { DeviceProfile } from '@/types';

interface ToolbarProps {
  profiles: DeviceProfile[];
  activeProfile: DeviceProfile | null;
  onProfileChange: (profile: DeviceProfile) => void;
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
  onProfileChange,
  onSave,
  onExportPDF,
  saving,
  showGrid,
  onToggleGrid,
  onTogglePreview,
  showPreview,
}) => {
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
    </div>
  );
};

export default Toolbar;