/**
 * Reusable color picker component for widget properties.
 *
 * Provides consistent color input across all widget property panels.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  defaultValue?: string;
  helpText?: string;
  disabled?: boolean;
}

const ColorPicker: React.FC<ColorPickerProps> = ({
  label,
  value,
  onChange,
  defaultValue = '#000000',
  helpText,
  disabled = false
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        {label}
      </label>
      <input
        type="color"
        value={value || defaultValue}
        onChange={handleChange}
        disabled={disabled}
        className="w-full h-9 border border-eink-pale-gray rounded cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
      />
      {helpText && (
        <p className="text-xs text-eink-light-gray mt-1">{helpText}</p>
      )}
    </div>
  );
};

export default ColorPicker;