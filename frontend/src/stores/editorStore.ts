/**
 * Zustand store for managing editor state.
 * 
 * Centralized state management for the template editor.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Widget, DeviceProfile, Template, EditorState } from '@/types';

// Calculate canvas dimensions from device profile.
// Matches backend logic: converts screen pixels to points and respects orientation.
// Following CLAUDE.md: No fallbacks - throws error if profile is invalid.
const getPageDimensions = (profile: DeviceProfile): { width: number; height: number } => {
  if (!profile) {
    throw new Error('Device profile is required. Please select a valid device profile.');
  }

  const { pdf_settings: pdfSettings, display } = profile;

  if (!pdfSettings?.orientation) {
    throw new Error(
      `Device profile '${profile.name}' is missing pdf_settings.orientation. ` +
      'Please select a valid device profile.'
    );
  }

  if (!display?.screen_size || !display?.ppi) {
    throw new Error(
      `Device profile '${profile.name}' is missing display.screen_size or display.ppi. ` +
      'Please select a valid device profile.'
    );
  }

  const [screenWidthPx, screenHeightPx] = display.screen_size;
  const ppi = display.ppi;
  const orientation = pdfSettings.orientation;

  if (!screenWidthPx || !screenHeightPx || !ppi || screenWidthPx <= 0 || screenHeightPx <= 0 || ppi <= 0) {
    throw new Error(
      `Device profile '${profile.name}' has invalid display settings. ` +
      'Please select a valid device profile.'
    );
  }

  // Convert pixels to points: (pixels / ppi) * 72
  const pxToPoints = (value: number) => (value / ppi) * 72;
  let widthPt = pxToPoints(screenWidthPx);
  let heightPt = pxToPoints(screenHeightPx);

  // Respect orientation setting - swap dimensions if needed
  const screenIsLandscape = widthPt > heightPt;
  const wantsPortrait = orientation === 'portrait';

  if (screenIsLandscape && wantsPortrait) {
    [widthPt, heightPt] = [heightPt, widthPt];
  } else if (!screenIsLandscape && !wantsPortrait) {
    [widthPt, heightPt] = [heightPt, widthPt];
  }

  const roundToTenth = (value: number) => Math.round(value * 10) / 10;

  return {
    width: roundToTenth(widthPt),
    height: roundToTenth(heightPt),
  };
};

// Drag overlay info
export interface DragInfo {
  x: number;
  y: number;
  width?: number;
  height?: number;
  cursorX?: number;
  cursorY?: number;
  isResizing?: boolean;
}

interface EditorStore extends EditorState {
  // Actions
  setSelectedWidget: (widget: Widget | null) => void;
  toggleSelectWidget: (widgetId: string) => void;
  clearSelection: () => void;
  setActiveProfile: (profile: DeviceProfile | null) => void;
  setCurrentTemplate: (template: Template | null) => void;
  setIsDragging: (isDragging: boolean) => void;
  setDragInfo: (info: DragInfo | null) => void;
  dragInfo: DragInfo | null;
  setShowGrid: (showGrid: boolean) => void;
  setSnapEnabled: (snapEnabled: boolean) => void;
  setGridSize: (gridSize: number) => void;
  setZoom: (zoom: number) => void;
  // Wheel behavior
  wheelMode: 'scroll' | 'zoom';
  setWheelMode: (mode: 'scroll' | 'zoom') => void;
  canvasContainerSize: { width: number; height: number } | null;
  setCanvasContainerSize: (size: { width: number; height: number }) => void;
  setCanvasScrollContainer: (container: HTMLDivElement | null) => void;
  // Panel visibility
  setShowWidgetPalette: (show: boolean) => void;
  setShowPagesPanel: (show: boolean) => void;
  setShowRightPanel: (show: boolean) => void;
  
  // Multi-page operations
  setCurrentPage: (page: number) => void;
  addPage: () => void;
  addPages: (count: number) => void;
  deletePage: (pageNumber: number) => void;
  duplicatePage: (pageNumber: number) => void;
  duplicatePages: (sourcePageNumber: number, count: number) => void;
  getWidgetsForCurrentPage: () => Widget[];
  getWidgetsForPage: (pageNumber: number) => Widget[];
  
  // Widget manipulation
  addWidget: (widget: Widget) => void;
  updateWidget: (widgetId: string, updates: Partial<Widget>) => void;
  removeWidget: (widgetId: string) => void;
  duplicateWidget: (widgetId: string) => void;
  bringToFront: (widgetId: string) => void;
  sendToBack: (widgetId: string) => void;

  // Template metadata operations
  updateTemplateMetadata: (updates: Partial<Template['metadata']>) => void;

  // Canvas operations
  clearCanvas: () => void;
  resetEditor: () => void;

  // Align/Distribute
  alignSelected: (mode: 'left'|'center'|'right'|'top'|'middle'|'bottom') => void;
  distributeSelected: (axis: 'horizontal'|'vertical') => void;
  equalizeSizeSelected: (mode: 'width'|'height'|'both') => void;

  // Clipboard
  copySelected: () => void;
  pasteClipboard: () => void;

  // Masters
  addMaster: (name?: string) => string; // returns master id
  removeMaster: (masterId: string) => void;
  renameMaster: (masterId: string, name: string) => void;
  assignMasterToPage: (page: number, masterId: string | null) => void;
  getAssignedMasterForPage: (page: number) => string | null;
  moveWidgetToMaster: (widgetId: string, masterId: string) => void;
  detachWidgetFromMasterToPage: (widgetId: string, page: number) => void;
  findMasterIdByWidget: (widgetId: string) => string | null;
}

// Create a minimal template without canvas dimensions.
// Canvas dimensions MUST be set by selecting a valid device profile.
// Following CLAUDE.md: No default fallbacks to A4 or other standard sizes.
const createDefaultTemplate = (): Template => ({
  schema_version: "1.0",
  metadata: {
    name: "New Template",
    description: "",
    category: "general",
    version: "1.0",
    author: "",
    created: new Date().toISOString(),
    profile: "" // REQUIRED: User must select a device profile
  },
  canvas: {
    dimensions: {
      width: 0,  // INVALID: Must be set by selecting a device profile
      height: 0, // INVALID: Must be set by selecting a device profile
      margins: [36, 36, 36, 36]
    },
    coordinate_system: "top_left",
    background: "#FFFFFF",
    grid_size: 10,
    snap_enabled: true
  },
  widgets: [],
  navigation: {},
  masters: [],
  page_assignments: [],
  export: {
    default_mode: "interactive"
  }
});

export const useEditorStore = create<EditorStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      selectedWidget: null,
      selectedIds: [],
      clipboard: [],
      activeProfile: null,
      currentTemplate: createDefaultTemplate(),
      isDragging: false,
      dragInfo: null,
      showGrid: true,
      snapEnabled: true,
      zoom: 1,
      wheelMode: 'scroll',
      canvasContainerSize: null,
      canvasScrollContainer: null,
      // Panel visibility
      showWidgetPalette: true,
      showPagesPanel: true,
      showRightPanel: true,
      currentPage: 1,
      totalPages: 1,

      // Basic setters
      setSelectedWidget: (widget) => set({ selectedWidget: widget, selectedIds: widget ? [widget.id] : [] }),
      toggleSelectWidget: (widgetId) => set((state) => {
        const setIds = new Set(state.selectedIds || []);
        if (setIds.has(widgetId)) setIds.delete(widgetId); else setIds.add(widgetId);
        return { selectedIds: Array.from(setIds), selectedWidget: state.currentTemplate?.widgets.find(w => w.id === widgetId) || state.selectedWidget } as any;
      }),
      clearSelection: () => set({ selectedWidget: null, selectedIds: [] }),
      setActiveProfile: (profile) => {
        set({ activeProfile: profile });

        // Update template profile and canvas dimensions if a template is loaded
        const currentTemplate = get().currentTemplate;
        if (currentTemplate && profile) {
          try {
            // Get new canvas dimensions based on profile's PDF settings
            const newDimensions = getPageDimensions(profile);

            // Use profile's safe margins, or default to 36pt (0.5 inch) if not specified
            // Note: Backend uses same default in profiles.py
            const margins = profile.pdf_settings?.safe_margins ?? [36, 36, 36, 36];

            set({
              currentTemplate: {
                ...currentTemplate,
                metadata: {
                  ...currentTemplate.metadata,
                  profile: profile.name
                },
                canvas: {
                  ...currentTemplate.canvas,
                  dimensions: {
                    width: newDimensions.width,
                    height: newDimensions.height,
                    margins: margins
                  }
                }
              }
            });
          } catch (error) {
            console.error('Failed to update canvas from profile:', error);
            throw error;
          }
        }
      },
      setCurrentTemplate: (template) => set({ currentTemplate: template }),
      setIsDragging: (isDragging) => set({ isDragging }),
      setDragInfo: (dragInfo) => set({ dragInfo }),
      setShowGrid: (showGrid) => set({ showGrid }),
      setShowWidgetPalette: (show) => set({ showWidgetPalette: show }),
      setShowPagesPanel: (show) => set({ showPagesPanel: show }),
      setShowRightPanel: (show) => set({ showRightPanel: show }),
      setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
      setGridSize: (gridSize) => {
        const { currentTemplate } = get();

        // Fail fast if no template (CLAUDE.md Rule #4)
        if (!currentTemplate) {
          console.error('setGridSize: Cannot set grid size - no template loaded');
          return;
        }

        // Validate input (CLAUDE.md Rule #3)
        if (typeof gridSize !== 'number' || !isFinite(gridSize)) {
          console.error('setGridSize: Invalid grid size - must be a finite number', gridSize);
          return;
        }

        // Grid size constraints: minimum 1pt, maximum 100pt for usability
        const MIN_GRID_SIZE = 1;
        const MAX_GRID_SIZE = 100;
        const clampedSize = Math.max(MIN_GRID_SIZE, Math.min(MAX_GRID_SIZE, Math.round(gridSize)));

        const updated = {
          ...currentTemplate,
          canvas: {
            ...currentTemplate.canvas,
            grid_size: clampedSize
          }
        };
        set({ currentTemplate: updated });
      },
      setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(3, zoom)) }),
      setWheelMode: (mode) => set({ wheelMode: mode }),
      setCanvasContainerSize: (size) => set({ canvasContainerSize: size }),
      setCanvasScrollContainer: (container) => set({ canvasScrollContainer: container }),

      // Multi-page operations
      setCurrentPage: (page) => {
        const { totalPages } = get();
        const clampedPage = Math.max(1, Math.min(totalPages, page));
        set({ 
          currentPage: clampedPage,
          selectedWidget: null,
          selectedIds: []
        });
      },

      addPage: () => {
        const { totalPages } = get();
        set({ 
          totalPages: totalPages + 1,
          currentPage: totalPages + 1
        });
      },

      addPages: (count: number) => {
        if (count < 1) {
          throw new Error("Page count must be at least 1");
        }
        if (count > 100) {
          throw new Error("Cannot add more than 100 pages at once");
        }
        
        const { totalPages } = get();
        set({ 
          totalPages: totalPages + count,
          currentPage: totalPages + 1 // Go to first newly created page
        });
      },

      deletePage: (pageNumber) => {
        const { totalPages, currentPage, currentTemplate } = get();
        if (totalPages <= 1) return; // Can't delete the last page
        if (pageNumber < 1 || pageNumber > totalPages) return; // Invalid page number

        // Remove all widgets from the deleted page
        if (currentTemplate) {
          const filteredWidgets = currentTemplate.widgets.filter(w => w.page !== pageNumber);
          // Adjust page numbers for widgets on pages after the deleted one
          const adjustedWidgets = filteredWidgets.map(w => {
            const widgetPage = w.page ?? 1; // Treat undefined as page 1
            return {
              ...w,
              page: widgetPage > pageNumber ? widgetPage - 1 : widgetPage
            };
          });

          set({
            currentTemplate: {
              ...currentTemplate,
              widgets: adjustedWidgets
            },
            totalPages: totalPages - 1,
            currentPage: currentPage > pageNumber ? currentPage - 1 : 
                        currentPage === pageNumber ? Math.min(currentPage, totalPages - 1) : currentPage,
            selectedWidget: null,
            selectedIds: []
          });
        } else {
          set({
            totalPages: totalPages - 1,
            currentPage: currentPage > pageNumber ? currentPage - 1 : 
                        currentPage === pageNumber ? Math.min(currentPage, totalPages - 1) : currentPage,
            selectedWidget: null,
            selectedIds: []
          });
        }
      },

      duplicatePage: (pageNumber) => {
        const { totalPages, currentTemplate } = get();
        if (pageNumber < 1 || pageNumber > totalPages) {
          throw new Error(`Invalid page number: ${pageNumber}. Must be between 1 and ${totalPages}`);
        }

        if (currentTemplate) {
          // Find all widgets on the source page
          const sourceWidgets = currentTemplate.widgets.filter(w => w.page === pageNumber);
          
          // Create duplicated widgets on the new page
          const duplicatedWidgets = sourceWidgets.map(widget => ({
            ...widget,
            id: `${widget.id}_copy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            page: totalPages + 1
          }));

          set({
            currentTemplate: {
              ...currentTemplate,
              widgets: [...currentTemplate.widgets, ...duplicatedWidgets]
            },
            totalPages: totalPages + 1,
            currentPage: totalPages + 1,
            selectedWidget: null,
            selectedIds: []
          });
        } else {
          set({
            totalPages: totalPages + 1,
            currentPage: totalPages + 1,
            selectedWidget: null,
            selectedIds: []
          });
        }
      },

      duplicatePages: (sourcePageNumber: number, count: number) => {
        if (count < 1) {
          throw new Error("Page count must be at least 1");
        }
        if (count > 50) {
          throw new Error("Cannot duplicate more than 50 pages at once");
        }
        
        const { totalPages, currentTemplate } = get();
        if (sourcePageNumber < 1 || sourcePageNumber > totalPages) {
          throw new Error(`Invalid source page number: ${sourcePageNumber}. Must be between 1 and ${totalPages}`);
        }

        if (currentTemplate) {
          // Find all widgets on the source page
          const sourceWidgets = currentTemplate.widgets.filter(w => w.page === sourcePageNumber);
          
          // Create duplicated widgets for each new page
          const allDuplicatedWidgets: Widget[] = [];
          for (let i = 0; i < count; i++) {
            const pageWidgets = sourceWidgets.map(widget => ({
              ...widget,
              id: `${widget.id}_copy_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`,
              page: totalPages + 1 + i
            }));
            allDuplicatedWidgets.push(...pageWidgets);
          }

          set({
            currentTemplate: {
              ...currentTemplate,
              widgets: [...currentTemplate.widgets, ...allDuplicatedWidgets]
            },
            totalPages: totalPages + count,
            currentPage: totalPages + 1, // Go to first newly created page
            selectedWidget: null,
            selectedIds: []
          });
        } else {
          set({
            totalPages: totalPages + count,
            currentPage: totalPages + 1,
            selectedWidget: null,
            selectedIds: []
          });
        }
      },

      getWidgetsForCurrentPage: () => {
        const { currentTemplate, currentPage } = get();
        if (!currentTemplate) return [];
        const pageWidgets = currentTemplate.widgets.filter(widget =>
          widget.page === currentPage || (widget.page === undefined && currentPage === 1)
        );
        // Include master widgets assigned to this page
        const assignment = (currentTemplate.page_assignments || []).find(pa => pa.page === currentPage) as any;
        if (!assignment) return pageWidgets;
        const master = (currentTemplate.masters || []).find(m => (m as any).id === assignment.master_id) as any;
        if (!master) return pageWidgets;
        // Clone master widgets with page set to currentPage for editor rendering
        const masterWidgets = (master.widgets || []).map((w: any) => ({ ...w, page: currentPage }));
        return [...masterWidgets, ...pageWidgets];
      },

      getWidgetsForPage: (pageNumber: number) => {
        const { currentTemplate, totalPages } = get();
        if (!currentTemplate) return [];
        if (pageNumber < 1 || pageNumber > totalPages) return [];
        return currentTemplate.widgets.filter(widget =>
          widget.page === pageNumber || (widget.page === undefined && pageNumber === 1)
        );
      },

      // Widget manipulation
      addWidget: (widget) => {
        const { currentTemplate, currentPage } = get();
        if (!currentTemplate) {
          throw new Error("No template loaded");
        }

        // Find max z_order to place new widget on top
        const maxZOrder = currentTemplate.widgets.reduce((max, w) => {
          const z = w.z_order ?? 0;
          return z > max ? z : max;
        }, 0);

        // Only assign page if not already specified (for master templates, leave undefined)
        // Always assign z_order to place new widget on top
        const widgetWithPage = {
          ...widget,
          ...(widget.page === undefined ? { page: currentPage } : {}),
          z_order: widget.z_order !== undefined ? widget.z_order : maxZOrder + 1
        };

        set({
          currentTemplate: {
            ...currentTemplate,
            widgets: [...currentTemplate.widgets, widgetWithPage]
          },
          selectedWidget: widgetWithPage,
          selectedIds: [widgetWithPage.id]
        });
      },

      updateWidget: (widgetId, updates) => {
        const currentTemplate = get().currentTemplate;
        if (!currentTemplate) throw new Error("No template loaded");

        let found = false;
        // Try page widgets first
        let pageWidgets = currentTemplate.widgets.map(widget => {
          if (widget.id !== widgetId) return widget;
          found = true;
          const updatedWidget = {
            ...widget,
            ...updates,
            position: updates.position ? { ...widget.position, ...updates.position } : widget.position,
            styling: updates.styling ? { ...widget.styling, ...updates.styling } : widget.styling,
            properties: updates.properties ? { ...widget.properties, ...updates.properties } : widget.properties
          } as any;
          return updatedWidget;
        });

        // If not found, try master widgets
        let masters = (currentTemplate.masters || []).map((m: any) => {
          if (found) return m;
          const widgets = (m.widgets || []).map((w: any) => {
            if (w.id !== widgetId) return w;
            found = true;
            return {
              ...w,
              ...updates,
              position: updates.position ? { ...w.position, ...updates.position } : w.position,
              styling: updates.styling ? { ...w.styling, ...updates.styling } : w.styling,
              properties: updates.properties ? { ...w.properties, ...updates.properties } : w.properties
            };
          });
          return { ...m, widgets };
        });

        const updatedWidget = found
          ? (pageWidgets.find(w => w.id === widgetId) || masters.flatMap((m: any) => m.widgets || []).find((w: any) => w.id === widgetId))
          : undefined;

        set({
          currentTemplate: {
            ...currentTemplate,
            widgets: pageWidgets,
            masters
          },
          selectedWidget: updatedWidget || get().selectedWidget
        });
      },

      removeWidget: (widgetId) => {
        const currentTemplate = get().currentTemplate;
        if (!currentTemplate) throw new Error("No template loaded");
        const pageFiltered = currentTemplate.widgets.filter(w => w.id !== widgetId);
        const masters = (currentTemplate.masters || []).map((m: any) => ({
          ...m,
          widgets: (m.widgets || []).filter((w: any) => w.id !== widgetId)
        }));
        set({
          currentTemplate: {
            ...currentTemplate,
            widgets: pageFiltered,
            masters
          },
          selectedWidget: get().selectedWidget?.id === widgetId ? null : get().selectedWidget
        });
      },

      duplicateWidget: (widgetId) => {
        const currentTemplate = get().currentTemplate;
        if (!currentTemplate) {
          throw new Error("No template loaded");
        }

        const originalWidget = currentTemplate.widgets.find(w => w.id === widgetId);
        if (!originalWidget) {
          throw new Error("Widget not found");
        }

        // Create duplicate with new ID and offset position
        // Exclude z_order so addWidget assigns a new one (on top)
        const { z_order, ...widgetWithoutZOrder } = originalWidget;
        const duplicatedWidget: Widget = {
          ...widgetWithoutZOrder,
          id: `${originalWidget.id}_copy_${Date.now()}`,
          position: {
            ...originalWidget.position,
            x: originalWidget.position.x + 20,
            y: originalWidget.position.y + 20
          }
        };

        get().addWidget(duplicatedWidget);
      },

      bringToFront: (widgetId) => {
        const currentTemplate = get().currentTemplate;
        if (!currentTemplate) {
          throw new Error("No template loaded");
        }

        // Find max z_order among all widgets (default to 0 if none have z_order)
        const allWidgets = currentTemplate.widgets;
        const maxZOrder = allWidgets.reduce((max, w) => {
          const z = w.z_order ?? 0;
          return z > max ? z : max;
        }, 0);

        // Set this widget's z_order to max + 1
        get().updateWidget(widgetId, { z_order: maxZOrder + 1 });
      },

      sendToBack: (widgetId) => {
        const currentTemplate = get().currentTemplate;
        if (!currentTemplate) {
          throw new Error("No template loaded");
        }

        // Find min z_order among all widgets (default to 0 if none have z_order)
        const allWidgets = currentTemplate.widgets;
        const minZOrder = allWidgets.reduce((min, w) => {
          const z = w.z_order ?? 0;
          return z < min ? z : min;
        }, 0);

        // Set this widget's z_order to min - 1
        get().updateWidget(widgetId, { z_order: minZOrder - 1 });
      },

      // Template metadata operations
      updateTemplateMetadata: (updates) => {
        const currentTemplate = get().currentTemplate;
        if (!currentTemplate) {
          throw new Error("No template loaded");
        }

        set({
          currentTemplate: {
            ...currentTemplate,
            metadata: {
              ...currentTemplate.metadata,
              ...updates
            }
          }
        });
      },

      // Canvas operations
      clearCanvas: () => {
        const currentTemplate = get().currentTemplate;
        if (!currentTemplate) {
          throw new Error("No template loaded");
        }

        set({
          currentTemplate: {
            ...currentTemplate,
            widgets: []
          },
          selectedWidget: null,
          selectedIds: []
        });
      },

      resetEditor: () => {
        set({
          selectedWidget: null,
          selectedIds: [],
          currentTemplate: createDefaultTemplate(),
          isDragging: false,
          dragInfo: null,
          showGrid: true,
          snapEnabled: true,
          zoom: 1,
          showWidgetPalette: true,
          showPagesPanel: true,
          showRightPanel: true,
          currentPage: 1,
          totalPages: 1
        });
      },

      // Masters
      addMaster: (name) => {
        const state = get();
        if (!state.currentTemplate) throw new Error('No template loaded');
        const id = `master_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const masters = [...(state.currentTemplate.masters || []), { id, name: name || 'Master', widgets: [] } as any];
        set({
          currentTemplate: {
            ...state.currentTemplate,
            masters
          }
        });
        return id;
      },
      removeMaster: (masterId) => {
        const state = get();
        if (!state.currentTemplate) throw new Error('No template loaded');
        const masters = (state.currentTemplate.masters || []).filter(m => m.id !== masterId);
        const page_assignments = (state.currentTemplate.page_assignments || []).filter(pa => pa.master_id !== masterId);
        set({
          currentTemplate: {
            ...state.currentTemplate,
            masters,
            page_assignments
          }
        });
      },
      renameMaster: (masterId, name) => {
        const state = get();
        if (!state.currentTemplate) throw new Error('No template loaded');
        const masters = (state.currentTemplate.masters || []).map(m => m.id === masterId ? { ...m, name } : m);
        set({ currentTemplate: { ...state.currentTemplate, masters } });
      },
      assignMasterToPage: (page, masterId) => {
        const state = get();
        if (!state.currentTemplate) throw new Error('No template loaded');
        let assignments = [...(state.currentTemplate.page_assignments || [])];
        // Remove existing assignment for page
        assignments = assignments.filter(pa => pa.page !== page);
        if (masterId) {
          assignments.push({ page, master_id: masterId } as any);
        }
        set({ currentTemplate: { ...state.currentTemplate, page_assignments: assignments } });
      },
      getAssignedMasterForPage: (page) => {
        const state = get();
        if (!state.currentTemplate) return null;
        const pa = (state.currentTemplate.page_assignments || []).find(pa => pa.page === page);
        return pa ? (pa as any).master_id : null;
      },
      moveWidgetToMaster: (widgetId, masterId) => {
        const state = get();
        if (!state.currentTemplate) throw new Error('No template loaded');
        const masters = (state.currentTemplate.masters || []).map((m: any) => ({ ...m }));
        const master = masters.find((m: any) => m.id === masterId);
        if (!master) throw new Error('Master not found');
        const widgets = state.currentTemplate.widgets.filter(w => w.id !== widgetId);
        const moved = state.currentTemplate.widgets.find(w => w.id === widgetId);
        if (!moved) return;
        master.widgets = [...(master.widgets || []), { ...moved }];
        set({ currentTemplate: { ...state.currentTemplate, widgets, masters } });
      },
      detachWidgetFromMasterToPage: (widgetId, page) => {
        const state = get();
        if (!state.currentTemplate) throw new Error('No template loaded');
        const masters = (state.currentTemplate.masters || []).map((m: any) => ({
          ...m,
          widgets: (m.widgets || []).filter((w: any) => w.id !== widgetId)
        }));
        // Find the widget in original masters to copy
        const original = (state.currentTemplate.masters || []).flatMap((m: any) => m.widgets || []).find((w: any) => w.id === widgetId);
        if (!original) return;
        const pageWidgets = [...state.currentTemplate.widgets, { ...original, page }];
        set({ currentTemplate: { ...state.currentTemplate, masters, widgets: pageWidgets } });
      },
      findMasterIdByWidget: (widgetId) => {
        const state = get();
        if (!state.currentTemplate) return null;
        for (const m of state.currentTemplate.masters || []) {
          if ((m as any).widgets?.some((w: any) => w.id === widgetId)) return (m as any).id;
        }
        return null;
      },

      // Alignment & distribution
      alignSelected: (mode) => {
        const state = get();
        const { currentTemplate, currentPage, selectedIds } = state as any;
        if (!currentTemplate || !selectedIds || selectedIds.length < 2) return;
        const masterIds = (currentTemplate.masters || []).flatMap((m: any) => (m.widgets || []).map((w: any) => w.id));
        const ids = selectedIds.filter((id: string) => !masterIds.includes(id));
        const widgets = currentTemplate.widgets.filter((w: any) => ids.includes(w.id) && w.page === currentPage);
        if (widgets.length < 2) return;

        // Use first selected widget as anchor (reference) - consistent with equalize
        const anchorId = ids[0];
        const anchor = widgets.find((w: any) => w.id === anchorId);
        if (!anchor) return;

        // Calculate anchor reference points
        const anchorLeft = anchor.position.x;
        const anchorRight = anchor.position.x + anchor.position.width;
        const anchorTop = anchor.position.y;
        const anchorBottom = anchor.position.y + anchor.position.height;
        const anchorCenterX = anchor.position.x + anchor.position.width / 2;
        const anchorCenterY = anchor.position.y + anchor.position.height / 2;

        const updated = currentTemplate.widgets.map((w: any) => {
          // Skip anchor widget and non-selected widgets
          if (!ids.includes(w.id) || w.page !== currentPage || w.id === anchorId) return w;
          const pos = { ...w.position };
          switch (mode) {
            case 'left': pos.x = anchorLeft; break;
            case 'right': pos.x = anchorRight - pos.width; break;
            case 'center': pos.x = anchorCenterX - pos.width / 2; break;
            case 'top': pos.y = anchorTop; break;
            case 'bottom': pos.y = anchorBottom - pos.height; break;
            case 'middle': pos.y = anchorCenterY - pos.height / 2; break;
          }
          return { ...w, position: pos };
        });
        set({ currentTemplate: { ...currentTemplate, widgets: updated } });
      },
      distributeSelected: (axis) => {
        const state = get();
        const { currentTemplate, currentPage, selectedIds } = state as any;
        if (!currentTemplate || !selectedIds || selectedIds.length < 3) return;
        const masterIds = (currentTemplate.masters || []).flatMap((m: any) => (m.widgets || []).map((w: any) => w.id));
        const ids = selectedIds.filter((id: string) => !masterIds.includes(id));
        const widgets = currentTemplate.widgets.filter((w: any) => ids.includes(w.id) && w.page === currentPage);
        if (widgets.length < 3) return;
        const sorted = widgets.slice().sort((a: any, b: any) => axis === 'horizontal' ? a.position.x - b.position.x : a.position.y - b.position.y);
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const totalSpace = axis === 'horizontal' ? (last.position.x - first.position.x) : (last.position.y - first.position.y);
        const gap = totalSpace / (sorted.length - 1);
        const mapPos: Record<string, any> = {};
        sorted.forEach((w: any, idx: number) => {
          if (w.id === first.id || w.id === last.id) return;
          const pos = { ...w.position };
          if (axis === 'horizontal') pos.x = Math.round(first.position.x + gap * idx);
          else pos.y = Math.round(first.position.y + gap * idx);
          mapPos[w.id] = pos;
        });
        const updated = currentTemplate.widgets.map((w: any) => mapPos[w.id] ? { ...w, position: mapPos[w.id] } : w);
        set({ currentTemplate: { ...currentTemplate, widgets: updated } });
      },
      equalizeSizeSelected: (mode) => {
        const state = get();
        const { currentTemplate, currentPage, selectedIds } = state as any;
        if (!currentTemplate || !selectedIds || selectedIds.length < 2) return;
        const masterIds = (currentTemplate.masters || []).flatMap((m: any) => (m.widgets || []).map((w: any) => w.id));
        const ids = selectedIds.filter((id: string) => !masterIds.includes(id));
        const widgets = currentTemplate.widgets.filter((w: any) => ids.includes(w.id) && w.page === currentPage);
        if (widgets.length < 2) return;
        const ref = widgets[0].position;
        const updated = currentTemplate.widgets.map((w: any) => {
          if (!ids.includes(w.id) || w.page !== currentPage) return w;
          const pos = { ...w.position };
          if (mode === 'width' || mode === 'both') pos.width = ref.width;
          if (mode === 'height' || mode === 'both') pos.height = ref.height;
          return { ...w, position: pos };
        });
        set({ currentTemplate: { ...currentTemplate, widgets: updated } });
      },

      // Clipboard operations
      copySelected: () => {
        const state = get() as any;
        const { currentTemplate, selectedIds, currentPage } = state;
        if (!currentTemplate || !selectedIds || selectedIds.length === 0) return;
        const copied = currentTemplate.widgets
          .filter((w: any) => selectedIds.includes(w.id))
          .map((w: any) => ({
            type: w.type,
            content: w.content,
            background_color: w.background_color,
            position: { ...w.position },
            styling: w.styling ? { ...w.styling } : undefined,
            properties: w.properties ? { ...w.properties } : undefined,
            page: currentPage,
          }));
        set({ clipboard: copied });
      },
      pasteClipboard: () => {
        const state = get() as any;
        const { currentTemplate, clipboard, currentPage } = state;
        if (!currentTemplate || !clipboard || clipboard.length === 0) return;

        const genId = () => `widget_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const OFFSET = 20;

        // Find max z_order to place pasted widgets on top
        const maxZOrder = currentTemplate.widgets.reduce((max: number, w: any) => {
          const z = w.z_order ?? 0;
          return z > max ? z : max;
        }, 0);

        const pasted = clipboard.map((w: any, index: number) => ({
          id: genId(),
          type: w.type,
          page: currentPage,
          content: w.content,
          background_color: w.background_color,
          position: {
            x: Math.max(0, (w.position?.x || 0) + OFFSET),
            y: Math.max(0, (w.position?.y || 0) + OFFSET),
            width: w.position?.width || 100,
            height: w.position?.height || 30,
          },
          styling: w.styling ? { ...w.styling } : undefined,
          properties: w.properties ? { ...w.properties } : undefined,
          z_order: maxZOrder + 1 + index, // Each pasted widget gets incrementing z_order
        }));

        set({
          currentTemplate: {
            ...currentTemplate,
            widgets: [...currentTemplate.widgets, ...pasted],
          },
          selectedWidget: pasted[0],
          selectedIds: pasted.map((w: any) => w.id),
        });
      },
    }),
    {
      name: 'editor-store',
    }
  )
);
