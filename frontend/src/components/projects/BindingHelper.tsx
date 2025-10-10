import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lightbulb, Copy, Check } from 'lucide-react';
import { BindingContext } from '@/types';

interface BindingPattern {
  pattern: string;
  description: string;
  category: 'destination' | 'binding' | 'variable';
  example?: string;
}

const BINDING_PATTERNS: BindingPattern[] = [
  // Destination patterns
  { pattern: 'home:index', description: 'Main index page', category: 'destination' },
  { pattern: 'year:{year}', description: 'Year overview page', category: 'destination', example: 'year:2026' },
  { pattern: 'month:{year}-{month:02d}', description: 'Month page (YYYY-MM format)', category: 'destination', example: 'month:2026-01' },
  { pattern: 'day:{date}', description: 'Daily page (YYYY-MM-DD format)', category: 'destination', example: 'day:2026-01-15' },
  { pattern: 'notes:page:{index_padded}', description: 'Notes page with padding', category: 'destination', example: 'notes:page:001' },

  // Binding patterns
  { pattern: 'notes(@cell_value)', description: 'Link to notes page based on grid cell value', category: 'binding' },
  { pattern: 'month(@cell_month)', description: 'Link to month page from calendar', category: 'binding' },
  { pattern: 'day(@cell_date)#1', description: 'Link to first subpage of a day from calendar', category: 'binding' },
  { pattern: 'notes({index})', description: 'Link to notes page by index', category: 'binding', example: 'notes(1)' },

  // Template variables
  { pattern: '{year}', description: 'Current year', category: 'variable', example: '2026' },
  { pattern: '{month}', description: 'Month number (1-12)', category: 'variable', example: '1' },
  { pattern: '{month:02d}', description: 'Zero-padded month (01-12)', category: 'variable', example: '01' },
  { pattern: '{month_name}', description: 'Month name', category: 'variable', example: 'January' },
  { pattern: '{date}', description: 'Full date (YYYY-MM-DD)', category: 'variable', example: '2026-01-15' },
  { pattern: '{date_long}', description: 'Long format date', category: 'variable', example: 'Wednesday, January 15, 2026' },
  { pattern: '{index}', description: 'Current instance index', category: 'variable', example: '1' },
  { pattern: '{index_padded}', description: 'Zero-padded index', category: 'variable', example: '001' },
];

interface BindingHelperProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  context?: BindingContext;
  placeholder?: string;
  className?: string;
}

export const BindingHelper: React.FC<BindingHelperProps> = ({
  label,
  value,
  onChange,
  context,
  placeholder = "Enter binding pattern or destination...",
  className
}) => {
  const [suggestions, setSuggestions] = useState<BindingPattern[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [copiedPattern, setCopiedPattern] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value.length === 0) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const filtered = BINDING_PATTERNS.filter(pattern =>
      pattern.pattern.toLowerCase().includes(value.toLowerCase()) ||
      pattern.description.toLowerCase().includes(value.toLowerCase())
    );

    setSuggestions(filtered.slice(0, 8)); // Limit to 8 suggestions
    setShowSuggestions(filtered.length > 0);
    setSelectedIndex(-1);
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          onChange(suggestions[selectedIndex].pattern);
          setShowSuggestions(false);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleSuggestionClick = (pattern: string) => {
    onChange(pattern);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const copyPattern = async (pattern: string) => {
    try {
      await navigator.clipboard.writeText(pattern);
      setCopiedPattern(pattern);
      setTimeout(() => setCopiedPattern(null), 2000);
    } catch (err) {
      console.error('Failed to copy pattern:', err);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'destination': return 'bg-blue-100 text-blue-800';
      case 'binding': return 'bg-green-100 text-green-800';
      case 'variable': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && <Label>{label}</Label>}

      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (value) setShowSuggestions(suggestions.length > 0); }}
          onBlur={() => { setTimeout(() => setShowSuggestions(false), 200); }} // Delay to allow clicks
          placeholder={placeholder}
        />

        {showSuggestions && suggestions.length > 0 && (
          <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto">
            <CardContent className="p-0">
              {suggestions.map((suggestion, index) => (
                <div
                  key={suggestion.pattern}
                  className={`p-3 cursor-pointer border-b last:border-b-0 ${
                    index === selectedIndex ? 'bg-gray-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleSuggestionClick(suggestion.pattern)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-sm bg-gray-100 px-1 rounded">
                          {suggestion.pattern}
                        </code>
                        <Badge variant="secondary" className={getCategoryColor(suggestion.category)}>
                          {suggestion.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600">{suggestion.description}</p>
                      {suggestion.example && (
                        <p className="text-xs text-gray-500 mt-1">
                          Example: <code>{suggestion.example}</code>
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyPattern(suggestion.pattern);
                      }}
                      className="h-6 w-6 p-0"
                    >
                      {copiedPattern === suggestion.pattern ? (
                        <Check size={12} className="text-green-600" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Context Variables Display */}
      {context && Object.keys(context).length > 0 && (
        <div className="flex items-start gap-2 text-sm text-gray-600">
          <Lightbulb size={14} className="mt-0.5 flex-shrink-0" />
          <div>
            <span className="font-medium">Available variables:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(context).map(([key, value]) => (
                <Badge key={key} variant="outline" className="text-xs">
                  {key}: {String(value)}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Insert Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(value + '{year}')}
          className="h-7 text-xs"
        >
          + year
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(value + '{month:02d}')}
          className="h-7 text-xs"
        >
          + month
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(value + '{date}')}
          className="h-7 text-xs"
        >
          + date
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(value + '{index_padded}')}
          className="h-7 text-xs"
        >
          + index
        </Button>
      </div>
    </div>
  );
};

export default BindingHelper;
