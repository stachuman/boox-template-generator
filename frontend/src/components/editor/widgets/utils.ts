/**
 * Utility functions for widget rendering.
 *
 * Shared helper functions used across different widget components.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import { resolveFontFamily as resolveFont } from '@/lib/fonts';

/**
 * Resolves font family name to CSS font family string
 * @deprecated Use getFontCSS from @/lib/fonts for complete font styling
 */
export const resolveFontFamily = (name?: string): string => {
  return resolveFont(name);
};

/**
 * Maps text alignment to CSS justify-content value
 */
export const mapJustify = (align?: string): string => {
  switch ((align || 'left').toLowerCase()) {
    case 'center':
      return 'center';
    case 'right':
      return 'flex-end';
    default:
      return 'flex-start';
  }
};

/**
 * Converts hex color to RGBA with opacity
 */
export const hexToRgba = (hex: string, alpha: number): string => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#000000');
  const r = m ? parseInt(m[1], 16) : 0;
  const g = m ? parseInt(m[2], 16) : 0;
  const b = m ? parseInt(m[3], 16) : 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};