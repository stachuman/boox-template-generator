/**
 * Token replacement utilities for frontend preview.
 *
 * Provides basic token replacement for previewing dynamic content.
 * Following CLAUDE.md standards - no dummy implementations.
 */

interface PreviewContext {
  page?: number;
  total_pages?: number;
  date?: string;
  date_long?: string;
  year?: number;
  month?: number;
  month_name?: string;
  month_abbr?: string;
  day?: number;
  weekday?: string;
  [key: string]: any;
}

/**
 * Replace tokens in text for frontend preview purposes.
 * Uses preview values, not actual compilation data.
 */
export const replaceTokensForPreview = (text: string, context?: Partial<PreviewContext>): string => {
  if (!text || typeof text !== 'string') {
    return String(text || '');
  }

  // Default preview context
  const now = new Date();
  const defaultContext: PreviewContext = {
    page: 1,
    total_pages: 10,
    date: now.toISOString().split('T')[0], // YYYY-MM-DD
    date_long: now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    month_name: now.toLocaleDateString('en-US', { month: 'long' }),
    month_abbr: now.toLocaleDateString('en-US', { month: 'short' }),
    day: now.getDate(),
    weekday: now.toLocaleDateString('en-US', { weekday: 'long' }),
    ...context
  };

  let result = text;

  // Replace all {token} patterns
  for (const [key, value] of Object.entries(defaultContext)) {
    const token = `{${key}}`;
    if (result.includes(token)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    }
  }

  // Add additional common tokens that might be used
  const additionalTokens: Record<string, string> = {
    '{index}': '1',
    '{index_padded}': '001',
    '{month_padded}': String(defaultContext.month).padStart(2, '0'),
    '{day_padded}': String(defaultContext.day).padStart(2, '0'),
    '{weekday}': defaultContext.weekday || 'Monday'
  };

  for (const [token, value] of Object.entries(additionalTokens)) {
    if (result.includes(token)) {
      result = result.replace(new RegExp(`\\${token.replace(/[{}]/g, '\\$&')}`, 'g'), value);
    }
  }

  return result;
};

/**
 * Replace tokens in a nested data structure for preview.
 */
export const replaceTokensInData = (data: any, context?: Partial<PreviewContext>): any => {
  if (typeof data === 'string') {
    return replaceTokensForPreview(data, context);
  }

  if (Array.isArray(data)) {
    return data.map(item => replaceTokensInData(item, context));
  }

  if (data && typeof data === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = replaceTokensInData(value, context);
    }
    return result;
  }

  return data;
};

/**
 * Get a sample context for preview purposes.
 */
export const getSamplePreviewContext = (overrides?: Partial<PreviewContext>): PreviewContext => {
  return {
    page: 1,
    total_pages: 10,
    date: '2025-01-15',
    date_long: 'Wednesday, January 15, 2025',
    year: 2025,
    month: 1,
    month_name: 'January',
    month_abbr: 'Jan',
    day: 15,
    weekday: 'Wednesday',
    ...overrides
  };
};