import React, { useState } from 'react';
import { clsx } from 'clsx';

interface CollapsibleProps {
  children: React.ReactNode;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const Collapsible: React.FC<CollapsibleProps> = ({
  children,
  className,
  open: controlledOpen,
  onOpenChange
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = (newOpen: boolean) => {
    if (isControlled) {
      onOpenChange?.(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
  };

  return (
    <div className={clsx("space-y-2", className)}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          if (child.type === CollapsibleTrigger) {
            return React.cloneElement(child, { open, setOpen });
          }
          if (child.type === CollapsibleContent) {
            return React.cloneElement(child, { open });
          }
        }
        return child;
      })}
    </div>
  );
};

interface CollapsibleTriggerProps {
  children: React.ReactNode;
  className?: string;
  open?: boolean;
  setOpen?: (open: boolean) => void;
}

export const CollapsibleTrigger: React.FC<CollapsibleTriggerProps> = ({
  children,
  className,
  open,
  setOpen
}) => {
  return (
    <button
      type="button"
      className={clsx(
        "w-full text-left focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        className
      )}
      onClick={() => setOpen?.(!open)}
    >
      {children}
    </button>
  );
};

interface CollapsibleContentProps {
  children: React.ReactNode;
  className?: string;
  open?: boolean;
}

export const CollapsibleContent: React.FC<CollapsibleContentProps> = ({
  children,
  className,
  open
}) => {
  if (!open) return null;

  return (
    <div className={clsx("overflow-hidden", className)}>
      {children}
    </div>
  );
};