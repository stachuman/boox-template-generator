/**
 * Main canvas component for template editing.
 * 
 * Provides the visual editing area where widgets can be placed and manipulated.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React, { useRef, useCallback, useState } from 'react';
import { useDrop } from 'react-dnd';
import { useEditorStore } from '@/stores/editorStore';
import { Widget, DragItem } from '@/types';
import CanvasWidget from './CanvasWidget';
import GridOverlay from './GridOverlay';
import ContextMenu from './ContextMenu';

const Canvas: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  
  const {
    currentTemplate,
    selectedWidget,
    selectedIds,
    currentPage,
    showGrid,
    snapEnabled,
    zoom,
    setZoom,
    wheelMode,
    setCanvasContainerSize,
    addWidget,
    updateWidget,
    removeWidget,
    setSelectedWidget,
    toggleSelectWidget,
    clearSelection,
    getWidgetsForCurrentPage,
  } = useEditorStore() as any;

  const generateWidgetId = useCallback((): string => {
    return `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const snapToGrid = useCallback((value: number, gridSize = 10): number => {
    if (!snapEnabled) return value;
    return Math.round(value / gridSize) * gridSize;
  }, [snapEnabled]);

  const getCanvasPosition = useCallback((clientX: number, clientY: number, element?: Element | null) => {
    const targetElement = element || canvasRef.current;
    if (!targetElement) return { x: 0, y: 0 };
    
    const rect = targetElement.getBoundingClientRect();
    const x = (clientX - rect.left) / zoom;
    const y = (clientY - rect.top) / zoom;
    
    return {
      x: snapToGrid(Math.max(0, x)),
      y: snapToGrid(Math.max(0, y))
    };
  }, [zoom, snapToGrid]);

  // Raw (non-snapped) canvas coordinates for precise pointer tracking
  const getCanvasPositionRaw = useCallback((clientX: number, clientY: number, element?: Element | null) => {
    const targetElement = element || canvasRef.current;
    if (!targetElement) return { x: 0, y: 0 };
    const rect = targetElement.getBoundingClientRect();
    const x = (clientX - rect.left) / zoom;
    const y = (clientY - rect.top) / zoom;
    return { x, y };
  }, [zoom]);

  const [guideV, setGuideV] = useState<number | null>(null);
  const [guideH, setGuideH] = useState<number | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; widget: any | null } | null>(null);

  const [{ isOver, canDrop }, drop] = useDrop({
    accept: 'WIDGET',
    hover: (item: DragItem, monitor) => {
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const canvasPosition = getCanvasPosition(clientOffset.x, clientOffset.y);
      // item.widget may be undefined for new
      const width = item.isNew ? (item.defaultProps?.position.width || 100) : (item.widget?.position.width || 100);
      const height = item.isNew ? (item.defaultProps?.position.height || 30) : (item.widget?.position.height || 30);

      // Filter out all moving widgets (single or group)
      const movingIds = item.selectedWidgets
        ? item.selectedWidgets.map((w: Widget) => w.id)
        : (item.widget ? [item.widget.id] : []);

      const widgets = getWidgetsForCurrentPage().filter((w: Widget) => !movingIds.includes(w.id));
      const TOL = 6 / zoom;
      const xTargets: number[] = [];
      const xCenterTargets: number[] = [];
      const yTargets: number[] = [];
      const yCenterTargets: number[] = [];
      widgets.forEach((w: Widget) => {
        const wx = w.position.x;
        const wy = w.position.y;
        const ww = w.position.width;
        const wh = w.position.height;
        xTargets.push(wx, wx + ww);
        xCenterTargets.push(wx + ww / 2);
        yTargets.push(wy, wy + wh);
        yCenterTargets.push(wy + wh / 2);
      });

      const trySnap = (val: number, targets: number[]) => {
        let best = val;
        let minDelta = Number.MAX_VALUE;
        targets.forEach(t => {
          const d = Math.abs(t - val);
          if (d < minDelta && d <= TOL) {
            minDelta = d;
            best = t;
          }
        });
        return best;
      };

      const left = canvasPosition.x;
      const right = canvasPosition.x + width;
      const hCenter = canvasPosition.x + width / 2;
      const top = canvasPosition.y;
      const bottom = canvasPosition.y + height;
      const vCenter = canvasPosition.y + height / 2;

      let vGuide: number | null = null;
      let hGuide: number | null = null;

      const nl = trySnap(left, xTargets);
      if (nl !== left) vGuide = nl; else {
        const nr = trySnap(right, xTargets);
        if (nr !== right) vGuide = nr; else {
          const nc = trySnap(hCenter, xCenterTargets);
          if (nc !== hCenter) vGuide = nc;
        }
      }

      const nt = trySnap(top, yTargets);
      if (nt !== top) hGuide = nt; else {
        const nb = trySnap(bottom, yTargets);
        if (nb !== bottom) hGuide = nb; else {
          const ncy = trySnap(vCenter, yCenterTargets);
          if (ncy !== vCenter) hGuide = ncy;
        }
      }

      setGuideV(vGuide);
      setGuideH(hGuide);
    },
    drop: (item: DragItem, monitor) => {
      if (!currentTemplate) return;

      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;

      const canvasPosition = getCanvasPosition(clientOffset.x, clientOffset.y);

      // Helper: snap to nearby widget edges/centers
      const snapToWidgets = (pos: { x: number; y: number; width: number; height: number }, movingId?: string, movingIds?: string[]) => {
        const TOL = 6 / zoom; // tolerance in points (scaled)
        const excludeIds = movingIds || (movingId ? [movingId] : []);
        const widgets = getWidgetsForCurrentPage().filter((w: Widget) => !excludeIds.includes(w.id));
        if (widgets.length === 0) return pos;

        const left = pos.x;
        const right = pos.x + pos.width;
        const hCenter = pos.x + pos.width / 2;
        const top = pos.y;
        const bottom = pos.y + pos.height;
        const vCenter = pos.y + pos.height / 2;

        let snappedX = pos.x;
        let snappedY = pos.y;

        // Collect candidate edges
        const xTargets: number[] = [];
        const xCenterTargets: number[] = [];
        const yTargets: number[] = [];
        const yCenterTargets: number[] = [];
        widgets.forEach((w: Widget) => {
          const wx = w.position.x;
          const wy = w.position.y;
          const ww = w.position.width;
          const wh = w.position.height;
          xTargets.push(wx, wx + ww);
          xCenterTargets.push(wx + ww / 2);
          yTargets.push(wy, wy + wh);
          yCenterTargets.push(wy + wh / 2);
        });

        // Snap X (left/right/center)
        const trySnap = (val: number, targets: number[]) => {
          let best = val;
          let minDelta = Number.MAX_VALUE;
          targets.forEach(t => {
            const d = Math.abs(t - val);
            if (d < minDelta && d <= TOL) {
              minDelta = d;
              best = t;
            }
          });
          return best;
        };

        const newLeft = trySnap(left, xTargets);
        if (newLeft !== left) snappedX = newLeft;
        else {
          const newRight = trySnap(right, xTargets);
          if (newRight !== right) snappedX = newRight - pos.width;
          else {
            const newCenter = trySnap(hCenter, xCenterTargets);
            if (newCenter !== hCenter) snappedX = newCenter - pos.width / 2;
          }
        }

        // Snap Y (top/bottom/center)
        const newTop = trySnap(top, yTargets);
        if (newTop !== top) snappedY = newTop;
        else {
          const newBottom = trySnap(bottom, yTargets);
          if (newBottom !== bottom) snappedY = newBottom - pos.height;
          else {
            const newCenterY = trySnap(vCenter, yCenterTargets);
            if (newCenterY !== vCenter) snappedY = newCenterY - pos.height / 2;
          }
        }

        return { ...pos, x: Math.round(snappedX), y: Math.round(snappedY) };
      };

      if (item.isNew && item.widgetType) {
        // Create new widget from palette
        const newWidget: Widget = {
          id: generateWidgetId(),
          type: item.widgetType as Widget['type'],
          page: currentPage,
          content: item.defaultProps?.content || '',
          position: {
            x: canvasPosition.x,
            y: canvasPosition.y,
            width: item.defaultProps?.position.width || 100,
            height: item.defaultProps?.position.height || 30
          },
          styling: item.defaultProps?.styling,
          properties: item.defaultProps?.properties
        };

        // Snap to existing widgets if any
        const snapped = snapToWidgets({ ...newWidget.position }, newWidget.id);
        addWidget({ ...newWidget, position: snapped });
      } else if (!item.isNew && item.widget) {
        // Move existing widget(s) using delta movement for smooth repositioning
        const offset = monitor.getDifferenceFromInitialOffset();

        if (item.selectedWidgets && item.selectedWidgets.length > 1 && item.widget) {
          // Multi-widget drag: move all selected widgets together maintaining relative positions
          if (offset) {
            const deltaX = offset.x / zoom;
            const deltaY = offset.y / zoom;

            // Update all selected widgets with the same offset
            item.selectedWidgets.forEach((w: Widget) => {
              const updatedPosition = {
                ...w.position,
                x: snapToGrid(w.position.x + deltaX),
                y: snapToGrid(w.position.y + deltaY)
              };

              // Only snap the main dragged widget to guides, others follow
              if (item.widget && w.id === item.widget.id) {
                const movingIds = item.selectedWidgets!.map((sw: Widget) => sw.id);
                const snapped = snapToWidgets(
                  { ...updatedPosition, width: w.position.width, height: w.position.height },
                  w.id,
                  movingIds
                );
                // Calculate snap adjustment
                const snapDeltaX = snapped.x - updatedPosition.x;
                const snapDeltaY = snapped.y - updatedPosition.y;

                // Apply main widget snap adjustment to all widgets
                item.selectedWidgets!.forEach((sw: Widget) => {
                  const finalPosition = {
                    x: snapToGrid(sw.position.x + deltaX + snapDeltaX),
                    y: snapToGrid(sw.position.y + deltaY + snapDeltaY)
                  };
                  updateWidget(sw.id, { position: finalPosition });
                });
                return; // Exit after handling all widgets
              }
            });
          }
        } else {
          // Single widget drag
          if (offset) {
            const updatedPosition = {
              ...item.widget.position,
              x: snapToGrid(item.widget.position.x + offset.x / zoom),
              y: snapToGrid(item.widget.position.y + offset.y / zoom)
            };
            const snapped = snapToWidgets({ ...updatedPosition, width: item.widget.position.width, height: item.widget.position.height }, item.widget.id);
            updateWidget(item.widget.id, { position: snapped });
          } else {
            // Fallback to drop position
            const updatedPosition = {
              ...item.widget.position,
              x: canvasPosition.x,
              y: canvasPosition.y
            };
            const snapped = snapToWidgets({ ...updatedPosition, width: item.widget.position.width, height: item.widget.position.height }, item.widget.id);
            updateWidget(item.widget.id, { position: snapped });
          }
        }
      }
      // Clear guides after drop
      setGuideV(null);
      setGuideH(null);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop()
    })
  });

  const justSelectedRef = useRef(false);
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    // If a marquee selection was just completed, do not clear
    if (justSelectedRef.current) {
      // Delay reset to allow all onClick events to process
      setTimeout(() => {
        justSelectedRef.current = false;
      }, 100);
      return;
    }

    // Clear selection when clicking empty areas
    // Check if the click target is a canvas element (container or inner canvas)
    // but not a widget or other interactive element
    const target = e.target as HTMLElement;
    const isCanvasArea = target === e.currentTarget ||
                        target.classList?.contains('bg-white') ||
                        target.id === 'canvas-inner';

    if (isCanvasArea) {
      clearSelection();
    }
  }, [clearSelection]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const ctrlOrCmd = isMac ? event.metaKey : event.ctrlKey;

    // Copy
    if (ctrlOrCmd && (event.key === 'c' || event.key === 'C')) {
      event.preventDefault();
      try {
        (useEditorStore.getState() as any).copySelected();
      } catch (e) {
        console.error('Copy failed', e);
      }
      return;
    }

    // Paste
    if (ctrlOrCmd && (event.key === 'v' || event.key === 'V')) {
      event.preventDefault();
      try {
        (useEditorStore.getState() as any).pasteClipboard();
      } catch (e) {
        console.error('Paste failed', e);
      }
      return;
    }

    // Delete selected
    if (!selectedWidget) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      try {
        removeWidget(selectedWidget.id);
        setSelectedWidget(null);
      } catch (e) {
        console.error('Failed to remove widget', e);
      }
    }
  }, [removeWidget, selectedWidget, setSelectedWidget]);

  if (!currentTemplate) {
    return (
      <div className="h-full flex items-center justify-center text-eink-gray">
        <p>No template loaded</p>
      </div>
    );
  }

  const canvasWidth = currentTemplate.canvas.dimensions.width;
  const canvasHeight = currentTemplate.canvas.dimensions.height;

  // Marquee selection state - use state for rendering, refs for event handlers
  const [dragSelectRect, setDragSelectRect] = useState<{x:number;y:number;width:number;height:number}|null>(null);
  const dragSelectStartRef = useRef<{x:number;y:number}|null>(null);
  const dragSelectRectRef = useRef<{x:number;y:number;width:number;height:number}|null>(null);

  // Use native event listeners to capture before react-dnd
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseDown = (e: MouseEvent) => {
      if (e.target !== canvas) return;
      const pos = getCanvasPositionRaw(e.clientX, e.clientY);
      dragSelectStartRef.current = pos;
      const rect = { x: pos.x, y: pos.y, width: 0, height: 0 };
      dragSelectRectRef.current = rect;
      setDragSelectRect(rect);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!dragSelectStartRef.current) return;
      const start = dragSelectStartRef.current;
      const pos = getCanvasPositionRaw(e.clientX, e.clientY);
      const x = Math.min(start.x, pos.x);
      const y = Math.min(start.y, pos.y);
      const width = Math.abs(pos.x - start.x);
      const height = Math.abs(pos.y - start.y);
      const rect = { x, y, width, height };
      dragSelectRectRef.current = rect;
      setDragSelectRect(rect);
    };

    const onMouseUp = (e: MouseEvent) => {
      const rect = dragSelectRectRef.current;
      if (!rect || (rect.width === 0 && rect.height === 0)) {
        dragSelectStartRef.current = null;
        dragSelectRectRef.current = null;
        setDragSelectRect(null);
        return;
      }

      const widgets: Widget[] = getWidgetsForCurrentPage();

      const selected = widgets.filter(w => {
        const wx1 = w.position.x;
        const wy1 = w.position.y;
        const wx2 = wx1 + w.position.width;
        const wy2 = wy1 + w.position.height;
        const rx1 = rect.x;
        const ry1 = rect.y;
        const rx2 = rect.x + rect.width;
        const ry2 = rect.y + rect.height;
        return !(wx2 < rx1 || wx1 > rx2 || wy2 < ry1 || wy1 > ry2);
      });

      if (selected.length) {
        setSelectedWidget(selected[0]);
        for (let i = 1; i < selected.length; i++) {
          toggleSelectWidget(selected[i].id);
        }
        justSelectedRef.current = true;
        e.stopPropagation();
        e.preventDefault();
      }

      dragSelectStartRef.current = null;
      dragSelectRectRef.current = null;
      setDragSelectRect(null);
    };

    canvas.addEventListener('mousedown', onMouseDown, true);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown, true);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // Context menu helpers
  const openWidgetMenu = (e: React.MouseEvent, w: any) => {
    if (!selectedIds?.includes(w.id)) setSelectedWidget(w);
    const rect = containerRef.current?.getBoundingClientRect();
    const relX = rect ? e.clientX - rect.left : e.clientX;
    const relY = rect ? e.clientY - rect.top : e.clientY;
    setMenu({ x: relX, y: relY, widget: w });
  };
  const openCanvasMenu = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const relX = rect ? e.clientX - rect.left : e.clientX;
    const relY = rect ? e.clientY - rect.top : e.clientY;
    setMenu({ x: relX, y: relY, widget: null });
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const [origin, setOrigin] = useState<{x:number; y:number}>({ x: 0, y: 0 });

  // Attach a non-passive wheel listener so we can prevent page scroll/zoom
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // Only handle if the wheel event originated inside the canvas container
      if (!el.contains(e.target as Node)) return;
      if (wheelMode === 'zoom') {
        e.preventDefault();
        // Compute pivot relative to canvas element to keep cursor as zoom focus
        const rect = (canvasRef.current || el).getBoundingClientRect();
        const localX = (e.clientX - rect.left);
        const localY = (e.clientY - rect.top);
        setOrigin({ x: localX, y: localY });
        const factor = e.deltaY > 0 ? 0.9 : 1.1; // smooth multiplicative zoom
        const next = Math.max(0.1, Math.min(3, zoom * factor));
        setZoom(next);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel as any);
    };
  }, [zoom, setZoom, wheelMode]);

  // Track container size for fit-to-screen calculations
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        setCanvasContainerSize({ width: cr.width, height: cr.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [setCanvasContainerSize]);

  return (
    <div 
      ref={containerRef}
      className="relative flex justify-center items-start min-h-full py-6"
      onClick={handleCanvasClick}
      onKeyDown={handleKeyDown}
      // Note: actual zoom handling attached via non-passive listener below
      onWheel={() => { /* handled in effect to allow preventDefault */ }}
      tabIndex={0}
    >
      {/* Canvas */}
      <div
        id="canvas-inner"
        ref={(node) => {
          if (canvasRef) {
            (canvasRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          }
          drop(node);
        }}
        className="relative bg-white shadow-lg border border-eink-pale-gray"
        style={{
          width: canvasWidth,
          height: canvasHeight,
          transform: `scale(${zoom})`,
          transformOrigin: `${origin.x}px ${origin.y}px`,
        }}
        onClick={handleCanvasClick}
        onContextMenu={(e) => {
          e.preventDefault();
          if (e.target === e.currentTarget) openCanvasMenu(e);
        }}
      >
        {/* Grid Overlay */}
        {showGrid && <GridOverlay />}

        {/* Drop Indicator */}
        {isOver && canDrop && (
          <div className="absolute inset-0 bg-blue-100 bg-opacity-20 border-2 border-blue-300 border-dashed" />
        )}

        {/* Snap Guides */}
        {guideV !== null && (
          <div className="absolute top-0 w-px bg-blue-400" style={{ left: guideV, height: canvasHeight }} />
        )}
        {guideH !== null && (
          <div className="absolute left-0 h-px bg-blue-400" style={{ top: guideH, width: canvasWidth }} />
        )}

        {/* Widgets - sorted by z_order (lower values render first/behind) */}
        {getWidgetsForCurrentPage()
          .sort((a: Widget, b: Widget) => (a.z_order ?? 0) - (b.z_order ?? 0))
          .map((widget: Widget) => (
            <CanvasWidget
              key={widget.id}
              widget={widget}
              isSelected={selectedIds?.includes(widget.id) || selectedWidget?.id === widget.id}
              onSelect={(w, additive) => {
                if (additive) toggleSelectWidget(w.id); else setSelectedWidget(w);
              }}
              zoom={zoom}
              onContextMenu={(evt, w) => openWidgetMenu(evt, w)}
            />
          ))}

        {/* Marquee Selection (inside canvas, respects transform) */}
        {dragSelectRect && (
          <div
            className="absolute border-2 border-blue-300 bg-blue-100 bg-opacity-20 pointer-events-none"
            style={{
              left: dragSelectRect.x,
              top: dragSelectRect.y,
              width: dragSelectRect.width,
              height: dragSelectRect.height,
            }}
          />
        )}
      </div>

      {/* Canvas Info */}
      <div className="absolute bottom-4 right-4 bg-white bg-opacity-90 px-3 py-2 rounded shadow text-xs text-eink-gray">
        {canvasWidth} × {canvasHeight} pt ({Math.round(zoom * 100)}%)
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={(function () {
            const items: { label: string; onClick: () => void; disabled?: boolean }[] = [];
            const store = (useEditorStore.getState() as any);
            if (menu.widget) {
              items.push({ label: 'Bring to Front', onClick: () => store.bringToFront(menu.widget.id) });
              items.push({ label: 'Send to Back', onClick: () => store.sendToBack(menu.widget.id) });
              items.push({ label: 'Copy', onClick: () => store.copySelected() });
              items.push({ label: 'Paste', onClick: () => store.pasteClipboard(), disabled: !(store.clipboard && store.clipboard.length) });
              items.push({ label: 'Duplicate', onClick: () => store.duplicateWidget(menu.widget.id) });
              items.push({ label: 'Delete', onClick: () => store.removeWidget(menu.widget.id) });
              const assigned = store.getAssignedMasterForPage(store.currentPage);
              const inMaster = store.findMasterIdByWidget(menu.widget.id);
              if (!inMaster && assigned) items.push({ label: 'Move to Master', onClick: () => store.moveWidgetToMaster(menu.widget.id, assigned) });
              if (inMaster) items.push({ label: 'Detach to Page', onClick: () => store.detachWidgetFromMasterToPage(menu.widget.id, store.currentPage) });
              if (store.selectedIds && store.selectedIds.length >= 2) {
                items.push({ label: 'Align Left', onClick: () => store.alignSelected('left') });
                items.push({ label: 'Align Center', onClick: () => store.alignSelected('center') });
                items.push({ label: 'Align Right', onClick: () => store.alignSelected('right') });
                items.push({ label: 'Align Top', onClick: () => store.alignSelected('top') });
                items.push({ label: 'Align Middle', onClick: () => store.alignSelected('middle') });
                items.push({ label: 'Align Bottom', onClick: () => store.alignSelected('bottom') });
                items.push({ label: 'Distribute H', onClick: () => store.distributeSelected('horizontal') });
                items.push({ label: 'Distribute V', onClick: () => store.distributeSelected('vertical') });
              }
            } else {
              items.push({ label: 'Paste', onClick: () => store.pasteClipboard(), disabled: !(store.clipboard && store.clipboard.length) });
            }
            return items;
          })()}
        />
      )}
    </div>
  );
};

export default Canvas;
