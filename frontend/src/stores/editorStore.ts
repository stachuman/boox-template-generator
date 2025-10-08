/**
 * Zustand store for managing editor state.
 * 
 * Centralized state management for the template editor.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Widget, DeviceProfile, Template, EditorState } from '@/types';

// Utility function to derive canvas size from a device profile.
// Matches backend logic by converting screen pixels to points (px/ppi → pt)
// and respecting orientation overrides.
const getPageDimensions = (profile: DeviceProfile): { width: number; height: number } => {
  const standardSizes: Record<string, { width: number; height: number }> = {
    A4: { width: 595.2, height: 841.8 },
    A3: { width: 841.8, height: 1190.6 },
    A5: { width: 420.9, height: 595.2 },
    Letter: { width: 612, height: 792 },
    Legal: { width: 612, height: 1008 },
    Tabloid: { width: 792, height: 1224 },
  };

  const { pdf_settings: pdfSettings, display } = profile;
  const orientation = pdfSettings?.orientation ?? 'portrait';
  const pageSize = pdfSettings?.page_size;

  const rotate = <T extends { width: number; height: number }>(size: T): T => {
    if (orientation === 'landscape') {
      return { width: size.height, height: size.width } as T;
    }
    return size;
  };

  if (pageSize && standardSizes[pageSize]) {
    return rotate(standardSizes[pageSize]);
  }

  if (!display?.screen_size || !display?.ppi) {
    console.warn(
      'Device profile missing display metadata; falling back to A4 dimensions.',
      profile.name,
    );
    return rotate(standardSizes.A4);
  }

  const [screenWidthPx, screenHeightPx] = display.screen_size;
  const ppi = display.ppi;

  if (!screenWidthPx || !screenHeightPx || !ppi) {
    return rotate(standardSizes.A4);
  }

  const pxToPoints = (value: number) => (value / ppi) * 72;
  let widthPt = pxToPoints(screenWidthPx);
  let heightPt = pxToPoints(screenHeightPx);

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

interface EditorStore extends EditorState {
  // Actions
  setSelectedWidget: (widget: Widget | null) => void;
  toggleSelectWidget: (widgetId: string) => void;
  clearSelection: () => void;
  setActiveProfile: (profile: DeviceProfile | null) => void;
  setCurrentTemplate: (template: Template | null) => void;
  setIsDragging: (isDragging: boolean) => void;
  setShowGrid: (showGrid: boolean) => void;
  setSnapEnabled: (snapEnabled: boolean) => void;
  setZoom: (zoom: number) => void;
  // Wheel behavior
  wheelMode: 'scroll' | 'zoom';
  setWheelMode: (mode: 'scroll' | 'zoom') => void;
  canvasContainerSize: { width: number; height: number } | null;
  setCanvasContainerSize: (size: { width: number; height: number }) => void;
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

const createDefaultTemplate = (): Template => ({
  schema_version: "1.0",
  metadata: {
    name: "New Template",
    description: "",
    category: "general",
    version: "1.0",
    author: "",
    created: new Date().toISOString(),
    profile: ""
  },
  canvas: {
    dimensions: {
      width: 595.2,  // A4 width
      height: 841.8, // A4 height
      margins: [72, 72, 72, 72] // 1 inch margins
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
      showGrid: true,
      snapEnabled: true,
      zoom: 1,
      wheelMode: 'scroll',
      canvasContainerSize: null,
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
          // Get new canvas dimensions based on profile's PDF settings
          const newDimensions = getPageDimensions(profile);
          
          // Convert safe margins from profile (if available)
          const margins = profile.pdf_settings.safe_margins || [72, 72, 72, 72];
          
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
        }
      },
      setCurrentTemplate: (template) => set({ currentTemplate: template }),
      setIsDragging: (isDragging) => set({ isDragging }),
      setShowGrid: (showGrid) => set({ showGrid }),
      setShowWidgetPalette: (show) => set({ showWidgetPalette: show }),
      setShowPagesPanel: (show) => set({ showPagesPanel: show }),
      setShowRightPanel: (show) => set({ showRightPanel: show }),
      setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
      setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(3, zoom)) }),
      setWheelMode: (mode) => set({ wheelMode: mode }),
      setCanvasContainerSize: (size) => set({ canvasContainerSize: size }),

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
          const adjustedWidgets = filteredWidgets.map(w => ({
            ...w,
            page: w.page > pageNumber ? w.page - 1 : w.page
          }));

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

        // Only assign page if not already specified (for master templates, leave undefined)
        const widgetWithPage = {
          ...widget,
          ...(widget.page === undefined ? { page: currentPage } : {})
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
        const duplicatedWidget: Widget = {
          ...originalWidget,
          id: `${originalWidget.id}_copy_${Date.now()}`,
          position: {
            ...originalWidget.position,
            x: originalWidget.position.x + 20,
            y: originalWidget.position.y + 20
          }
        };

        get().addWidget(duplicatedWidget);
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
        const left = Math.min(...widgets.map((w: any) => w.position.x));
        const right = Math.max(...widgets.map((w: any) => w.position.x + w.position.width));
        const top = Math.min(...widgets.map((w: any) => w.position.y));
        const bottom = Math.max(...widgets.map((w: any) => w.position.y + w.position.height));
        const centerX = (left + right) / 2;
        const centerY = (top + bottom) / 2;
        const updated = currentTemplate.widgets.map((w: any) => {
          if (!ids.includes(w.id) || w.page !== currentPage) return w;
          const pos = { ...w.position };
          switch (mode) {
            case 'left': pos.x = left; break;
            case 'right': pos.x = right - pos.width; break;
            case 'center': pos.x = centerX - pos.width / 2; break;
            case 'top': pos.y = top; break;
            case 'bottom': pos.y = bottom - pos.height; break;
            case 'middle': pos.y = centerY - pos.height / 2; break;
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

        const pasted = clipboard.map((w: any) => ({
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
