/**
 * Zustand store for managing editor state.
 * 
 * Centralized state management for the template editor.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Widget, DeviceProfile, Template, EditorState } from '@/types';

// Utility function to convert page size to dimensions in points
const getPageDimensions = (pageSize: string, orientation: string = 'portrait'): { width: number; height: number } => {
  // Standard page sizes in points (72 points = 1 inch)
  const sizes: Record<string, { width: number; height: number }> = {
    'A4': { width: 595.2, height: 841.8 },
    'A3': { width: 841.8, height: 1190.6 },
    'A5': { width: 420.9, height: 595.2 },
    'Letter': { width: 612, height: 792 },
    'Legal': { width: 612, height: 1008 },
    'Tabloid': { width: 792, height: 1224 }
  };
  
  const size = sizes[pageSize] || sizes['A4']; // Default to A4
  
  // Swap width and height for landscape orientation
  if (orientation === 'landscape') {
    return { width: size.height, height: size.width };
  }
  
  return size;
};

interface EditorStore extends EditorState {
  // Actions
  setSelectedWidget: (widget: Widget | null) => void;
  setActiveProfile: (profile: DeviceProfile | null) => void;
  setCurrentTemplate: (template: Template | null) => void;
  setIsDragging: (isDragging: boolean) => void;
  setShowGrid: (showGrid: boolean) => void;
  setSnapEnabled: (snapEnabled: boolean) => void;
  setZoom: (zoom: number) => void;
  
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
  navigation: {
    named_destinations: [],
    outlines: []
  },
  export: {
    default_mode: "interactive"
  }
});

export const useEditorStore = create<EditorStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      selectedWidget: null,
      activeProfile: null,
      currentTemplate: createDefaultTemplate(),
      isDragging: false,
      showGrid: true,
      snapEnabled: true,
      zoom: 1,
      currentPage: 1,
      totalPages: 1,

      // Basic setters
      setSelectedWidget: (widget) => set({ selectedWidget: widget }),
      setActiveProfile: (profile) => {
        set({ activeProfile: profile });
        
        // Update template profile and canvas dimensions if a template is loaded
        const currentTemplate = get().currentTemplate;
        if (currentTemplate && profile) {
          // Get new canvas dimensions based on profile's PDF settings
          const newDimensions = getPageDimensions(
            profile.pdf_settings.page_size,
            profile.pdf_settings.orientation
          );
          
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
      setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
      setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(3, zoom)) }),

      // Multi-page operations
      setCurrentPage: (page) => {
        const { totalPages } = get();
        const clampedPage = Math.max(1, Math.min(totalPages, page));
        set({ 
          currentPage: clampedPage,
          selectedWidget: null // Deselect widget when changing pages
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
            selectedWidget: null
          });
        } else {
          set({
            totalPages: totalPages - 1,
            currentPage: currentPage > pageNumber ? currentPage - 1 : 
                        currentPage === pageNumber ? Math.min(currentPage, totalPages - 1) : currentPage,
            selectedWidget: null
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
            selectedWidget: null
          });
        } else {
          set({
            totalPages: totalPages + 1,
            currentPage: totalPages + 1,
            selectedWidget: null
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
            selectedWidget: null
          });
        } else {
          set({
            totalPages: totalPages + count,
            currentPage: totalPages + 1,
            selectedWidget: null
          });
        }
      },

      getWidgetsForCurrentPage: () => {
        const { currentTemplate, currentPage } = get();
        if (!currentTemplate) return [];
        return currentTemplate.widgets.filter(widget => widget.page === currentPage);
      },

      getWidgetsForPage: (pageNumber: number) => {
        const { currentTemplate, totalPages } = get();
        if (!currentTemplate) return [];
        if (pageNumber < 1 || pageNumber > totalPages) return [];
        return currentTemplate.widgets.filter(widget => widget.page === pageNumber);
      },

      // Widget manipulation
      addWidget: (widget) => {
        const { currentTemplate, currentPage } = get();
        if (!currentTemplate) {
          throw new Error("No template loaded");
        }

        // Assign widget to current page
        const widgetWithPage = {
          ...widget,
          page: currentPage
        };

        set({
          currentTemplate: {
            ...currentTemplate,
            widgets: [...currentTemplate.widgets, widgetWithPage]
          },
          selectedWidget: widgetWithPage
        });
      },

      updateWidget: (widgetId, updates) => {
        const currentTemplate = get().currentTemplate;
        if (!currentTemplate) {
          throw new Error("No template loaded");
        }

        const updatedWidgets = currentTemplate.widgets.map(widget => {
          if (widget.id !== widgetId) {
            return widget;
          }
          
          // Deep merge nested objects
          const updatedWidget = {
            ...widget,
            ...updates,
            // Ensure nested objects are properly merged
            position: updates.position ? { ...widget.position, ...updates.position } : widget.position,
            styling: updates.styling ? { ...widget.styling, ...updates.styling } : widget.styling,
            properties: updates.properties ? { ...widget.properties, ...updates.properties } : widget.properties
          };
          
          return updatedWidget;
        });

        const updatedWidget = updatedWidgets.find(w => w.id === widgetId);

        set({
          currentTemplate: {
            ...currentTemplate,
            widgets: updatedWidgets
          },
          selectedWidget: updatedWidget || get().selectedWidget
        });
      },

      removeWidget: (widgetId) => {
        const currentTemplate = get().currentTemplate;
        if (!currentTemplate) {
          throw new Error("No template loaded");
        }

        const filteredWidgets = currentTemplate.widgets.filter(w => w.id !== widgetId);
        
        set({
          currentTemplate: {
            ...currentTemplate,
            widgets: filteredWidgets
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
          selectedWidget: null
        });
      },

      resetEditor: () => {
        set({
          selectedWidget: null,
          currentTemplate: createDefaultTemplate(),
          isDragging: false,
          showGrid: true,
          snapEnabled: true,
          zoom: 1,
          currentPage: 1,
          totalPages: 1
        });
      }
    }),
    {
      name: 'editor-store',
    }
  )
);