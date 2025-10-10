/**
 * Font management utilities for frontend rendering.
 *
 * Handles font family and variant resolution for CSS and backend compatibility.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

// Font families that require specific CSS declarations
const KNOWN_FONT_FAMILIES: Record<string, string> = {
  'Courier Prime': "'Courier Prime', Courier, monospace",
  'Patrick Hand': "'Patrick Hand', 'Comic Sans MS', cursive",
  'Deja Vu Sans': "'DejaVu Sans', Arial, Helvetica, sans-serif",
  'Deja Vu Serif': "'DejaVu Serif', 'Times New Roman', Times, serif",
  'Deja Vu Sans Mono': "'DejaVu Sans Mono', 'Courier New', Courier, monospace",
  'Jet Brains Mono': "'JetBrains Mono', 'Consolas', 'Monaco', monospace",
  'Jet Brains Mono NL': "'JetBrains Mono NL', 'Consolas', 'Monaco', monospace",
};

// Base14 PDF font fallbacks
const BASE14_FALLBACKS: Record<string, string> = {
  'Helvetica': 'Arial, Helvetica, sans-serif',
  'Times': "'Times New Roman', Times, serif",
  'Courier': "'Courier New', Courier, monospace",
  'Symbol': 'Symbol, serif',
  'ZapfDingbats': "'Zapf Dingbats', serif"
};

/**
 * Parse a font display name into family and variant
 */
export const parseFontName = (displayName: string): { family: string; variant: string } => {
  if (!displayName) return { family: 'Helvetica', variant: 'Regular' };

  // Common variant patterns
  const variantPatterns = [
    'Bold Oblique', 'Bold Italic', 'Bold',
    'Oblique', 'Italic',
    'Extra Bold', 'Semi Bold', 'Light', 'Thin',
    'Extra Light', 'Medium', 'Black', 'Heavy',
    'Condensed', 'Extended', 'Narrow'
  ];

  const name = displayName.trim();

  // Try to match variant patterns at the end
  for (const variant of variantPatterns.sort((a, b) => b.length - a.length)) {
    if (name.endsWith(' ' + variant)) {
      const family = name.slice(0, -(' ' + variant).length).trim();
      return { family, variant };
    }
  }

  // Special case for base14 fonts with hyphens
  if (name.includes('-')) {
    const [family, ...variantParts] = name.split('-');
    if (['Helvetica', 'Times', 'Courier'].includes(family)) {
      const variant = variantParts.join('-');
      const variantMap: Record<string, string> = {
        'Roman': 'Regular',
        'BoldItalic': 'Bold Italic',
        'BoldOblique': 'Bold Oblique'
      };
      return { family, variant: variantMap[variant] || variant || 'Regular' };
    }
  }

  // No variant found, it's a regular font
  return { family: name, variant: 'Regular' };
};

/**
 * Convert family + variant back to backend display name
 */
export const formatFontDisplayName = (family: string, variant: string = 'Regular'): string => {
  if (variant === 'Regular') {
    // Special cases for base14
    if (family === 'Times') {
      return 'Times-Roman';
    } else if (['Helvetica', 'Courier', 'Symbol', 'ZapfDingbats'].includes(family)) {
      return family;
    } else {
      return family;
    }
  } else {
    // For base14 fonts, use hyphen format
    if (['Helvetica', 'Times', 'Courier'].includes(family)) {
      const variantMap: Record<string, string> = {
        'Bold': 'Bold',
        'Italic': family === 'Times' ? 'Italic' : 'Oblique',
        'Oblique': 'Oblique',
        'Bold Italic': family === 'Times' ? 'BoldItalic' : 'BoldOblique',
        'Bold Oblique': 'BoldOblique',
        'Roman': 'Roman'
      };
      const mappedVariant = variantMap[variant] || variant.replace(' ', '');
      return `${family}-${mappedVariant}`;
    } else {
      // Asset fonts use space format
      return `${family} ${variant}`;
    }
  }
};

/**
 * Resolve font family name to CSS font-family string for frontend rendering
 */
export const resolveFontFamily = (fontDisplayName?: string): string => {
  if (!fontDisplayName) return 'Helvetica, Arial, sans-serif';

  const { family } = parseFontName(fontDisplayName);

  // Check known families first
  if (KNOWN_FONT_FAMILIES[family]) {
    return KNOWN_FONT_FAMILIES[family];
  }

  // Check base14 fallbacks
  if (BASE14_FALLBACKS[family]) {
    return BASE14_FALLBACKS[family];
  }

  // Default fallback with the family name
  return `'${family}', Arial, Helvetica, sans-serif`;
};

/**
 * Get CSS font-weight from variant
 */
export const getFontWeight = (variant: string): string => {
  const v = variant.toLowerCase();
  if (v.includes('bold')) return 'bold';
  if (v.includes('light')) return '300';
  if (v.includes('thin')) return '100';
  if (v.includes('medium')) return '500';
  if (v.includes('black') || v.includes('heavy')) return '900';
  return 'normal';
};

/**
 * Get CSS font-style from variant
 */
export const getFontStyle = (variant: string): string => {
  const v = variant.toLowerCase();
  if (v.includes('italic') || v.includes('oblique')) return 'italic';
  return 'normal';
};

/**
 * Get complete CSS font properties from font display name
 */
export const getFontCSS = (fontDisplayName?: string): {
  fontFamily: string;
  fontWeight: string;
  fontStyle: string
} => {
  if (!fontDisplayName) {
    return {
      fontFamily: 'Helvetica, Arial, sans-serif',
      fontWeight: 'normal',
      fontStyle: 'normal'
    };
  }

  const { variant } = parseFontName(fontDisplayName);

  return {
    fontFamily: resolveFontFamily(fontDisplayName),
    fontWeight: getFontWeight(variant),
    fontStyle: getFontStyle(variant)
  };
};