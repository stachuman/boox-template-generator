/**
 * Individual widget component on the canvas.
 *
 * Renders a widget with selection handles and drag behavior.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDrag } from 'react-dnd';
import clsx from 'clsx';
import { Widget } from '@/types';
import { getWidgetComponent } from './widgets';
import { useEditorStore } from '@/stores/editorStore';

interface CanvasWidgetProps {
  widget: Widget;
  isSelected: boolean;
  onSelect: (widget: Widget, additive?: boolean) => void;
  zoom: number;
  onContextMenu?: (e: React.MouseEvent, widget: Widget) => void;
}

const CanvasWidget: React.FC<CanvasWidgetProps> = ({
  widget,
  isSelected,
  onSelect,
  zoom,
  onContextMenu
}) => {
  const { updateWidget } = useEditorStore() as any;
  const snapEnabled = false; // TODO: get from settings
  const gridSize = 10; // TODO: get from settings

  const resizeEdgeRef = useRef<string | null>(null);
  const startRef = useRef<any>(null);

  const [{ isDragging }, drag] = useDrag({
    type: 'WIDGET',
    item: () => {
      return {
        type: 'WIDGET',
        widget,
        isNew: false
      };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  });

  // Handle click for selection
  const handleWidgetClick = useCallback((event: React.MouseEvent) => {
    if (!isDragging) {
      event.stopPropagation();
      onSelect(widget, event.shiftKey || event.metaKey || event.ctrlKey);
    }
  }, [widget, onSelect, isDragging]);

  const snap = (v: number) => {
    if (!snapEnabled) return v;
    return Math.round(v / gridSize) * gridSize;
  };

  const onHandleMouseDown = (edge: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    resizeEdgeRef.current = edge;
    startRef.current = {
      x: widget.position.x,
      y: widget.position.y,
      width: widget.position.width,
      height: widget.position.height,
      mouseX: e.clientX,
      mouseY: e.clientY,
    };
    // Add listeners
    window.addEventListener('mousemove', onMouseMove as any);
    window.addEventListener('mouseup', onMouseUp as any, { once: true });
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!resizeEdgeRef.current || !startRef.current) return;
    const dx = (e.clientX - startRef.current.mouseX) / zoom;
    const dy = (e.clientY - startRef.current.mouseY) / zoom;
    const edge = resizeEdgeRef.current;
    const { x, y, width, height } = startRef.current;
    let newX = x, newY = y, newW = width, newH = height;
    // Resize logic
    if (edge.includes('e')) newW = Math.max(1, width + dx);
    if (edge.includes('s')) newH = Math.max(1, height + dy);
    if (edge.includes('w')) {
      newW = Math.max(1, width - dx);
      newX = x + dx;
    }
    if (edge.includes('n')) {
      newH = Math.max(1, height - dy);
      newY = y + dy;
    }
    // Snap
    newX = snap(newX);
    newY = snap(newY);
    newW = Math.max(1, snap(newW));
    newH = Math.max(1, snap(newH));
    updateWidget(widget.id, { position: { x: newX, y: newY, width: newW, height: newH } });
  };

  const onMouseUp = (_e: MouseEvent) => {
    resizeEdgeRef.current = null;
    window.removeEventListener('mousemove', onMouseMove as any);
  };

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', onMouseMove as any);
    };
  }, []);

  const renderWidgetContent = () => {
    // Use the widget component registry
    const WidgetComponent = getWidgetComponent(widget.type);

    if (WidgetComponent) {
      return <WidgetComponent widget={widget} />;
    }

    // Fallback for unknown widget types
    return (
      <div className="h-full flex items-center justify-center text-eink-light-gray">
        Unknown widget: {widget.type}
      </div>
    );
  };

  return (
    <div
      className={clsx(
        'absolute cursor-move select-none pointer-events-auto',
        isDragging && 'opacity-50',
        isSelected && 'ring-2 ring-blue-500 ring-offset-1'
      )}
      style={{
        left: widget.position.x,
        top: widget.position.y,
        width: widget.position.width,
        height: widget.position.height,
      }}
      onClick={handleWidgetClick}
      onContextMenu={(e) => {
        if (onContextMenu) {
          e.stopPropagation();
          e.preventDefault();
          onContextMenu(e, widget);
        }
      }}
    >
      {/* Widget content */}
      <div className="w-full h-full">
        {/* Drag handle is the content layer only */}
        <div ref={drag} className="absolute inset-0">
          {renderWidgetContent()}
        </div>

        {/* Selection Handles */}
        {isSelected && (
          <>
            {/* Corner handles */}
            <div onMouseDown={onHandleMouseDown('nw')} className="absolute -top-1 -left-1 w-2 h-2 bg-blue-500 border border-white cursor-nwse-resize z-10" />
            <div onMouseDown={onHandleMouseDown('ne')} className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 border border-white cursor-nesw-resize z-10" />
            <div onMouseDown={onHandleMouseDown('sw')} className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-500 border border-white cursor-nesw-resize z-10" />
            <div onMouseDown={onHandleMouseDown('se')} className="absolute -bottom-1 -right-1 w-2 h-2 bg-blue-500 border border-white cursor-nwse-resize z-10" />

            {/* Edge handles */}
            <div onMouseDown={onHandleMouseDown('n')} className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-blue-500 border border-white cursor-n-resize z-10" />
            <div onMouseDown={onHandleMouseDown('s')} className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-blue-500 border border-white cursor-s-resize z-10" />
            <div onMouseDown={onHandleMouseDown('w')} className="absolute -left-1 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-blue-500 border border-white cursor-w-resize z-10" />
            <div onMouseDown={onHandleMouseDown('e')} className="absolute -right-1 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-blue-500 border border-white cursor-e-resize z-10" />
          </>
        )}
      </div>
    </div>
  );
};

export default CanvasWidget;