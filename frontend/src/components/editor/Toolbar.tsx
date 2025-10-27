/**
 * Main toolbar for the template editor.
 * 
 * Contains primary actions and settings for the editor.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React, { useState } from 'react';
import {
  Save, Download, Eye, Grid, Monitor, Hammer,
  AlignLeft, AlignCenter, AlignRight,
  AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd,
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter,
  ArrowLeftRight, ArrowUpDown, Magnet
} from 'lucide-react';
import clsx from 'clsx';
import { DeviceProfile, Template } from '@/types';
import { useEditorStore } from '@/stores/editorStore';

interface ToolbarProps {
  profiles: DeviceProfile[];
  activeProfile: DeviceProfile | null;
  currentTemplate: Template | null;
  onProfileChange: (profile: DeviceProfile) => void;
  onTemplateMetadataUpdate: (updates: Partial<Template['metadata']>) => void;
  onSave?: () => void;
  onExportPDF?: () => void;
  onOpenCompile?: () => void;
  saving: boolean;
  showGrid: boolean;
  onToggleGrid: () => void;
  onTogglePreview: () => void;
  showPreview: boolean;
  // Panels
  showWidgetPalette: boolean;
  showPagesPanel: boolean;
  showRightPanel: boolean;
  onToggleWidgetPalette: () => void;
  onTogglePagesPanel?: () => void;
  onToggleRightPanel: () => void;
  hideProfileSelector?: boolean;
  hidePreviewButton?: boolean;
  // Align/Distribute
  selectedCount?: number;
  onAlignLeft?: () => void;
  onAlignCenter?: () => void;
  onAlignRight?: () => void;
  onAlignTop?: () => void;
  onAlignMiddle?: () => void;
  onAlignBottom?: () => void;
  onDistributeH?: () => void;
  onDistributeV?: () => void;
  onEqualizeW?: () => void;
  onEqualizeH?: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  profiles,
  activeProfile,
  currentTemplate,
  onProfileChange,
  onTemplateMetadataUpdate,
  onSave,
  onExportPDF,
  onOpenCompile,
  saving,
  showGrid,
  onToggleGrid,
  onTogglePreview,
  showPreview,
  hideProfileSelector = false,
  hidePreviewButton = false,
  selectedCount,
  onAlignLeft,
  onAlignCenter,
  onAlignRight,
  onAlignTop,
  onAlignMiddle,
  onAlignBottom,
  onDistributeH,
  onDistributeV,
  onEqualizeW,
  onEqualizeH,
}) => {
  const [showMetadataEditor, setShowMetadataEditor] = useState(false);
  const { zoom, setZoom, wheelMode, setWheelMode, canvasContainerSize, canvasScrollContainer, snapEnabled, setSnapEnabled, setGridSize } = useEditorStore((state) => ({
    zoom: state.zoom,
    setZoom: state.setZoom,
    wheelMode: state.wheelMode,
    setWheelMode: state.setWheelMode,
    canvasContainerSize: state.canvasContainerSize,
    canvasScrollContainer: state.canvasScrollContainer,
    snapEnabled: state.snapEnabled,
    setSnapEnabled: state.setSnapEnabled,
    setGridSize: state.setGridSize,
  }));

  // Default grid size: 10pt is standard for e-ink devices (balances precision vs usability)
  const DEFAULT_GRID_SIZE = 10;
  const gridSize = currentTemplate?.canvas?.grid_size ?? DEFAULT_GRID_SIZE;

  const centerCanvas = () => {
    if (!canvasScrollContainer) return;
    requestAnimationFrame(() => {
      const scrollLeft = (canvasScrollContainer.scrollWidth - canvasScrollContainer.clientWidth) / 2;
      const scrollTop = (canvasScrollContainer.scrollHeight - canvasScrollContainer.clientHeight) / 2;
      canvasScrollContainer.scrollLeft = scrollLeft;
      canvasScrollContainer.scrollTop = scrollTop;
    });
  };

  const zoomOut = () => setZoom((zoom || 1) - 0.1);
  const zoomIn = () => setZoom((zoom || 1) + 0.1);
  const resetZoom = () => setZoom(1);
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
    <div className="toolbar flex items-center justify-between">
      {/* Left Section - Actions */}
      <div className="flex items-center space-x-2">
        {onSave && (
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
        )}


        {onExportPDF && (
          <button
            onClick={onExportPDF}
            className="btn-secondary flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Export PDF</span>
          </button>
        )}

        {onOpenCompile && (
          <button
            onClick={onOpenCompile}
            className="btn-secondary flex items-center space-x-2"
            title="Build from Masters + Plan"
          >
            <Hammer className="w-4 h-4" />
            <span>Build</span>
          </button>
        )}

        {/* Alignment & Distribution Tools - Show when 2+ widgets selected */}
        {selectedCount && selectedCount >= 2 && onAlignLeft && (
          <>
            <div className="w-px h-6 bg-eink-pale-gray" />
            <div className="flex items-center space-x-1">
              {/* Align Horizontal */}
              <button
                onClick={onAlignLeft}
                className="p-2 rounded hover:bg-eink-pale-gray"
                title="Align Left"
              >
                <AlignLeft className="w-4 h-4" />
              </button>
              <button
                onClick={onAlignCenter}
                className="p-2 rounded hover:bg-eink-pale-gray"
                title="Align Center (Horizontal)"
              >
                <AlignCenter className="w-4 h-4" />
              </button>
              <button
                onClick={onAlignRight}
                className="p-2 rounded hover:bg-eink-pale-gray"
                title="Align Right"
              >
                <AlignRight className="w-4 h-4" />
              </button>

              <div className="w-px h-4 bg-eink-pale-gray mx-1" />

              {/* Align Vertical */}
              <button
                onClick={onAlignTop}
                className="p-2 rounded hover:bg-eink-pale-gray"
                title="Align Top"
              >
                <AlignVerticalJustifyStart className="w-4 h-4" />
              </button>
              <button
                onClick={onAlignMiddle}
                className="p-2 rounded hover:bg-eink-pale-gray"
                title="Align Middle (Vertical)"
              >
                <AlignVerticalJustifyCenter className="w-4 h-4" />
              </button>
              <button
                onClick={onAlignBottom}
                className="p-2 rounded hover:bg-eink-pale-gray"
                title="Align Bottom"
              >
                <AlignVerticalJustifyEnd className="w-4 h-4" />
              </button>

              {/* Distribute & Equalize - Show when 3+ widgets selected */}
              {selectedCount >= 3 && (
                <>
                  <div className="w-px h-4 bg-eink-pale-gray mx-1" />
                  <button
                    onClick={onDistributeH}
                    className="p-2 rounded hover:bg-eink-pale-gray"
                    title="Distribute Horizontally"
                  >
                    <AlignHorizontalDistributeCenter className="w-4 h-4" />
                  </button>
                  <button
                    onClick={onDistributeV}
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
                onClick={onEqualizeW}
                className="p-2 rounded hover:bg-eink-pale-gray"
                title="Equalize Width"
              >
                <ArrowLeftRight className="w-4 h-4" />
              </button>
              <button
                onClick={onEqualizeH}
                className="p-2 rounded hover:bg-eink-pale-gray"
                title="Equalize Height"
              >
                <ArrowUpDown className="w-4 h-4" />
              </button>
            </div>
          </>
        )}

        {/* Grid & Snap Controls */}
        <div className="flex items-center space-x-1">
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
            onClick={() => setSnapEnabled(!snapEnabled)}
            className={clsx(
              'p-2 rounded transition-colors',
              snapEnabled
                ? 'bg-eink-black text-eink-white'
                : 'text-eink-gray hover:bg-eink-pale-gray'
            )}
            title={snapEnabled ? 'Disable Snapping' : 'Enable Snapping'}
          >
            <Magnet className="w-4 h-4" />
          </button>

          <div className="flex items-center space-x-1">
            <label className="text-xs text-eink-gray">Grid:</label>
            <input
              type="number"
              value={gridSize}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                // Validate: must be valid number >= 1 (setGridSize will clamp to max)
                if (!isNaN(value) && value >= 1) {
                  setGridSize(value);
                }
              }}
              className="w-14 px-1 py-1 text-xs border rounded"
              min="1"
              max="100"
              title="Grid Size (points)"
            />
            <span className="text-xs text-eink-light-gray">pt</span>
          </div>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center space-x-1 ml-1">
          <button onClick={zoomOut} className="px-2 py-1 text-xs border rounded" title="Zoom Out">−</button>
          <button onClick={resetZoom} className="px-2 py-1 text-xs border rounded w-16" title="Reset Zoom">
            {Math.round((zoom || 1) * 100)}%
          </button>
          <button onClick={zoomIn} className="px-2 py-1 text-xs border rounded" title="Zoom In">+</button>
          <button onClick={fitWidth} className="px-2 py-1 text-xs border rounded" title="Fit to Width">Fit W</button>
          <button onClick={fitPage} className="px-2 py-1 text-xs border rounded" title="Fit to Page">Fit Page</button>
          <button
            onClick={() => setWheelMode(wheelMode === 'zoom' ? 'scroll' : 'zoom')}
            className={clsx('px-2 py-1 text-xs border rounded', wheelMode === 'zoom' ? 'bg-eink-black text-white' : '')}
            title="Toggle Wheel Mode: Scroll/Zoom"
          >
            {wheelMode === 'zoom' ? 'Wheel: Zoom' : 'Wheel: Scroll'}
          </button>
        </div>

        {!hidePreviewButton && (
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
        )}

      </div>

      {/* Right Section - Device Profile */}
      {!hideProfileSelector && (
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
      )}

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
