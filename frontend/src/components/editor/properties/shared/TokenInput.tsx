/**
 * Token input component with autocomplete and validation.
 * Following CLAUDE.md Rule #3: Explicit validation with meaningful errors.
 */

import React, { useState, useRef, useEffect } from 'react';
import { TokenRegistry, TokenInfo } from '@/services/tokenRegistry';
import { AlertCircle, Info, ChevronDown } from 'lucide-react';

interface TokenInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  helpText?: string;
  availableTokens: TokenInfo[];
  showAutocomplete?: boolean;
}

const TokenInput: React.FC<TokenInputProps> = ({
  label,
  value,
  onChange,
  placeholder,
  helpText,
  availableTokens,
  showAutocomplete = true
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [validation, setValidation] = useState<ReturnType<typeof TokenRegistry.validateToken>>({ valid: true });
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Validate on value change
  useEffect(() => {
    if (value) {
      const result = TokenRegistry.validateToken(value, availableTokens);
      setValidation(result);
    } else {
      setValidation({ valid: true });
    }
  }, [value, availableTokens]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInsertToken = (tokenName: string) => {
    const cursorPos = inputRef.current?.selectionStart || value.length;
    const before = value.substring(0, cursorPos);
    const after = value.substring(cursorPos);
    const newValue = `${before}{${tokenName}}${after}`;
    onChange(newValue);
    setShowDropdown(false);

    // Restore focus
    setTimeout(() => {
      inputRef.current?.focus();
      const newCursorPos = cursorPos + tokenName.length + 2;
      inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Group tokens by category
  const tokensByCategory = availableTokens.reduce((acc, token) => {
    if (!acc[token.category]) acc[token.category] = [];
    acc[token.category].push(token);
    return acc;
  }, {} as Record<string, TokenInfo[]>);

  const categoryOrder: TokenInfo['category'][] = ['date', 'counter', 'navigation', 'rendering', 'custom'];

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium">{label}</label>
        {showAutocomplete && (
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            Insert Token <ChevronDown size={12} />
          </button>
        )}
      </div>

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 ${
            !validation.valid
              ? 'border-red-300 focus:ring-red-500'
              : validation.warning
              ? 'border-amber-300 focus:ring-amber-500'
              : 'border-eink-pale-gray focus:ring-eink-blue'
          }`}
        />

        {/* Autocomplete Dropdown */}
        {showDropdown && showAutocomplete && (
          <div
            ref={dropdownRef}
            className="absolute z-50 mt-1 w-full max-h-96 overflow-y-auto bg-white border border-gray-300 rounded-md shadow-lg"
          >
            {categoryOrder.map(category => {
              const tokens = tokensByCategory[category];
              if (!tokens || tokens.length === 0) return null;

              return (
                <div key={category} className="border-b border-gray-200 last:border-b-0">
                  <div className="px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-600 uppercase sticky top-0">
                    {category}
                  </div>
                  {tokens.map(token => (
                    <button
                      key={token.name}
                      type="button"
                      onClick={() => handleInsertToken(token.name)}
                      className="w-full px-3 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <code className={`px-1.5 py-0.5 rounded text-xs font-mono ${TokenRegistry.getCategoryColor(token.category)}`}>
                              {'{' + token.name + '}'}
                            </code>
                            {token.hasNavigation && (
                              <span className="text-xs text-green-600">+nav</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">{token.description}</div>
                          {token.boundaryBehavior && (
                            <div className="text-xs text-amber-600 mt-1 flex items-start gap-1">
                              <Info size={12} className="mt-0.5 flex-shrink-0" />
                              <span>{token.boundaryBehavior}</span>
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 font-mono">{token.example}</div>
                      </div>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Validation Error */}
      {!validation.valid && validation.error && (
        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div>{validation.error}</div>
            {validation.suggestion && (
              <div className="mt-1 text-xs">
                Did you mean{' '}
                <button
                  type="button"
                  onClick={() => {
                    const tokenPattern = /\{([a-zA-Z_][a-zA-Z0-9_-]*)(:[^}]+)?\}/g;
                    const newValue = value.replace(tokenPattern, `{${validation.suggestion!.name}}`);
                    onChange(newValue);
                  }}
                  className="underline hover:text-red-700"
                >
                  {'{' + validation.suggestion.name + '}'}
                </button>
                ?
              </div>
            )}
          </div>
        </div>
      )}

      {/* Validation Warning */}
      {validation.valid && validation.warning && (
        <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
          <Info size={16} className="flex-shrink-0 mt-0.5" />
          <span>{validation.warning}</span>
        </div>
      )}

      {/* Help Text */}
      {helpText && !validation.error && !validation.warning && (
        <p className="text-xs text-eink-light-gray">{helpText}</p>
      )}
    </div>
  );
};

export default TokenInput;
