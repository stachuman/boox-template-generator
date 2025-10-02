/**
 * Enhanced font selector component with family + style selection.
 *
 * Provides family/variant selection with dynamic font loading from backend.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React, { useState, useEffect } from 'react';
import { APIClient } from '@/services/api';
import { parseFontName, formatFontDisplayName } from '@/lib/fonts';

interface FontSelectorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  fontOptions?: string[]; // Legacy support - will be ignored
  disabled?: boolean;
}

const FontSelector: React.FC<FontSelectorProps> = ({
  label,
  value,
  onChange,
  disabled = false
}) => {
  const [fontFamilies, setFontFamilies] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Parse current value
  const { family: currentFamily, variant: currentVariant } = parseFontName(value || 'Helvetica');

  useEffect(() => {
    const loadFontFamilies = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const families = await APIClient.getFontFamilies();
        setFontFamilies(families);
      } catch (err) {
        console.error('Failed to load font families:', err);
        setError('Failed to load fonts');
        // Fallback to base fonts
        setFontFamilies({
          'Helvetica': ['Regular', 'Bold', 'Oblique', 'Bold Oblique'],
          'Times': ['Roman', 'Bold', 'Italic', 'Bold Italic'],
          'Courier': ['Regular', 'Bold', 'Oblique', 'Bold Oblique']
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadFontFamilies();
  }, []);

  const handleFamilyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newFamily = e.target.value;
    const availableVariants = fontFamilies[newFamily] || ['Regular'];
    // Sort variants with Regular first to ensure it's the default
    const sortedVariants = availableVariants.sort((a, b) => {
      if (a === 'Regular') return -1;
      if (b === 'Regular') return 1;
      return a.localeCompare(b);
    });
    // Default to Regular if available, otherwise first variant
    const newVariant = availableVariants.includes('Regular') ? 'Regular' : sortedVariants[0];
    const newDisplayName = formatFontDisplayName(newFamily, newVariant);
    onChange(newDisplayName);
  };

  const handleVariantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVariant = e.target.value;
    const newDisplayName = formatFontDisplayName(currentFamily, newVariant);
    onChange(newDisplayName);
  };

  if (isLoading) {
    return (
      <div>
        <label className="block text-sm font-medium mb-1">
          {label}
        </label>
        <div className="w-full px-3 py-2 border border-eink-pale-gray rounded-md text-sm bg-eink-off-white text-eink-gray">
          Loading fonts...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <label className="block text-sm font-medium mb-1">
          {label}
        </label>
        <div className="w-full px-3 py-2 border border-red-300 rounded-md text-sm bg-red-50 text-red-600">
          {error}
        </div>
      </div>
    );
  }

  const familyNames = Object.keys(fontFamilies).sort();
  // Sort variants with Regular first, then alphabetically
  const currentVariants = (fontFamilies[currentFamily] || ['Regular']).sort((a, b) => {
    if (a === 'Regular') return -1;
    if (b === 'Regular') return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">
        {label}
      </label>

      {/* Font Family Selection */}
      <div>
        {/* <label className="block text-xs text-eink-gray mb-1">Family</label> */}
        <select
          value={currentFamily}
          onChange={handleFamilyChange}
          disabled={disabled}
          className="w-full px-3 py-2 border border-eink-pale-gray rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-eink-blue disabled:bg-eink-off-white disabled:cursor-not-allowed"
        >
          {familyNames.map(family => (
            <option key={family} value={family}>
              {family}
            </option>
          ))}
        </select>
      </div>

      {/* Font Variant Selection and Preview in a grid */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          {/* <label className="block text-xs text-eink-gray mb-1">Style</label> */}
          <select
            value={currentVariant}
            onChange={handleVariantChange}
            disabled={disabled || currentVariants.length <= 1}
            className="w-full px-3 py-2 border border-eink-pale-gray rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-eink-blue disabled:bg-eink-off-white disabled:cursor-not-allowed"
          >
            {currentVariants.map(variant => (
              <option key={variant} value={variant}>
                {variant}
              </option>
            ))}
          </select>
        </div>

        {/* Font Preview */}
        <div>
          {/* <label className="block text-xs text-eink-gray mb-1">Preview</label> */}
          <div className="h-10 px-2 bg-eink-off-white rounded border text-xs flex items-center" style={{
            fontFamily: `'${currentFamily}', Arial, sans-serif`,
            fontWeight: currentVariant.includes('Bold') ? 'bold' : 'normal',
            fontStyle: currentVariant.includes('Italic') || currentVariant.includes('Oblique') ? 'italic' : 'normal'
          }}>
            Sample Text
          </div>
        </div>
      </div>
    </div>
  );
};

export default FontSelector;