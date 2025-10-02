/**
 * Reusable select input component.
 *
 * Provides consistent dropdown selection across all widget property panels.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  helpText?: string;
  disabled?: boolean;
}

const SelectInput: React.FC<SelectInputProps> = ({
  label,
  value,
  onChange,
  options,
  helpText,
  disabled = false
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  };

  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={handleChange}
        disabled={disabled}
        className="w-full px-3 py-2 border border-eink-pale-gray rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-eink-blue disabled:bg-eink-off-white disabled:cursor-not-allowed"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {helpText && (
        <p className="text-xs text-eink-light-gray mt-1">{helpText}</p>
      )}
    </div>
  );
};

export default SelectInput;