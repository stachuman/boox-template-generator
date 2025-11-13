/**
 * Dialog for rescaling all widgets to fit canvas dimensions.
 *
 * Provides explicit user control over widget scaling with constraint validation.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React, { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Template, Widget, DeviceProfile } from '@/types';

interface RescaleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  template: Template;
  deviceProfile: DeviceProfile;
  onApply: (scaledWidgets: Widget[]) => void;
}

type ScalingMode = 'proportional' | 'width_only' | 'height_only' | 'stretch';

interface ValidationWarning {
  widgetId: string;
  widgetType: string;
  issue: string;
}

interface ScalingInfo {
  scaleX: number;
  scaleY: number;
  warnings: ValidationWarning[];
}

const RescaleDialog: React.FC<RescaleDialogProps> = ({
  isOpen,
  onClose,
  template,
  deviceProfile,
  onApply
}) => {
  const [scalingMode, setScalingMode] = useState<ScalingMode>('proportional');
  const [autoFixViolations, setAutoFixViolations] = useState(true);
  const [scalingInfo, setScalingInfo] = useState<ScalingInfo | null>(null);

  // Calculate scaling factors and validate
  useEffect(() => {
    if (!isOpen || !template || !deviceProfile) return;

    const canvasWidth = template.canvas.dimensions.width;
    const canvasHeight = template.canvas.dimensions.height;

    // Find bounding box of all widgets
    const widgets = template.widgets || [];
    if (widgets.length === 0) {
      setScalingInfo(null);
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
    widgets.forEach(widget => {
      const x = widget.position.x || 0;
      const y = widget.position.y || 0;
      const width = widget.position.width || 0;
      const height = widget.position.height || 0;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    // Calculate scale factors based on mode
    let scaleX = 1;
    let scaleY = 1;

    switch (scalingMode) {
      case 'proportional':
        // Scale based on which dimension needs more scaling
        const scaleByWidth = canvasWidth / contentWidth;
        const scaleByHeight = canvasHeight / contentHeight;
        scaleX = scaleY = Math.min(scaleByWidth, scaleByHeight);
        break;
      case 'width_only':
        scaleX = canvasWidth / contentWidth;
        scaleY = 1;
        break;
      case 'height_only':
        scaleX = 1;
        scaleY = canvasHeight / contentHeight;
        break;
      case 'stretch':
        scaleX = canvasWidth / contentWidth;
        scaleY = canvasHeight / contentHeight;
        break;
    }

    // Validate constraints
    const warnings: ValidationWarning[] = [];
    const minFontPt = deviceProfile.constraints?.min_font_pt || 9;
    const minStrokePt = deviceProfile.constraints?.min_stroke_pt || 0.75;
    const minTouchTargetPt = deviceProfile.constraints?.min_touch_target_pt || 30;

    widgets.forEach(widget => {
      // Check font size
      if (widget.styling?.size) {
        const scaledFontSize = widget.styling.size * scaleY;
        if (scaledFontSize < minFontPt) {
          warnings.push({
            widgetId: widget.id,
            widgetType: widget.type,
            issue: `Font size ${scaledFontSize.toFixed(1)}pt below minimum ${minFontPt}pt`
          });
        }
      }

      // Check stroke/line thickness
      const lineThickness = widget.properties?.line_thickness || widget.styling?.line_width;
      if (lineThickness) {
        const scaledStroke = lineThickness * Math.min(scaleX, scaleY);
        if (scaledStroke < minStrokePt) {
          warnings.push({
            widgetId: widget.id,
            widgetType: widget.type,
            issue: `Stroke width ${scaledStroke.toFixed(2)}pt below minimum ${minStrokePt}pt`
          });
        }
      }

      // Check touch targets (for interactive widgets)
      if (['checkbox', 'tap_zone', 'internal_link'].includes(widget.type)) {
        const scaledWidth = (widget.position.width || 0) * scaleX;
        const scaledHeight = (widget.position.height || 0) * scaleY;
        const minDimension = Math.min(scaledWidth, scaledHeight);

        if (minDimension < minTouchTargetPt) {
          warnings.push({
            widgetId: widget.id,
            widgetType: widget.type,
            issue: `Touch target ${minDimension.toFixed(0)}pt below minimum ${minTouchTargetPt}pt`
          });
        }
      }

      // Check checkbox box_size specifically
      if (widget.type === 'checkbox' && widget.properties?.box_size) {
        const scaledBoxSize = widget.properties.box_size * scaleY;
        if (scaledBoxSize < 8) {
          warnings.push({
            widgetId: widget.id,
            widgetType: widget.type,
            issue: `Checkbox box size ${scaledBoxSize.toFixed(1)}pt too small (min 8pt)`
          });
        }
      }
    });

    setScalingInfo({ scaleX, scaleY, warnings });
  }, [isOpen, template, deviceProfile, scalingMode]);

  const handleApply = () => {
    if (!scalingInfo || !template.widgets) return;

    const { scaleX, scaleY } = scalingInfo;
    const minFontPt = deviceProfile.constraints?.min_font_pt || 9;
    const minStrokePt = deviceProfile.constraints?.min_stroke_pt || 0.75;
    const minTouchTargetPt = deviceProfile.constraints?.min_touch_target_pt || 30;

    // Helper function to round to specified decimal places
    const round = (value: number, decimals: number = 1): number => {
      const factor = Math.pow(10, decimals);
      return Math.round(value * factor) / factor;
    };

    const scaledWidgets = template.widgets.map(widget => {
      const scaledWidget: Widget = {
        ...widget,
        position: {
          ...widget.position,
          x: round((widget.position.x || 0) * scaleX),
          y: round((widget.position.y || 0) * scaleY),
          width: round((widget.position.width || 0) * scaleX),
          height: round((widget.position.height || 0) * scaleY)
        }
      };

      // Scale styling properties
      if (widget.styling) {
        scaledWidget.styling = { ...widget.styling };

        // Scale font size
        if (widget.styling.size) {
          let scaledFontSize = widget.styling.size * scaleY;
          if (autoFixViolations && scaledFontSize < minFontPt) {
            scaledFontSize = minFontPt;
          }
          scaledWidget.styling.size = round(scaledFontSize, 1);
        }

        // Scale line width
        if (widget.styling.line_width) {
          let scaledLineWidth = widget.styling.line_width * Math.min(scaleX, scaleY);
          if (autoFixViolations && scaledLineWidth < minStrokePt) {
            scaledLineWidth = minStrokePt;
          }
          scaledWidget.styling.line_width = round(scaledLineWidth, 2);
        }
      }

      // Scale widget-specific properties
      if (widget.properties) {
        scaledWidget.properties = { ...widget.properties };

        // Checkbox box_size
        if (widget.type === 'checkbox' && widget.properties.box_size) {
          let scaledBoxSize = widget.properties.box_size * scaleY;
          if (autoFixViolations && scaledBoxSize < 8) {
            scaledBoxSize = 8;
          }
          scaledWidget.properties.box_size = round(scaledBoxSize, 1);
        }

        // Note: line_thickness is now in styling.line_width (handled above)
        // Legacy properties.line_thickness removed after cleanup

        // Dot grid properties
        if (widget.type === 'dot_grid') {
          if (widget.properties.grid_cell_size) {
            scaledWidget.properties.grid_cell_size = round(widget.properties.grid_cell_size * Math.min(scaleX, scaleY), 1);
          }
          if (widget.properties.dot_size) {
            scaledWidget.properties.dot_size = round(widget.properties.dot_size * Math.min(scaleX, scaleY), 2);
          }
        }

        // Calendar cell_min_size
        if (widget.type === 'calendar' && widget.properties.cell_min_size) {
          let scaledCellSize = widget.properties.cell_min_size * Math.min(scaleX, scaleY);
          if (autoFixViolations && scaledCellSize < minTouchTargetPt) {
            scaledCellSize = minTouchTargetPt;
          }
          scaledWidget.properties.cell_min_size = round(scaledCellSize, 1);
        }

        // Link list item_height
        if (widget.type === 'link_list' && widget.properties.item_height) {
          scaledWidget.properties.item_height = round(widget.properties.item_height * scaleY, 1);
        }

        // Lines line_spacing
        if (widget.type === 'lines' && widget.properties.line_spacing) {
          scaledWidget.properties.line_spacing = round(widget.properties.line_spacing * scaleY, 1);
        }
      }

      return scaledWidget;
    });

    onApply(scaledWidgets);
    onClose();
  };

  if (!isOpen) return null;

  const widgetCount = template.widgets?.length || 0;
  const canvasWidth = template.canvas.dimensions.width;
  const canvasHeight = template.canvas.dimensions.height;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[600px] max-w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold">Rescale Widgets to Canvas</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Canvas Info */}
          <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm">
              <div className="font-medium text-blue-900 mb-1">Current Canvas</div>
              <div className="text-blue-700">
                {canvasWidth} × {canvasHeight}px ({deviceProfile.name})
              </div>
              <div className="text-blue-700 mt-1">
                {widgetCount} widget{widgetCount !== 1 ? 's' : ''} will be rescaled
              </div>
            </div>
          </div>

          {/* Scaling Mode Selection */}
          <div className="mb-6">
            <label className="block text-sm font-semibold mb-3">Scaling Mode</label>
            <div className="space-y-2">
              <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="scaling-mode"
                  value="proportional"
                  checked={scalingMode === 'proportional'}
                  onChange={(e) => setScalingMode(e.target.value as ScalingMode)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-medium">Proportional (maintain aspect ratio)</div>
                  <div className="text-xs text-gray-600">
                    Scale uniformly to fit canvas while preserving layout proportions
                    {scalingInfo && scalingMode === 'proportional' && (
                      <span className="ml-1 text-blue-600">
                        (Scale: {scalingInfo.scaleX.toFixed(2)}×)
                      </span>
                    )}
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="scaling-mode"
                  value="width_only"
                  checked={scalingMode === 'width_only'}
                  onChange={(e) => setScalingMode(e.target.value as ScalingMode)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-medium">Fit to width only</div>
                  <div className="text-xs text-gray-600">
                    Scale horizontally to match canvas width, keep original heights
                    {scalingInfo && scalingMode === 'width_only' && (
                      <span className="ml-1 text-blue-600">
                        (Scale X: {scalingInfo.scaleX.toFixed(2)}×, Y: unchanged)
                      </span>
                    )}
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="scaling-mode"
                  value="height_only"
                  checked={scalingMode === 'height_only'}
                  onChange={(e) => setScalingMode(e.target.value as ScalingMode)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-medium">Fit to height only</div>
                  <div className="text-xs text-gray-600">
                    Scale vertically to match canvas height, keep original widths
                    {scalingInfo && scalingMode === 'height_only' && (
                      <span className="ml-1 text-blue-600">
                        (Scale Y: {scalingInfo.scaleY.toFixed(2)}×, X: unchanged)
                      </span>
                    )}
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="scaling-mode"
                  value="stretch"
                  checked={scalingMode === 'stretch'}
                  onChange={(e) => setScalingMode(e.target.value as ScalingMode)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-medium">Stretch to fill</div>
                  <div className="text-xs text-gray-600">
                    Scale independently to fill canvas (may distort proportions)
                    {scalingInfo && scalingMode === 'stretch' && (
                      <span className="ml-1 text-blue-600">
                        (Scale X: {scalingInfo.scaleX.toFixed(2)}×, Y: {scalingInfo.scaleY.toFixed(2)}×)
                      </span>
                    )}
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Validation Warnings */}
          {scalingInfo && scalingInfo.warnings.length > 0 && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-lg">
              <div className="flex items-start gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold text-amber-900 mb-1">
                    Validation Warnings ({scalingInfo.warnings.length})
                  </div>
                  <div className="text-sm text-amber-800 space-y-1 max-h-40 overflow-y-auto">
                    {scalingInfo.warnings.slice(0, 10).map((warning, idx) => (
                      <div key={idx}>
                        • {warning.widgetType} widget: {warning.issue}
                      </div>
                    ))}
                    {scalingInfo.warnings.length > 10 && (
                      <div className="text-xs text-amber-700">
                        ...and {scalingInfo.warnings.length - 10} more warnings
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 mt-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoFixViolations}
                  onChange={(e) => setAutoFixViolations(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm font-medium text-amber-900">
                  Auto-fix constraint violations (clamp to minimum values)
                </span>
              </label>
            </div>
          )}

          {/* No Warnings */}
          {scalingInfo && scalingInfo.warnings.length === 0 && (
            <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-sm text-green-800">
                ✓ No constraint violations detected. All widgets will scale safely.
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!scalingInfo || widgetCount === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apply Rescaling
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RescaleDialog;
