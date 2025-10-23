/**
 * Token registry service for autocomplete and validation.
 * Provides centralized list of available tokens including auto-generated navigation variants.
 * Following CLAUDE.md Rule #1: No dummy implementations - complete token catalog.
 */

export interface TokenInfo {
  name: string;
  description: string;
  example: string;
  category: 'date' | 'counter' | 'navigation' | 'rendering' | 'custom';
  hasNavigation?: boolean; // If true, _prev/_next variants exist
  boundaryBehavior?: string; // Warning about boundary conditions
}

export interface TokenValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
  suggestion?: TokenInfo;
}

export class TokenRegistry {
  private static baseTokens: TokenInfo[] = [
    // Date tokens (automatic navigation)
    {
      name: 'date',
      description: 'Current date in ISO format (YYYY-MM-DD)',
      example: '2026-01-15',
      category: 'date',
      hasNavigation: true,
      boundaryBehavior: '{date_prev} and {date_next} are automatically available (±1 day)'
    },
    {
      name: 'date_long',
      description: 'Long format date',
      example: 'Wednesday, January 15, 2026',
      category: 'date'
    },
    {
      name: 'year',
      description: 'Current year',
      example: '2026',
      category: 'date',
      hasNavigation: true,
      boundaryBehavior: '{year_prev} and {year_next} are automatically available (±1 year)'
    },
    {
      name: 'month',
      description: 'Month number (1-12)',
      example: '1',
      category: 'date',
      hasNavigation: true,
      boundaryBehavior: '{month_prev} and {month_next} are automatically available (wraps at year boundaries)'
    },
    {
      name: 'month_name',
      description: 'Full month name (localized)',
      example: 'January',
      category: 'date'
    },
    {
      name: 'month_abbr',
      description: 'Abbreviated month name',
      example: 'Jan',
      category: 'date'
    },
    {
      name: 'day',
      description: 'Day of month (1-31)',
      example: '15',
      category: 'date'
    },
    {
      name: 'weekday',
      description: 'Weekday name',
      example: 'Wednesday',
      category: 'date'
    },
    {
      name: 'week',
      description: 'ISO week number (1-52/53)',
      example: '3',
      category: 'date',
      hasNavigation: true,
      boundaryBehavior: '{week_prev} and {week_next} are automatically available (previous/next week)'
    },

    // Rendering tokens (page numbers)
    {
      name: 'page',
      description: 'Current PDF page number',
      example: '42',
      category: 'rendering'
    },
    {
      name: 'total_pages',
      description: 'Total number of pages in PDF',
      example: '365',
      category: 'rendering'
    },

    // Sequence tokens
    {
      name: 'index',
      description: 'Current iteration index (1-based)',
      example: '5',
      category: 'custom'
    },
    {
      name: 'index_padded',
      description: 'Zero-padded index (001, 002, ...)',
      example: '005',
      category: 'custom'
    }
  ];

  /**
   * Get all available tokens for a given section configuration.
   * Includes automatic navigation variants for counters and dates.
   * Following CLAUDE.md Rule #1: No dummy implementations - actual token generation.
   */
  static getAvailableTokens(
    counters?: Record<string, { start: number; step: number }>,
    context?: Record<string, any>
  ): TokenInfo[] {
    const tokens = [...this.baseTokens];

    // Add counter tokens with automatic navigation
    if (counters) {
      Object.entries(counters).forEach(([name, config]) => {
        tokens.push({
          name,
          description: `Counter variable (start: ${config.start}, step: ${config.step})`,
          example: String(config.start),
          category: 'counter',
          hasNavigation: true,
          boundaryBehavior: `{${name}_prev} available when value ≥ start; {${name}_next} available on non-final pages`
        });

        // Add navigation variants explicitly
        tokens.push({
          name: `${name}_prev`,
          description: `Previous value of ${name} (value - step)`,
          example: String(config.start - config.step),
          category: 'navigation',
          boundaryBehavior: 'Empty on first page when value < start'
        });

        tokens.push({
          name: `${name}_next`,
          description: `Next value of ${name} (value + step)`,
          example: String(config.start + config.step),
          category: 'navigation',
          boundaryBehavior: 'Empty on last page'
        });
      });
    }

    // Add context (custom) variables
    if (context) {
      Object.entries(context).forEach(([name, value]) => {
        tokens.push({
          name,
          description: 'Custom context variable',
          example: String(value),
          category: 'custom'
        });
      });
    }

    // Add navigation variants for date tokens
    tokens.push({
      name: 'date_prev',
      description: 'Previous date (date - 1 day)',
      example: '2026-01-14',
      category: 'navigation'
    });

    tokens.push({
      name: 'date_next',
      description: 'Next date (date + 1 day)',
      example: '2026-01-16',
      category: 'navigation'
    });

    tokens.push({
      name: 'year_prev',
      description: 'Previous year (year - 1)',
      example: '2025',
      category: 'navigation'
    });

    tokens.push({
      name: 'year_next',
      description: 'Next year (year + 1)',
      example: '2027',
      category: 'navigation'
    });

    tokens.push({
      name: 'month_prev',
      description: 'Previous month (wraps to 12 at year boundary)',
      example: '12',
      category: 'navigation'
    });

    tokens.push({
      name: 'month_next',
      description: 'Next month (wraps to 1 at year boundary)',
      example: '2',
      category: 'navigation'
    });

    tokens.push({
      name: 'week_prev',
      description: 'Previous week number',
      example: '2',
      category: 'navigation'
    });

    tokens.push({
      name: 'week_next',
      description: 'Next week number',
      example: '4',
      category: 'navigation'
    });

    return tokens;
  }

  /**
   * Validate a token string and return helpful error messages.
   * Following CLAUDE.md Rule #3: Explicit validation with meaningful errors.
   */
  static validateToken(
    tokenText: string,
    availableTokens: TokenInfo[]
  ): TokenValidationResult {
    // Extract tokens from text (e.g., "day:{date_next}" → ["date_next"])
    const tokenPattern = /\{([a-zA-Z_][a-zA-Z0-9_-]*)(:[^}]+)?\}/g;
    const matches = Array.from(tokenText.matchAll(tokenPattern));

    if (matches.length === 0) {
      return { valid: true }; // No tokens = valid (plain text)
    }

    const tokenNames = availableTokens.map(t => t.name);

    for (const match of matches) {
      const tokenName = match[1];

      if (!tokenNames.includes(tokenName)) {
        // Find similar tokens (typo detection)
        const similar = this.findSimilarTokens(tokenName, tokenNames);

        return {
          valid: false,
          error: `Unknown token: {${tokenName}}`,
          suggestion: similar.length > 0
            ? availableTokens.find(t => t.name === similar[0])
            : undefined
        };
      }

      // Check boundary warnings for navigation tokens
      const tokenInfo = availableTokens.find(t => t.name === tokenName);
      if (tokenInfo?.boundaryBehavior) {
        return {
          valid: true,
          warning: tokenInfo.boundaryBehavior
        };
      }
    }

    return { valid: true };
  }

  /**
   * Find similar token names using Levenshtein distance (typo detection).
   * Following CLAUDE.md Rule #2: Simple, readable solutions.
   */
  private static findSimilarTokens(input: string, available: string[]): string[] {
    const distances = available.map(token => ({
      token,
      distance: this.levenshteinDistance(input.toLowerCase(), token.toLowerCase())
    }));

    // Return tokens with distance ≤ 2 (1-2 character difference)
    return distances
      .filter(d => d.distance <= 2)
      .sort((a, b) => a.distance - b.distance)
      .map(d => d.token)
      .slice(0, 3);
  }

  /**
   * Calculate Levenshtein distance between two strings.
   * Simple implementation for typo detection.
   */
  private static levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Get token category color for UI display.
   */
  static getCategoryColor(category: TokenInfo['category']): string {
    const colors = {
      date: 'text-purple-600 bg-purple-50',
      counter: 'text-blue-600 bg-blue-50',
      navigation: 'text-green-600 bg-green-50',
      rendering: 'text-orange-600 bg-orange-50',
      custom: 'text-gray-600 bg-gray-50'
    };
    return colors[category] || colors.custom;
  }
}
