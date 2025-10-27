/**
 * Snapping utilities for widget positioning.
 *
 * Provides multi-level smart snapping:
 * 1. Canvas boundaries and safe margins
 * 2. Grid snapping
 * 3. Widget-to-widget edge and center alignment
 *
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import { Widget, Position } from '@/types';

export interface SnapResult {
  x: number;
  y: number;
  snappedToX?: 'grid' | 'widget' | 'margin' | 'canvas';
  snappedToY?: 'grid' | 'widget' | 'margin' | 'canvas';
  guideX?: number;  // X coordinate of vertical guide line
  guideY?: number;  // Y coordinate of horizontal guide line
  distanceX?: number;  // Distance to snapped target
  distanceY?: number;  // Distance to snapped target
}

export interface SnapOptions {
  snapEnabled: boolean;
  gridSize: number;
  snapTolerance: number;  // In canvas points
  canvasWidth: number;
  canvasHeight: number;
  safeMargins?: [number, number, number, number];  // top, right, bottom, left
  excludeWidgetIds?: string[];
  allWidgets?: Widget[];
}

/**
 * Snap a value to grid.
 */
export function snapToGrid(value: number, gridSize: number, enabled: boolean): number {
  if (!enabled || gridSize <= 0) return value;
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Snap position to canvas boundaries and safe margins.
 */
export function snapToCanvasBounds(
  pos: Position,
  canvasWidth: number,
  canvasHeight: number,
  margins?: [number, number, number, number],
  tolerance: number = 8
): Partial<SnapResult> {
  const result: Partial<SnapResult> = { x: pos.x, y: pos.y };
  const [marginTop = 0, marginRight = 0, marginBottom = 0, marginLeft = 0] = margins || [];

  // Check left edge
  if (Math.abs(pos.x - marginLeft) <= tolerance) {
    result.x = marginLeft;
    result.snappedToX = marginLeft > 0 ? 'margin' : 'canvas';
    result.guideX = marginLeft;
  }

  // Check right edge
  const rightEdge = pos.x + pos.width;
  const canvasRightBound = canvasWidth - marginRight;
  if (Math.abs(rightEdge - canvasRightBound) <= tolerance) {
    result.x = canvasRightBound - pos.width;
    result.snappedToX = marginRight > 0 ? 'margin' : 'canvas';
    result.guideX = canvasRightBound;
  }

  // Check top edge
  if (Math.abs(pos.y - marginTop) <= tolerance) {
    result.y = marginTop;
    result.snappedToY = marginTop > 0 ? 'margin' : 'canvas';
    result.guideY = marginTop;
  }

  // Check bottom edge
  const bottomEdge = pos.y + pos.height;
  const canvasBottomBound = canvasHeight - marginBottom;
  if (Math.abs(bottomEdge - canvasBottomBound) <= tolerance) {
    result.y = canvasBottomBound - pos.height;
    result.snappedToY = marginBottom > 0 ? 'margin' : 'canvas';
    result.guideY = canvasBottomBound;
  }

  return result;
}

/**
 * Snap position to nearby widgets' edges and centers.
 */
export function snapToWidgets(
  pos: Position,
  widgets: Widget[],
  tolerance: number = 6
): Partial<SnapResult> {
  if (widgets.length === 0) {
    return { x: pos.x, y: pos.y };
  }

  const result: Partial<SnapResult> = { x: pos.x, y: pos.y };

  // Current widget edges and center
  const left = pos.x;
  const right = pos.x + pos.width;
  const hCenter = pos.x + pos.width / 2;
  const top = pos.y;
  const bottom = pos.y + pos.height;
  const vCenter = pos.y + pos.height / 2;

  // Collect all snap targets from other widgets
  const xEdgeTargets: number[] = [];
  const xCenterTargets: number[] = [];
  const yEdgeTargets: number[] = [];
  const yCenterTargets: number[] = [];

  widgets.forEach((w) => {
    const wx = w.position.x;
    const wy = w.position.y;
    const ww = w.position.width;
    const wh = w.position.height;

    xEdgeTargets.push(wx, wx + ww);
    xCenterTargets.push(wx + ww / 2);
    yEdgeTargets.push(wy, wy + wh);
    yCenterTargets.push(wy + wh / 2);
  });

  // Helper to find nearest snap target
  const findNearestSnap = (value: number, targets: number[]): { snapped: number; distance: number } | null => {
    let bestTarget: number | null = null;
    let minDistance = Number.MAX_VALUE;

    targets.forEach((target) => {
      const distance = Math.abs(target - value);
      if (distance <= tolerance && distance < minDistance) {
        minDistance = distance;
        bestTarget = target;
      }
    });

    if (bestTarget !== null) {
      return { snapped: bestTarget, distance: minDistance };
    }
    return null;
  };

  // Snap X (priority: left edge, right edge, center)
  const leftSnap = findNearestSnap(left, xEdgeTargets);
  if (leftSnap) {
    result.x = leftSnap.snapped;
    result.snappedToX = 'widget';
    result.guideX = leftSnap.snapped;
    result.distanceX = leftSnap.distance;
  } else {
    const rightSnap = findNearestSnap(right, xEdgeTargets);
    if (rightSnap) {
      result.x = rightSnap.snapped - pos.width;
      result.snappedToX = 'widget';
      result.guideX = rightSnap.snapped;
      result.distanceX = rightSnap.distance;
    } else {
      const centerSnap = findNearestSnap(hCenter, xCenterTargets);
      if (centerSnap) {
        result.x = centerSnap.snapped - pos.width / 2;
        result.snappedToX = 'widget';
        result.guideX = centerSnap.snapped;
        result.distanceX = centerSnap.distance;
      }
    }
  }

  // Snap Y (priority: top edge, bottom edge, center)
  const topSnap = findNearestSnap(top, yEdgeTargets);
  if (topSnap) {
    result.y = topSnap.snapped;
    result.snappedToY = 'widget';
    result.guideY = topSnap.snapped;
    result.distanceY = topSnap.distance;
  } else {
    const bottomSnap = findNearestSnap(bottom, yEdgeTargets);
    if (bottomSnap) {
      result.y = bottomSnap.snapped - pos.height;
      result.snappedToY = 'widget';
      result.guideY = bottomSnap.snapped;
      result.distanceY = bottomSnap.distance;
    } else {
      const centerSnap = findNearestSnap(vCenter, yCenterTargets);
      if (centerSnap) {
        result.y = centerSnap.snapped - pos.height / 2;
        result.snappedToY = 'widget';
        result.guideY = centerSnap.snapped;
        result.distanceY = centerSnap.distance;
      }
    }
  }

  return result;
}

/**
 * Smart multi-level snapping.
 *
 * Priority order:
 * 1. Canvas boundaries and safe margins (highest priority for e-ink)
 * 2. Widget-to-widget alignment
 * 3. Grid snapping (fallback)
 */
export function smartSnap(
  pos: Position,
  options: SnapOptions
): SnapResult {
  if (!options.snapEnabled) {
    return { x: pos.x, y: pos.y };
  }

  let result: SnapResult = { x: pos.x, y: pos.y };

  // Step 1: Try canvas boundary snapping (highest priority)
  if (options.safeMargins) {
    const boundSnap = snapToCanvasBounds(
      pos,
      options.canvasWidth,
      options.canvasHeight,
      options.safeMargins,
      options.snapTolerance
    );

    if (boundSnap.snappedToX) {
      result.x = boundSnap.x!;
      result.snappedToX = boundSnap.snappedToX;
      result.guideX = boundSnap.guideX;
    }

    if (boundSnap.snappedToY) {
      result.y = boundSnap.y!;
      result.snappedToY = boundSnap.snappedToY;
      result.guideY = boundSnap.guideY;
    }
  }

  // Step 2: Try widget snapping (if not already snapped to canvas)
  if (options.allWidgets && options.allWidgets.length > 0) {
    const excludeIds = options.excludeWidgetIds || [];
    const candidateWidgets = options.allWidgets.filter((w) => !excludeIds.includes(w.id));

    const widgetSnap = snapToWidgets(
      { ...pos, x: result.x, y: result.y },
      candidateWidgets,
      options.snapTolerance
    );

    if (!result.snappedToX && widgetSnap.snappedToX) {
      result.x = widgetSnap.x!;
      result.snappedToX = widgetSnap.snappedToX;
      result.guideX = widgetSnap.guideX;
      result.distanceX = widgetSnap.distanceX;
    }

    if (!result.snappedToY && widgetSnap.snappedToY) {
      result.y = widgetSnap.y!;
      result.snappedToY = widgetSnap.snappedToY;
      result.guideY = widgetSnap.guideY;
      result.distanceY = widgetSnap.distanceY;
    }
  }

  // Step 3: Apply grid snapping (fallback if not snapped to anything else)
  if (!result.snappedToX) {
    const gridX = snapToGrid(result.x, options.gridSize, true);
    if (gridX !== result.x) {
      result.x = gridX;
      result.snappedToX = 'grid';
    }
  }

  if (!result.snappedToY) {
    const gridY = snapToGrid(result.y, options.gridSize, true);
    if (gridY !== result.y) {
      result.y = gridY;
      result.snappedToY = 'grid';
    }
  }

  return result;
}
