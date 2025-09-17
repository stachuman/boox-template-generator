/**
 * Main canvas component for template editing.
 * 
 * Provides the visual editing area where widgets can be placed and manipulated.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React, { useRef, useCallback } from 'react';
import { useDrop } from 'react-dnd';
import { useEditorStore } from '@/stores/editorStore';
import { Widget, DragItem } from '@/types';
import CanvasWidget from './CanvasWidget';
import GridOverlay from './GridOverlay';

const Canvas: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  
  const {
    currentTemplate,
    selectedWidget,
    showGrid,
    snapEnabled,
    zoom,
    addWidget,
    updateWidget,
    setSelectedWidget,
    getWidgetsForCurrentPage,
  } = useEditorStore();

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

  const [{ isOver, canDrop }, drop] = useDrop({
    accept: 'WIDGET',
    drop: (item: DragItem, monitor) => {
      if (!currentTemplate) return;

      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;

      const canvasPosition = getCanvasPosition(clientOffset.x, clientOffset.y);

      if (item.isNew && item.widgetType) {
        // Create new widget from palette
        const newWidget: Widget = {
          id: generateWidgetId(),
          type: item.widgetType as Widget['type'],
          page: 1,
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

        addWidget(newWidget);
      } else if (!item.isNew && item.widget) {
        // Move existing widget using delta movement for smooth repositioning
        const offset = monitor.getDifferenceFromInitialOffset();
        if (offset) {
          const updatedPosition = {
            ...item.widget.position,
            x: snapToGrid(item.widget.position.x + offset.x / zoom),
            y: snapToGrid(item.widget.position.y + offset.y / zoom)
          };
          updateWidget(item.widget.id, { position: updatedPosition });
        } else {
          // Fallback to drop position
          const updatedPosition = {
            ...item.widget.position,
            x: canvasPosition.x,
            y: canvasPosition.y
          };
          updateWidget(item.widget.id, { position: updatedPosition });
        }
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop()
    })
  });

  const handleCanvasClick = useCallback((event: React.MouseEvent) => {
    // Only deselect if clicking directly on canvas (not on a widget)
    if (event.target === event.currentTarget) {
      setSelectedWidget(null);
    }
  }, [setSelectedWidget]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Delete' && selectedWidget) {
      // TODO: Implement widget deletion
      console.log('Delete widget:', selectedWidget.id);
    }
  }, [selectedWidget]);

  if (!currentTemplate) {
    return (
      <div className="h-full flex items-center justify-center text-eink-gray">
        <p>No template loaded</p>
      </div>
    );
  }

  const canvasWidth = currentTemplate.canvas.dimensions.width;
  const canvasHeight = currentTemplate.canvas.dimensions.height;

  return (
    <div 
      className="relative flex items-center justify-center min-h-full"
      onClick={handleCanvasClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Canvas */}
      <div
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
          transformOrigin: 'center',
        }}
      >
        {/* Grid Overlay */}
        {showGrid && <GridOverlay />}

        {/* Drop Indicator */}
        {isOver && canDrop && (
          <div className="absolute inset-0 bg-blue-100 bg-opacity-20 border-2 border-blue-300 border-dashed" />
        )}

        {/* Widgets */}
        {getWidgetsForCurrentPage().map((widget) => (
          <CanvasWidget
            key={widget.id}
            widget={widget}
            isSelected={selectedWidget?.id === widget.id}
            onSelect={setSelectedWidget}
            zoom={zoom}
          />
        ))}
      </div>

      {/* Canvas Info */}
      <div className="absolute bottom-4 right-4 bg-white bg-opacity-90 px-3 py-2 rounded shadow text-xs text-eink-gray">
        {canvasWidth} × {canvasHeight} pt ({Math.round(zoom * 100)}%)
      </div>
    </div>
  );
};

export default Canvas;