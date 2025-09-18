import React, { useEffect, useRef } from 'react';

type MenuItem = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-50 bg-white border border-eink-pale-gray rounded shadow-md py-1 text-sm"
      style={{ left: x, top: y, minWidth: 160 }}
      role="menu"
    >
      {items.map((item, idx) => (
        <button
          key={idx}
          className={`w-full text-left px-3 py-1.5 hover:bg-eink-pale-gray ${item.disabled ? 'text-eink-light-gray cursor-not-allowed' : ''}`}
          onClick={() => {
            if (!item.disabled) {
              item.onClick();
              onClose();
            }
          }}
          disabled={item.disabled}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};

export default ContextMenu;

