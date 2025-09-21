import React, { useState } from 'react';
import { clsx } from 'clsx';
import { ChevronDown } from 'lucide-react';

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  children: React.ReactNode;
  className?: string;
}

export const Select: React.FC<SelectProps> = ({
  value,
  onValueChange,
  placeholder,
  children,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (newValue: string) => {
    onValueChange?.(newValue);
    setIsOpen(false);
  };

  return (
    <div className={clsx("relative", className)}>
      <SelectTrigger
        onClick={() => setIsOpen(!isOpen)}
        className={className}
      >
        <SelectValue placeholder={placeholder}>
          {value || placeholder}
        </SelectValue>
      </SelectTrigger>
      {isOpen && (
        <SelectContent onSelect={handleSelect}>
          {children}
        </SelectContent>
      )}
    </div>
  );
};

interface SelectTriggerProps {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

export const SelectTrigger: React.FC<SelectTriggerProps> = ({
  className,
  children,
  onClick
}) => {
  return (
    <button
      type="button"
      className={clsx(
        "flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      onClick={onClick}
    >
      {children}
      <ChevronDown className="h-4 w-4 opacity-50" />
    </button>
  );
};

interface SelectValueProps {
  placeholder?: string;
  children?: React.ReactNode;
}

export const SelectValue: React.FC<SelectValueProps> = ({ children }) => {
  return <span>{children}</span>;
};

interface SelectContentProps {
  children: React.ReactNode;
  onSelect: (value: string) => void;
}

export const SelectContent: React.FC<SelectContentProps> = ({ children, onSelect }) => {
  return (
    <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-md border border-gray-300 bg-white shadow-lg">
      <div className="p-1">
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, { onSelect });
          }
          return child;
        })}
      </div>
    </div>
  );
};

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
  onSelect?: (value: string) => void;
}

export const SelectItem: React.FC<SelectItemProps> = ({ value, children, onSelect }) => {
  return (
    <button
      type="button"
      className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-100 rounded-sm"
      onClick={() => onSelect?.(value)}
    >
      {children}
    </button>
  );
};