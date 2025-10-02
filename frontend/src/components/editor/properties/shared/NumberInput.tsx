/**
 * Reusable number input component with validation.
 *
 * Provides consistent number input across all widget property panels.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';

interface NumberInputProps {
  label: string;
  value: number | undefined;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  helpText?: string;
  disabled?: boolean;
  unit?: string;
}

const NumberInput: React.FC<NumberInputProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder,
  helpText,
  disabled = false,
  unit
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numValue = parseFloat(e.target.value);
    if (!isNaN(numValue)) {
      onChange(numValue);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        {label}
        {unit && <span className="text-xs text-eink-gray ml-1">({unit})</span>}
      </label>
      <input
        type="number"
        value={value !== undefined ? value : ''}
        onChange={handleChange}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 border border-eink-pale-gray rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-eink-blue disabled:bg-eink-off-white disabled:cursor-not-allowed"
      />
      {helpText && (
        <p className="text-xs text-eink-light-gray mt-1">{helpText}</p>
      )}
    </div>
  );
};

export default NumberInput;