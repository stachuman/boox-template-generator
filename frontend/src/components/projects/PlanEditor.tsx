import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectItem } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Trash2, ChevronUp, ChevronDown, Info, Save, AlertCircle } from 'lucide-react';
import { Project, Plan, PlanSection, CalendarConfig, GenerateMode, Master } from '@/types';

interface PlanEditorProps {
  project: Project;
  onSave: (plan: Plan) => Promise<void>;
}

interface ValidationError {
  section: string;
  field: string;
  message: string;
}

export const PlanEditor: React.FC<PlanEditorProps> = ({ project, onSave }) => {
  const [plan, setPlan] = useState<Plan>(project.plan);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Validate plan sections
  useEffect(() => {
    const errors: ValidationError[] = [];

    plan.sections.forEach((section, index) => {
      if (!section.kind.trim()) {
        errors.push({ section: `${index}`, field: 'kind', message: 'Section kind is required' });
      }

      if (!section.master) {
        errors.push({ section: `${index}`, field: 'master', message: 'Master template is required' });
      } else if (!project.masters.find(m => m.name === section.master)) {
        errors.push({ section: `${index}`, field: 'master', message: 'Referenced master does not exist' });
      }

      if (section.generate === GenerateMode.COUNT && (!section.count || section.count < 1)) {
        errors.push({ section: `${index}`, field: 'count', message: 'Count must be at least 1' });
      }

      // Section-level dates are optional; if omitted, plan.calendar dates are used.
      // If one is provided, both must be provided for clarity.
      const needsDates = (section.generate === GenerateMode.EACH_DAY || section.generate === GenerateMode.EACH_MONTH);
      const hasStart = !!section.start_date;
      const hasEnd = !!section.end_date;
      if (needsDates && ((hasStart && !hasEnd) || (!hasStart && hasEnd))) {
        errors.push({ section: `${index}`, field: 'dates', message: 'Provide both start and end, or leave both empty to use plan defaults' });
      }
    });

    setValidationErrors(errors);
  }, [plan, project.masters]);

  const handleCalendarChange = (calendar: CalendarConfig) => {
    setPlan({ ...plan, calendar });
  };

  const handleLocaleChange = (locale: string) => {
    setPlan({ ...plan, locale });
  };

  const handleSectionChange = (index: number, section: PlanSection) => {
    const newSections = [...plan.sections];
    const prevKind = newSections[index]?.kind || '';
    newSections[index] = section;

    // Update order to reflect kind changes
    let newOrder = [...plan.order];
    const currentKind = (section.kind || '').trim();

    if (prevKind && newOrder.includes(prevKind)) {
      // Replace existing kind in order
      if (currentKind) {
        newOrder = newOrder.map(k => (k === prevKind ? currentKind : k));
      } else {
        // Remove from order if kind is now empty
        newOrder = newOrder.filter(k => k !== prevKind);
      }
    } else if (currentKind && !newOrder.includes(currentKind)) {
      // Add new kind to order
      newOrder = [...newOrder, currentKind];
    }

    // Clean up order array - remove empty or invalid entries
    newOrder = newOrder.filter(k => k && k.trim().length > 0);

    setPlan({ ...plan, sections: newSections, order: newOrder });
  };

  const handleAddSection = () => {
    const newSection: PlanSection = {
      kind: '',
      master: '',
      generate: GenerateMode.ONCE,
      context: {}
    };
    setPlan({
      ...plan,
      sections: [...plan.sections, newSection],
      // Do not add placeholder to order; will be added when kind is set
      order: [...plan.order]
    });
  };

  const handleRemoveSection = (index: number) => {
    if (index < 0 || index >= plan.sections.length) return; // Safety check

    const removedKind = plan.sections[index]?.kind;
    const newSections = plan.sections.filter((_, i) => i !== index);

    // Remove from order and clean up
    let newOrder = plan.order.filter(kind => kind !== removedKind);
    newOrder = newOrder.filter(k => k && k.trim().length > 0);

    setPlan({
      ...plan,
      sections: newSections,
      order: newOrder
    });
  };


  const handleSave = async () => {
    if (validationErrors.length > 0) return;

    setIsSaving(true);
    try {
      // Normalize order to match section kinds (preserve existing order where possible)
      const sectionKinds = plan.sections.map(s => s.kind).filter(k => k && k.trim().length > 0);
      const orderFiltered = plan.order.filter(k => sectionKinds.includes(k));
      const missing = sectionKinds.filter(k => !orderFiltered.includes(k));
      const normalizedPlan: Plan = { ...plan, order: [...orderFiltered, ...missing] };
      await onSave(normalizedPlan);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Plan Configuration</h2>
        <div className="flex gap-2">
          {validationErrors.length > 0 && (
            <div className="text-red-600 text-sm">
              <div className="flex items-center gap-1 mb-1">
                <AlertCircle size={16} />
                {validationErrors.length} error(s) - fix to enable save:
              </div>
              <ul className="text-xs space-y-1">
                {validationErrors.slice(0, 3).map((error, i) => (
                  <li key={i}>Section {parseInt(error.section) + 1}: {error.message}</li>
                ))}
                {validationErrors.length > 3 && <li>...and {validationErrors.length - 3} more</li>}
              </ul>
            </div>
          )}
          <Button
            onClick={handleSave}
            disabled={validationErrors.length > 0 || isSaving}
            className="flex items-center gap-2"
          >
            <Save size={16} />
            {isSaving ? 'Saving...' : 'Save Plan'}
          </Button>
        </div>
      </div>

      {/* Instruction Legend */}
      <InstructionLegend />

      {/* Calendar Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Calendar Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <CalendarConfigEditor
            config={plan.calendar}
            onChange={handleCalendarChange}
          />
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="locale">Locale</Label>
              <Select
                value={plan.locale || 'en'}
                onValueChange={handleLocaleChange}
              >
                <SelectItem value="en">English (en)</SelectItem>
                <SelectItem value="pl">Polski (pl)</SelectItem>
              </Select>
              <p className="text-xs text-gray-500 mt-1">Affects month/weekday names and label tokens</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan Sections */}
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            Plan Sections
            <Button onClick={handleAddSection} size="sm" className="flex items-center gap-1">
              <Plus size={16} />
              Add Section
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {plan.sections.map((section, index) => (
            <SectionEditor
              key={`section-${index}`}
              section={section}
              sectionIndex={index}
              availableMasters={project.masters}
              validationErrors={validationErrors.filter(e => e.section === `${index}`)}
              onChange={(updatedSection) => handleSectionChange(index, updatedSection)}
              onDelete={() => handleRemoveSection(index)}
            />
          ))}

          {plan.sections.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No sections defined. Click "Add Section" to get started.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generated Sections Overview */}
      {plan.sections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Sections Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Preview of sections that will be generated in processing order:
            </p>
            <div className="space-y-3">
              {plan.order.map((kind, index) => {
                const section = plan.sections.find(s => s.kind === kind);
                if (!section) return null;

                // Calculate estimated page count
                let estimatedPages = section.pages_per_item || 1;
                const generateMode = section.generate as string; // Backend stores as string
                if (generateMode === 'count' && section.count) {
                  estimatedPages *= section.count;
                } else if (generateMode === 'each_day' && section.start_date && section.end_date) {
                  const start = new Date(section.start_date);
                  const end = new Date(section.end_date);
                  const dayCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                  estimatedPages *= dayCount;
                } else if (generateMode === 'each_month' && section.start_date && section.end_date) {
                  const start = new Date(section.start_date);
                  const end = new Date(section.end_date);
                  const monthCount = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
                  estimatedPages *= monthCount;
                }

                return (
                  <div
                    key={kind}
                    className="flex items-center justify-between p-3 bg-blue-50 rounded border border-blue-200"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-blue-900">{index + 1}. {kind}</div>
                      <div className="text-sm text-blue-700">
                        Master: {section.master} | Mode: {generateMode}
                        {generateMode === 'count' && ` | Count: ${section.count || 1}`}
                        {generateMode === 'each_day' && section.start_date && section.end_date &&
                          ` | ${section.start_date} to ${section.end_date}`}
                        {generateMode === 'each_month' && section.start_date && section.end_date &&
                          ` | ${section.start_date} to ${section.end_date}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-blue-900">~{estimatedPages} pages</div>
                      <div className="text-xs text-blue-600">
                        {section.pages_per_item || 1} per item
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Calendar Configuration Editor Component
const CalendarConfigEditor: React.FC<{
  config: CalendarConfig;
  onChange: (config: CalendarConfig) => void;
}> = ({ config, onChange }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <Label htmlFor="start-date">Start Date</Label>
        <Input
          id="start-date"
          type="date"
          value={config.start_date}
          onChange={(e) => onChange({ ...config, start_date: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="end-date">End Date</Label>
        <Input
          id="end-date"
          type="date"
          value={config.end_date}
          onChange={(e) => onChange({ ...config, end_date: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="pages-per-day">Pages per Day</Label>
        <Input
          id="pages-per-day"
          type="number"
          min="1"
          max="10"
          value={config.pages_per_day}
          onChange={(e) => onChange({ ...config, pages_per_day: parseInt(e.target.value) })}
        />
      </div>
    </div>
  );
};

// Section Editor Component
const SectionEditor: React.FC<{
  section: PlanSection;
  sectionIndex: number;
  availableMasters: Master[];
  validationErrors: ValidationError[];
  onChange: (section: PlanSection) => void;
  onDelete: () => void;
}> = ({ section, sectionIndex, availableMasters, validationErrors, onChange, onDelete }) => {
  const hasErrors = validationErrors.length > 0;

  return (
    <Card className={hasErrors ? 'border-red-300' : ''}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">Section {sectionIndex + 1}</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 size={16} />
          </Button>
        </div>
        {hasErrors && (
          <div className="text-sm text-red-600 space-y-1">
            {validationErrors.map((error, index) => (
              <div key={index}>• {error.message}</div>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor={`kind-${sectionIndex}`}>Section Kind</Label>
            <Input
              id={`kind-${sectionIndex}`}
              value={section.kind}
              onChange={(e) => onChange({ ...section, kind: e.target.value })}
              placeholder="e.g., days, months, notes"
              className={validationErrors.some(e => e.field === 'kind') ? 'border-red-300' : ''}
            />
          </div>
          <div>
            <Label htmlFor={`master-${sectionIndex}`}>Master Template</Label>
            <Select
              value={section.master}
              onValueChange={(master) => onChange({ ...section, master })}
              placeholder="Select master template"
              className={validationErrors.some(e => e.field === 'master') ? 'border-red-300' : ''}
            >
              {availableMasters.map(master => (
                <SelectItem key={master.name} value={master.name}>
                  {master.name} - {master.description}
                </SelectItem>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor={`generate-${sectionIndex}`}>Generation Mode</Label>
          <Select
            value={section.generate}
            onValueChange={(generate) => onChange({ ...section, generate: generate as GenerateMode })}
            placeholder="Select generation mode"
          >
            <SelectItem value={GenerateMode.ONCE}>Once - Single instance</SelectItem>
            <SelectItem value={GenerateMode.EACH_DAY}>Each Day - Daily repetition</SelectItem>
            <SelectItem value={GenerateMode.EACH_MONTH}>Each Month - Monthly repetition</SelectItem>
            <SelectItem value={GenerateMode.COUNT}>Count - Specified number of instances</SelectItem>
          </Select>
        </div>

        {section.generate === GenerateMode.COUNT && (
          <div>
            <Label htmlFor={`count-${sectionIndex}`}>Count</Label>
            <Input
              id={`count-${sectionIndex}`}
              type="number"
              min="1"
              value={section.count || 1}
              onChange={(e) => onChange({ ...section, count: parseInt(e.target.value) })}
              className={validationErrors.some(e => e.field === 'count') ? 'border-red-300' : ''}
            />
          </div>
        )}

        {(section.generate === GenerateMode.EACH_DAY || section.generate === GenerateMode.EACH_MONTH) && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`start-date-${sectionIndex}`}>Start Date</Label>
              <Input
                id={`start-date-${sectionIndex}`}
                type="date"
                value={section.start_date || ''}
                onChange={(e) => onChange({ ...section, start_date: e.target.value })}
                className={validationErrors.some(e => e.field === 'dates') ? 'border-red-300' : ''}
              />
            </div>
            <div>
              <Label htmlFor={`end-date-${sectionIndex}`}>End Date</Label>
              <Input
                id={`end-date-${sectionIndex}`}
                type="date"
                value={section.end_date || ''}
                onChange={(e) => onChange({ ...section, end_date: e.target.value })}
                className={validationErrors.some(e => e.field === 'dates') ? 'border-red-300' : ''}
              />
            </div>
          </div>
        )}

        <div>
          <Label htmlFor={`pages-per-item-${sectionIndex}`}>Pages per Item</Label>
          <Input
            id={`pages-per-item-${sectionIndex}`}
            type="number"
            min="1"
            max="10"
            value={section.pages_per_item || 1}
            onChange={(e) => onChange({ ...section, pages_per_item: parseInt(e.target.value) || 1 })}
            className={validationErrors.some(e => e.field === 'pages_per_item') ? 'border-red-300' : ''}
          />
          <p className="text-xs text-gray-500 mt-1">
            Number of pages to generate per item (for multi-page days/months)
          </p>
        </div>

        <div>
          <Label>Named Destinations (Anchors)</Label>
          <AnchorsEditor
            anchors={section.anchors || []}
            onChange={(anchors) => onChange({ ...section, anchors })}
          />
          <p className="text-xs text-gray-500 mt-1">
            Define named destinations like home:index, year:2026, month:2026-01
          </p>
        </div>

        <div>
          <Label>Context Variables</Label>
          <ContextEditor
            context={section.context || {}}
            onChange={(context) => onChange({ ...section, context })}
          />
        </div>
      </CardContent>
    </Card>
  );
};

// Context Editor Component
const ContextEditor: React.FC<{
  context: Record<string, any>;
  onChange: (context: Record<string, any>) => void;
}> = ({ context, onChange }) => {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const addContextVariable = () => {
    if (newKey.trim() && newValue.trim()) {
      onChange({ ...context, [newKey.trim()]: newValue.trim() });
      setNewKey('');
      setNewValue('');
    }
  };

  const removeContextVariable = (key: string) => {
    const newContext = { ...context };
    delete newContext[key];
    onChange(newContext);
  };

  return (
    <div className="space-y-3">
      {Object.entries(context).map(([key, value]) => (
        <div key={key} className="flex items-center gap-2">
          <Input value={key} disabled className="flex-1" />
          <span>=</span>
          <Input
            value={String(value)}
            onChange={(e) => onChange({ ...context, [key]: e.target.value })}
            className="flex-1"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeContextVariable(key)}
            className="text-red-600"
          >
            <Trash2 size={16} />
          </Button>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <Input
          placeholder="Variable name"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addContextVariable();
            }
          }}
          className="flex-1"
        />
        <span>=</span>
        <Input
          placeholder="Value"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addContextVariable();
            }
          }}
          className="flex-1"
        />
        <Button onClick={addContextVariable} size="sm">
          <Plus size={16} />
        </Button>
      </div>
    </div>
  );
};

// Anchors Editor Component
const AnchorsEditor: React.FC<{
  anchors: Array<Record<string, string>>;
  onChange: (anchors: Array<Record<string, string>>) => void;
}> = ({ anchors, onChange }) => {
  const [newDestId, setNewDestId] = useState('');

  const addAnchor = () => {
    if (newDestId.trim()) {
      onChange([...anchors, { dest_id: newDestId.trim() }]);
      setNewDestId('');
    }
  };

  const removeAnchor = (index: number) => {
    onChange(anchors.filter((_, i) => i !== index));
  };

  const updateAnchor = (index: number, dest_id: string) => {
    const newAnchors = [...anchors];
    newAnchors[index] = { dest_id };
    onChange(newAnchors);
  };

  return (
    <div className="space-y-2">
      {anchors.map((anchor, index) => (
        <div key={index} className="space-y-1">
          <div className="flex items-center gap-2">
            <Input
              placeholder="e.g., home:index, year:2026, month:2026-01"
              value={anchor.dest_id || ''}
              onChange={(e) => updateAnchor(index, e.target.value)}
              className="flex-1 font-mono text-sm"
            />
            <Button
              onClick={() => removeAnchor(index)}
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-800"
            >
              ×
            </Button>
          </div>
          {(anchor.dest_id || '').includes('@') && (
            <div className="text-xs text-red-600">
              Destination IDs cannot contain '@'. Use tokens like {'{year}'} in dest_id, and use @vars only inside bind(...).
            </div>
          )}
        </div>
      ))}

      <div className="flex items-center gap-2">
        <Input
          placeholder="Add destination ID (e.g., home:index)"
          value={newDestId}
          onChange={(e) => setNewDestId(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addAnchor()}
          className="flex-1 font-mono text-sm"
        />
        <Button onClick={addAnchor} size="sm">
          <Plus size={16} />
        </Button>
      </div>

      {anchors.length === 0 && (
        <div className="text-sm text-gray-500 italic">
          No anchors defined. Add destination IDs like "home:index" or "year:2026"
        </div>
      )}
    </div>
  );
};

// Instruction Legend Component
const InstructionLegend: React.FC = () => {
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center gap-2 font-medium hover:underline">
        <Info size={16} />
        Master/Plan Compilation Guide
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4 space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              <div>
                <h4 className="font-semibold mb-3">Generation Modes</h4>
                <ul className="space-y-2 text-sm">
                  <li><code className="bg-gray-100 px-1 rounded">ONCE</code> - Generate single instance (index, year pages)</li>
                  <li><code className="bg-gray-100 px-1 rounded">EACH_DAY</code> - Generate for each day in date range</li>
                  <li><code className="bg-gray-100 px-1 rounded">EACH_MONTH</code> - Generate for each month in date range</li>
                  <li><code className="bg-gray-100 px-1 rounded">COUNT</code> - Generate specified number of instances</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Destination ID Patterns</h4>
                <ul className="space-y-2 text-sm">
                  <li><code className="bg-gray-100 px-1 rounded">home:index</code> - Main index page</li>
                  <li><code className="bg-gray-100 px-1 rounded">year:2026</code> - Year overview page</li>
                  <li><code className="bg-gray-100 px-1 rounded">month:2026-01</code> - Month page (YYYY-MM format)</li>
                  <li><code className="bg-gray-100 px-1 rounded">day:2026-01-15</code> - Daily page (YYYY-MM-DD format)</li>
                  <li><code className="bg-gray-100 px-1 rounded">notes:page:001</code> - Notes page with padding</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Binding Patterns</h4>
                <ul className="space-y-2 text-sm">
                  <li><code className="bg-gray-100 px-1 rounded">notes(@cell_value)</code> - Link to notes page based on grid cell value</li>
                  <li><code className="bg-gray-100 px-1 rounded">month(@cell_month)</code> - Link to month page from calendar</li>
                  <li><code className="bg-gray-100 px-1 rounded">day(@cell_date)</code> - Link to day page from calendar</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Template Variables</h4>
                <ul className="space-y-2 text-sm">
                  <li><code className="bg-gray-100 px-1 rounded">{`{year}`}</code> - Current year (2026)</li>
                  <li><code className="bg-gray-100 px-1 rounded">{`{month}`}</code> - Month number (1-12)</li>
                  <li><code className="bg-gray-100 px-1 rounded">{`{month:02d}`}</code> - Zero-padded month (01-12)</li>
                  <li><code className="bg-gray-100 px-1 rounded">{`{month_name}`}</code> - Month name (January)</li>
                  <li><code className="bg-gray-100 px-1 rounded">{`{date}`}</code> - Full date (2026-01-15)</li>
                  <li><code className="bg-gray-100 px-1 rounded">{`{date_long}`}</code> - Long format (Wednesday, January 15, 2026)</li>
                  <li><code className="bg-gray-100 px-1 rounded">{`{index}`}</code> - Current instance index</li>
                  <li><code className="bg-gray-100 px-1 rounded">{`{index_padded}`}</code> - Zero-padded index (001, 002, ...)</li>
                </ul>
              </div>

              <div className="md:col-span-2">
                <h4 className="font-semibold mb-3">Composite Widgets</h4>
                <ul className="space-y-2 text-sm">
                  <li><code className="bg-gray-100 px-1 rounded">calendar_year</code> - Auto-generates month grid with links to month pages</li>
                  <li><code className="bg-gray-100 px-1 rounded">calendar_month</code> - Auto-generates day grid with links to day pages</li>
                  <li><code className="bg-gray-100 px-1 rounded">grid</code> - Generates cell grid with custom templates and binding patterns</li>
                </ul>
              </div>

            </div>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold mb-3">📖 Example: 4-Level Book Structure (Index → Year → Months → Days + Notes)</h4>
              <div className="text-sm space-y-2">
                <p><strong>Typical sections for a complete book:</strong></p>
                <ol className="list-decimal list-inside space-y-1 ml-4">
                  <li><strong>Index section:</strong> kind="index", master="Index", generate=ONCE, anchors=[{`{dest_id: "home:index"}`}]</li>
                  <li><strong>Notes section:</strong> kind="notes_pages", master="NotePage", generate=COUNT, count=10</li>
                  <li><strong>Year section:</strong> kind="year_page", master="Year", generate=ONCE, anchors=[{`{dest_id: "year:2026"}`}]</li>
                  <li><strong>Months section:</strong> kind="month_pages", master="Month", generate=EACH_MONTH</li>
                  <li><strong>Days section:</strong> kind="day_pages", master="Day", generate=EACH_DAY</li>
                </ol>
                <p className="text-blue-700 font-medium mt-3">
                  💡 This produces: Index (1) + Notes (10) + Year (1) + Months (12) + Days (365) = 389 pages for 2026
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default PlanEditor;
