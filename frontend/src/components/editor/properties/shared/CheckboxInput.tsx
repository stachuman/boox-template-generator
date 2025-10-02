/**
 * Reusable checkbox input component.
 *
 * Provides consistent checkbox input across all widget property panels.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';

interface CheckboxInputProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  helpText?: string;
  disabled?: boolean;
}

const CheckboxInput: React.FC<CheckboxInputProps> = ({
  label,
  checked,
  onChange,
  helpText,
  disabled = false
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked);
  };

  return (
    <div>
      <label className="flex items-center space-x-2 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          className="form-checkbox h-4 w-4 text-eink-blue border-eink-pale-gray rounded focus:ring-eink-blue disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span className="text-sm font-medium">{label}</span>
      </label>
      {helpText && (
        <p className="text-xs text-eink-light-gray mt-1 ml-6">{helpText}</p>
      )}
    </div>
  );
};

export default CheckboxInput;