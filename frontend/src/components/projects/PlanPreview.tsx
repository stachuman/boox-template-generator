import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Eye, EyeOff, FileText, Calendar, Clock, AlertTriangle, CheckCircle, ChevronDown } from 'lucide-react';
import { Plan, PlanSection, Master, GenerateMode } from '@/types';
import { planValidationService, ValidationResult } from '@/services/planValidation';

interface PlanPreviewProps {
  plan: Plan;
  masters: Master[];
  onCompile?: () => Promise<void>;
  isCompiling?: boolean;
}

interface SectionPreview {
  section: PlanSection;
  estimatedPages: number;
  sampleDestinations: string[];
  sampleContexts: Array<Record<string, any>>;
}

interface VariableGroup {
  category: string;
  variables: Array<{
    name: string;
    description: string;
  }>;
}

const getAvailableVariables = (generateMode: GenerateMode): VariableGroup[] => {
  const baseVariables: VariableGroup = {
    category: "Common Variables",
    variables: [
      { name: "custom", description: "Custom context variables from section configuration" }
    ]
  };

  switch (generateMode) {
    case GenerateMode.ONCE:
      return [baseVariables];

    case GenerateMode.COUNT:
      return [
        baseVariables,
        {
          category: "Sequence Variables",
          variables: [
            { name: "index", description: "Current instance number (1, 2, 3...)" },
            { name: "index_padded", description: "Zero-padded index (001, 002, 003)" },
            { name: "total", description: "Total number of instances" },
            { name: "subpage", description: "Subpage number for multi-page items" }
          ]
        }
      ];

    case GenerateMode.EACH_DAY:
      return [
        baseVariables,
        {
          category: "Date Variables",
          variables: [
            { name: "date", description: "ISO date string (2026-01-15)" },
            { name: "date_long", description: "Long format (Wednesday, January 15, 2026)" },
            { name: "year", description: "Year number (2026)" },
            { name: "month", description: "Month number (1-12)" },
            { name: "month_padded", description: "Zero-padded month (01-12)" },
            { name: "month_padded3", description: "Three-digit padded month (001-012)" },
            { name: "month_name", description: "Localized month name (January)" },
            { name: "day", description: "Day number (1-31)" },
            { name: "day_padded", description: "Zero-padded day (01-31)" },
            { name: "weekday", description: "Localized weekday name (Wednesday)" }
          ]
        }
      ];

    case GenerateMode.EACH_MONTH:
      return [
        baseVariables,
        {
          category: "Date Variables",
          variables: [
            { name: "year", description: "Year number (2026)" },
            { name: "month", description: "Month number (1-12)" },
            { name: "month_padded", description: "Zero-padded month (01-12)" },
            { name: "month_padded3", description: "Three-digit padded month (001-012)" },
            { name: "month_name", description: "Localized month name (January)" }
          ]
        }
      ];

    case GenerateMode.EACH_WEEK:
      return [
        baseVariables,
        {
          category: "Date Variables",
          variables: [
            { name: "iso_week", description: "ISO week string (2026-W03)" },
            { name: "year", description: "Year number (2026)" },
            { name: "week", description: "ISO week number (1-53)" },
            { name: "week_padded", description: "Zero-padded week (01-53)" }
          ]
        }
      ];

    default:
      return [baseVariables];
  }
};

export const PlanPreview: React.FC<PlanPreviewProps> = ({
  plan,
  masters,
  onCompile,
  isCompiling = false
}) => {
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [sectionPreviews, setSectionPreviews] = useState<SectionPreview[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  useEffect(() => {
    const validationResult = planValidationService.validatePlan(plan, masters);
    setValidation(validationResult);

    // Generate section previews
    const previews = plan.sections.map(section => generateSectionPreview(section, plan.calendar));
    setSectionPreviews(previews);
  }, [plan, masters]);

  const generateSectionPreview = (section: PlanSection, calendar: any): SectionPreview => {
    const preview: SectionPreview = {
      section,
      estimatedPages: 0,
      sampleDestinations: [],
      sampleContexts: []
    };

    switch (section.generate) {
      case GenerateMode.ONCE:
        preview.estimatedPages = 1;
        preview.sampleDestinations = [`${section.kind}:index`];
        preview.sampleContexts = [section.context || {}];
        break;

      case GenerateMode.COUNT:
        const count = section.count || 1;
        preview.estimatedPages = count;
        preview.sampleDestinations = Array.from({ length: Math.min(count, 3) }, (_, i) =>
          `${section.kind}:page:${String(i + 1).padStart(3, '0')}`
        );
        preview.sampleContexts = Array.from({ length: Math.min(count, 3) }, (_, i) => ({
          ...section.context,
          index: i + 1,
          index_padded: String(i + 1).padStart(3, '0')
        }));
        break;

      case GenerateMode.EACH_DAY:
        if (section.start_date && section.end_date) {
          const startDate = new Date(section.start_date);
          const endDate = new Date(section.end_date);
          const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

          preview.estimatedPages = daysDiff * (calendar.pages_per_day || 1);

          // Sample first few days
          const sampleDays = Math.min(daysDiff, 3);
          for (let i = 0; i < sampleDays; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);
            const dateStr = currentDate.toISOString().split('T')[0];

            preview.sampleDestinations.push(`${section.kind}:${dateStr}`);
            preview.sampleContexts.push({
              ...section.context,
              date: dateStr,
              date_long: currentDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }),
              year: currentDate.getFullYear(),
              month: currentDate.getMonth() + 1,
              month_padded: String(currentDate.getMonth() + 1).padStart(2, '0'),
              month_padded3: String(currentDate.getMonth() + 1).padStart(3, '0'),
              month_name: currentDate.toLocaleDateString('en-US', { month: 'long' }),
              day: currentDate.getDate(),
              day_padded: String(currentDate.getDate()).padStart(2, '0'),
              weekday: currentDate.toLocaleDateString('en-US', { weekday: 'long' })
            });
          }
        }
        break;

      case GenerateMode.EACH_MONTH:
        if (section.start_date && section.end_date) {
          const startDate = new Date(section.start_date);
          const endDate = new Date(section.end_date);
          const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
                            (endDate.getMonth() - startDate.getMonth()) + 1;

          preview.estimatedPages = monthsDiff;

          // Sample first few months
          const sampleMonths = Math.min(monthsDiff, 3);
          for (let i = 0; i < sampleMonths; i++) {
            const currentDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            const monthStr = `${year}-${String(month).padStart(2, '0')}`;

            preview.sampleDestinations.push(`${section.kind}:${monthStr}`);
            preview.sampleContexts.push({
              ...section.context,
              year,
              month,
              month_padded: String(month).padStart(2, '0'),
              month_padded3: String(month).padStart(3, '0'),
              month_name: currentDate.toLocaleDateString('en-US', { month: 'long' })
            });
          }
        }
        break;
    }

    return preview;
  };

  const toggleSectionExpanded = (index: number) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSections(newExpanded);
  };

  const totalPages = validation?.estimatedPages || 0;
  const hasErrors = validation?.errors.length || 0;
  const hasWarnings = validation?.warnings.length || 0;

  return (
    <div className="space-y-4">
      {/* Validation Status */}
      <Card className={`border-l-4 ${
        hasErrors > 0 ? 'border-l-red-500' : hasWarnings > 0 ? 'border-l-yellow-500' : 'border-l-green-500'
      }`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {hasErrors > 0 ? (
                <AlertTriangle className="text-red-500" size={20} />
              ) : (
                <CheckCircle className="text-green-500" size={20} />
              )}
              Plan Validation
            </CardTitle>
            {onCompile && (
              <Button
                onClick={onCompile}
                disabled={hasErrors > 0 || isCompiling}
                className="flex items-center gap-2"
              >
                <FileText size={16} />
                {isCompiling ? 'Compiling...' : 'Compile Plan'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <FileText size={16} className="text-blue-600" />
              <span>{totalPages} estimated pages</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar size={16} className="text-green-600" />
              <span>{plan.sections.length} sections</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock size={16} className="text-purple-600" />
              <span>{masters.length} masters</span>
            </div>
          </div>

          {hasErrors > 0 && (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <h4 className="font-medium text-red-800 mb-2">Errors ({hasErrors})</h4>
              <ul className="space-y-1 text-sm text-red-700">
                {validation?.errors.map((error, index) => (
                  <li key={index}>
                    <strong>Section {error.section}:</strong> {error.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasWarnings > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
              <h4 className="font-medium text-yellow-800 mb-2">Warnings ({hasWarnings})</h4>
              <ul className="space-y-1 text-sm text-yellow-700">
                {validation?.warnings.map((warning, index) => (
                  <li key={index}>
                    <strong>Section {warning.section}:</strong> {warning.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section Previews */}
      <Card>
        <CardHeader>
          <CardTitle>Section Previews</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sectionPreviews.map((preview, index) => (
            <div key={index} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h4 className="font-medium">{preview.section.kind || `Section ${index + 1}`}</h4>
                  <Badge variant="outline">
                    {preview.section.master}
                  </Badge>
                  <Badge variant="secondary">
                    {preview.estimatedPages} pages
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {preview.section.generate}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSectionExpanded(index)}
                  className="flex items-center gap-1"
                >
                  {expandedSections.has(index) ? <EyeOff size={14} /> : <Eye size={14} />}
                  {expandedSections.has(index) ? 'Hide' : 'Show'} Details
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${expandedSections.has(index) ? 'rotate-180' : ''}`}
                  />
                </Button>
              </div>

              <Collapsible open={expandedSections.has(index)}>
                <CollapsibleContent className="space-y-3">
                  {/* Sample Destinations */}
                  <div>
                    <h5 className="font-medium text-sm mb-2">Sample Destinations</h5>
                    <div className="flex flex-wrap gap-1">
                      {preview.sampleDestinations.slice(0, 5).map((dest, i) => (
                        <Badge key={i} variant="outline" className="text-xs font-mono">
                          {dest}
                        </Badge>
                      ))}
                      {preview.sampleDestinations.length > 5 && (
                        <Badge variant="secondary" className="text-xs">
                          +{preview.sampleDestinations.length - 5} more
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Available Variables */}
                  <div>
                    <h5 className="font-medium text-sm mb-2">Available Variables</h5>
                    <div className="bg-green-50 border border-green-200 rounded p-3 text-sm">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {getAvailableVariables(preview.section.generate).map((varGroup) => (
                          <div key={varGroup.category}>
                            <h6 className="font-medium text-green-800 mb-1">{varGroup.category}</h6>
                            <div className="space-y-1">
                              {varGroup.variables.map((variable) => (
                                <div key={variable.name} className="flex items-start gap-1">
                                  <code className="bg-white border px-1 rounded text-xs font-mono text-green-700">
                                    {`{${variable.name}}`}
                                  </code>
                                  <span className="text-green-600 text-xs">{variable.description}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Sample Context Values */}
                  {preview.sampleContexts.length > 0 && (
                    <div>
                      <h5 className="font-medium text-sm mb-2">Sample Values</h5>
                      <div className="space-y-2">
                        {preview.sampleContexts.slice(0, 2).map((context, i) => (
                          <div key={i} className="bg-gray-50 rounded p-2 text-xs">
                            <div className="font-mono text-gray-600 mb-1">Instance {i + 1}:</div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {Object.entries(context).map(([key, value]) => (
                                <div key={key} className="flex items-center gap-1">
                                  <span className="text-gray-500">{key}:</span>
                                  <code className="bg-white px-1 rounded text-xs">
                                    {String(value)}
                                  </code>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Generation Details */}
                  <div className="bg-blue-50 rounded p-3 text-sm">
                    <h5 className="font-medium mb-1">Generation Details</h5>
                    <div className="text-gray-600">
                      {preview.section.generate === GenerateMode.ONCE && (
                        <span>Single instance using master "{preview.section.master}"</span>
                      )}
                      {preview.section.generate === GenerateMode.COUNT && (
                        <span>Generate {preview.section.count} instances using master "{preview.section.master}"</span>
                      )}
                      {preview.section.generate === GenerateMode.EACH_DAY && (
                        <span>
                          Generate daily pages from {preview.section.start_date} to {preview.section.end_date}
                          using master "{preview.section.master}"
                        </span>
                      )}
                      {preview.section.generate === GenerateMode.EACH_MONTH && (
                        <span>
                          Generate monthly pages from {preview.section.start_date} to {preview.section.end_date}
                          using master "{preview.section.master}"
                        </span>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          ))}

          {sectionPreviews.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No sections to preview. Add sections to see the compilation preview.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PlanPreview;