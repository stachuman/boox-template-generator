import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectItem } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Trash2, Info, Save, AlertCircle, ChevronRight } from 'lucide-react';
import { Project, Plan, PlanSection, CalendarConfig, GenerateMode, ProjectMaster } from '@/types';

interface PlanEditorProps {
  project: Project;
  onSave: (plan: Plan) => Promise<void>;
}

interface ValidationError {
  section: string;
  field: string;
  message: string;
}

// Helper: Estimate pages for a section (including nested)
const estimateSectionPages = (section: PlanSection): { estimatedPages: number; details: string } => {
  let base = section.pages_per_item || 1;
  const generateMode = section.generate as string;
  let details = `Master: ${section.master} | Mode: ${generateMode}`;

  if (generateMode === 'count' && section.count) {
    base *= section.count;
    details += ` | Count: ${section.count}`;
  } else if (generateMode === 'each_day' && section.start_date && section.end_date) {
    const start = new Date(section.start_date);
    const end = new Date(section.end_date);
    const dayCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    base *= dayCount;
    details += ` | ${section.start_date} to ${section.end_date} (${dayCount} days)`;
  } else if (generateMode === 'each_week' && section.start_date && section.end_date) {
    const start = new Date(section.start_date);
    const end = new Date(section.end_date);
    const dayCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const weekCount = Math.ceil(dayCount / 7);
    base *= weekCount;
    details += ` | ${section.start_date} to ${section.end_date} (~${weekCount} weeks)`;
  } else if (generateMode === 'each_month' && section.start_date && section.end_date) {
    const start = new Date(section.start_date);
    const end = new Date(section.end_date);
    const monthCount = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
    base *= monthCount;
    details += ` | ${section.start_date} to ${section.end_date} (${monthCount} months)`;
  }

  // Multiply by nested section pages
  if (section.nested) {
    section.nested.forEach(nested => {
      const nestedEst = estimateSectionPages(nested);
      base *= nestedEst.estimatedPages;
    });
  }

  return { estimatedPages: base, details };
};

// Helper: Render nested section overview
const renderNestedOverview = (section: PlanSection, index: number, depth: number): JSX.Element => {
  const { estimatedPages, details } = estimateSectionPages(section);

  return (
    <div key={`nested-${index}-${depth}`} className="space-y-2">
      <div className="flex items-center justify-between p-2 bg-blue-100 rounded border border-blue-300 text-sm">
        <div className="flex-1">
          <div className="font-medium text-blue-800">
            <ChevronRight size={14} className="inline mr-1" />
            {section.kind} <span className="text-xs text-blue-600">(Level {depth + 1})</span>
          </div>
          <div className="text-xs text-blue-600">{details}</div>
        </div>
        <div className="text-right">
          <div className="font-medium text-blue-800">~{estimatedPages}</div>
        </div>
      </div>
      {section.nested && section.nested.length > 0 && (
        <div className="ml-4 pl-3 border-l border-blue-300 space-y-2">
          {section.nested.map((nested, ni) => renderNestedOverview(nested, ni, depth + 1))}
        </div>
      )}
    </div>
  );
};

export const PlanEditor: React.FC<PlanEditorProps> = ({ project, onSave }) => {
  const [plan, setPlan] = useState<Plan>(project.plan);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [initialPlanJson, setInitialPlanJson] = useState(JSON.stringify(project.plan));

  // Detect unsaved changes
  useEffect(() => {
    const currentPlanJson = JSON.stringify(plan);
    setHasUnsavedChanges(currentPlanJson !== initialPlanJson);
  }, [plan, initialPlanJson]);

  // Warn user before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = ''; // Required for Chrome
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Keyboard shortcut: Ctrl+S / Cmd+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (hasUnsavedChanges && validationErrors.length === 0 && !isSaving) {
          handleSave();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasUnsavedChanges, validationErrors, isSaving]);

  // Validate plan sections (including nested)
  useEffect(() => {
    const errors: ValidationError[] = [];

    const validateSection = (section: PlanSection, index: number, ancestorVars: Set<string> = new Set()) => {
      const sectionPath = `${index}`;

      if (!section.kind.trim()) {
        errors.push({ section: sectionPath, field: 'kind', message: 'Section kind is required' });
      }

      if (!section.master) {
        errors.push({ section: sectionPath, field: 'master', message: 'Master template is required' });
      } else if (!project.masters.find(m => m.name === section.master)) {
        errors.push({ section: sectionPath, field: 'master', message: 'Referenced master does not exist' });
      }

      if (section.generate === GenerateMode.COUNT && (!section.count || section.count < 1)) {
        errors.push({ section: sectionPath, field: 'count', message: 'Count must be at least 1' });
      }

      // Date-based generation modes require both start and end dates
      const needsDates = (section.generate === GenerateMode.EACH_DAY || section.generate === GenerateMode.EACH_WEEK || section.generate === GenerateMode.EACH_MONTH);
      if (needsDates) {
        if (!section.start_date) {
          errors.push({ section: sectionPath, field: 'dates', message: 'Start date is required for date-based generation' });
        }
        if (!section.end_date) {
          errors.push({ section: sectionPath, field: 'dates', message: 'End date is required for date-based generation' });
        }
      }

      // Check for variable collisions with ancestors
      const sectionVars = new Set([
        ...Object.keys(section.context || {}),
        ...Object.keys(section.counters || {})
      ]);

      const collisions = [...sectionVars].filter(v => ancestorVars.has(v));
      if (collisions.length > 0) {
        errors.push({
          section: sectionPath,
          field: 'variables',
          message: `Variables redefine ancestor variables: ${collisions.join(', ')}. Use unique names (e.g., project_id vs meeting_id)`
        });
      }

      // Recursively validate nested sections
      if (section.nested) {
        const combinedVars = new Set([...ancestorVars, ...sectionVars]);
        section.nested.forEach((nestedSection, nestedIndex) => {
          validateSection(nestedSection, nestedIndex, combinedVars);
        });
      }
    };

    plan.sections.forEach((section, index) => {
      validateSection(section, index);
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
    setSaveSuccess(false);
    try {
      // Normalize order to match section kinds (preserve existing order where possible)
      const sectionKinds = plan.sections.map(s => s.kind).filter(k => k && k.trim().length > 0);
      const orderFiltered = plan.order.filter(k => sectionKinds.includes(k));
      const missing = sectionKinds.filter(k => !orderFiltered.includes(k));

      // Clean up calendar dates - ensure non-empty strings
      const normalizedPlan: Plan = {
        ...plan,
        order: [...orderFiltered, ...missing],
        calendar: {
          ...plan.calendar,
          start_date: plan.calendar.start_date?.trim() || '',
          end_date: plan.calendar.end_date?.trim() || '',
        }
      };

      await onSave(normalizedPlan);

      // Update plan state to normalized version (fixes "double click" issue)
      setPlan(normalizedPlan);

      // Update initial plan JSON after successful save
      setInitialPlanJson(JSON.stringify(normalizedPlan));
      setHasUnsavedChanges(false);

      // Show success feedback for 2 seconds
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">Plan Configuration</h2>
          {hasUnsavedChanges && (
            <span className="px-3 py-1 bg-amber-100 text-amber-800 text-sm font-medium rounded-full border border-amber-300">
              Unsaved Changes
            </span>
          )}
        </div>
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
            disabled={validationErrors.length > 0 || isSaving || !hasUnsavedChanges}
            className={`flex items-center gap-2 transition-colors ${
              saveSuccess
                ? 'bg-green-600 hover:bg-green-700'
                : ''
            }`}
            title={hasUnsavedChanges ? "Save changes (Ctrl+S / Cmd+S)" : "No changes to save"}
          >
            {saveSuccess ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Saved!
              </>
            ) : (
              <>
                <Save size={16} />
                {isSaving ? 'Saving...' : 'Save Plan'}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Unsaved changes reminder */}
      {hasUnsavedChanges && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <AlertCircle size={16} />
            <span>You have unsaved changes. Remember to save before leaving this page.</span>
          </div>
          <span className="text-xs text-amber-600">
            Press <kbd className="px-2 py-1 bg-white border border-amber-300 rounded">Ctrl+S</kbd> to save quickly
          </span>
        </div>
      )}

      {/* Instruction Legend */}
      <InstructionLegend />

      {/* Locale Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Locale Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div>
              <Label htmlFor="pages-per-day">Default Pages per Day</Label>
              <Input
                id="pages-per-day"
                type="number"
                min="1"
                max="10"
                value={plan.calendar.pages_per_day}
                onChange={(e) => handleCalendarChange({ ...plan.calendar, pages_per_day: parseInt(e.target.value) })}
              />
              <p className="text-xs text-gray-500 mt-1">For multi-page daily sections</p>
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
            <CardTitle>Generated Sections Overview (Estimated Pages)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Preview of sections that will be generated in processing order:
            </p>
            <div className="space-y-3">
              {plan.order.map((kind, index) => {
                const section = plan.sections.find(s => s.kind === kind);
                if (!section) return null;

                const { estimatedPages, details } = estimateSectionPages(section);

                return (
                  <div key={kind} className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded border border-blue-200">
                      <div className="flex-1">
                        <div className="font-medium text-blue-900">{index + 1}. {kind}</div>
                        <div className="text-sm text-blue-700">{details}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-blue-900">~{estimatedPages} pages</div>
                        <div className="text-xs text-blue-600">
                          {section.pages_per_item || 1} per item
                        </div>
                      </div>
                    </div>
                    {section.nested && section.nested.length > 0 && (
                      <div className="ml-6 pl-4 border-l-2 border-blue-300 space-y-2">
                        {section.nested.map((nested, ni) => renderNestedOverview(nested, ni, 1))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded text-sm">
              <strong>⚠️ Page Limit:</strong> Maximum 1,000 pages per project.
              Nested sections multiply parent iterations (e.g., 5 projects × 10 meetings = 50 meeting pages).
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};


// Section Editor Component
const SectionEditor: React.FC<{
  section: PlanSection;
  sectionIndex: number;
  availableMasters: ProjectMaster[];
  validationErrors: ValidationError[];
  onChange: (section: PlanSection) => void;
  onDelete: () => void;
  depth?: number;  // Nesting depth (0 = top-level)
}> = ({ section, sectionIndex, availableMasters, validationErrors, onChange, onDelete, depth = 0 }) => {
  const hasErrors = validationErrors.length > 0;
  const maxDepth = 3;
  const canAddNested = depth < maxDepth - 1;

  const handleAddNestedSection = () => {
    const newNestedSection: PlanSection = {
      kind: '',
      master: '',
      generate: GenerateMode.ONCE,
      context: {},
      counters: {}
    };
    onChange({
      ...section,
      nested: [...(section.nested || []), newNestedSection]
    });
  };

  const handleNestedSectionChange = (nestedIndex: number, updatedNested: PlanSection) => {
    const newNested = [...(section.nested || [])];
    newNested[nestedIndex] = updatedNested;
    onChange({ ...section, nested: newNested });
  };

  const handleRemoveNestedSection = (nestedIndex: number) => {
    const newNested = (section.nested || []).filter((_, i) => i !== nestedIndex);
    onChange({ ...section, nested: newNested.length > 0 ? newNested : undefined });
  };

  // Calculate indentation based on depth
  const indentClass = depth > 0 ? `ml-${Math.min(depth * 6, 12)} pl-4 border-l-2 border-blue-300` : '';

  return (
    <div className={indentClass}>
      <Card className={hasErrors ? 'border-red-300' : depth > 0 ? 'border-blue-200' : ''}>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              {depth > 0 && (
                <ChevronRight size={16} className="text-blue-600" />
              )}
              <CardTitle className="text-lg">
                {depth > 0 ? `Nested Section ${sectionIndex + 1}` : `Section ${sectionIndex + 1}`}
                {depth > 0 && <span className="text-xs text-blue-600 ml-2">(Level {depth + 1})</span>}
              </CardTitle>
            </div>
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
            <SelectItem value={GenerateMode.EACH_WEEK}>Each Week - Weekly repetition</SelectItem>
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

        {(section.generate === GenerateMode.EACH_DAY || section.generate === GenerateMode.EACH_WEEK || section.generate === GenerateMode.EACH_MONTH) && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`start-date-${sectionIndex}`}>Start Date</Label>
              <Input
                id={`start-date-${sectionIndex}`}
                type="date"
                value={section.start_date || ''}
                onChange={(e) => onChange({ ...section, start_date: e.target.value })}
                className={validationErrors.some(e => e.field === 'dates') ? 'border-red-300' : ''}
                required
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
                required
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
          <Label>Context Variables (Static)</Label>
          <ContextEditor
            context={section.context || {}}
            onChange={(context) => onChange({ ...section, context })}
          />
          <p className="text-xs text-gray-500 mt-1">
            Static values that remain the same for all pages in this section
          </p>
        </div>

        <div>
          <Label>Counter Variables (Dynamic)</Label>
          <CountersEditor
            counters={section.counters || {}}
            onChange={(counters) => onChange({ ...section, counters })}
          />
          <p className="text-xs text-gray-500 mt-1">
            Variables that increment per generated page. Use {'{counter_name}'} in your widgets.
          </p>
        </div>

        {/* Nested Sections */}
        {canAddNested && (
          <div className="mt-6 pt-4 border-t">
            <div className="flex justify-between items-center mb-4">
              <div>
                <Label className="text-base font-semibold">Nested Sections</Label>
                <p className="text-xs text-gray-500 mt-1">
                  Sections that iterate within each instance of this section (max depth: {maxDepth})
                </p>
              </div>
              <Button
                onClick={handleAddNestedSection}
                size="sm"
                variant="outline"
                className="flex items-center gap-1"
              >
                <Plus size={16} />
                Add Nested
              </Button>
            </div>

            {section.nested && section.nested.length > 0 && (
              <div className="space-y-4">
                {section.nested.map((nestedSection, nestedIndex) => (
                  <SectionEditor
                    key={`nested-${sectionIndex}-${nestedIndex}`}
                    section={nestedSection}
                    sectionIndex={nestedIndex}
                    availableMasters={availableMasters}
                    validationErrors={[]}
                    onChange={(updated) => handleNestedSectionChange(nestedIndex, updated)}
                    onDelete={() => handleRemoveNestedSection(nestedIndex)}
                    depth={depth + 1}
                  />
                ))}
              </div>
            )}

            {(!section.nested || section.nested.length === 0) && (
              <div className="text-center py-4 text-gray-400 text-sm border-2 border-dashed rounded">
                No nested sections. Click "Add Nested" to create hierarchical structure.
              </div>
            )}
          </div>
        )}

        {!canAddNested && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
            ⚠️ Maximum nesting depth ({maxDepth} levels) reached. Cannot add more nested sections.
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
};

// Context Editor Component
const ContextEditor: React.FC<{
  context: Record<string, any>;
  onChange: (context: Record<string, any>) => void;
}> = ({ context, onChange }) => {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [validationError, setValidationError] = useState('');

  // Validate variable name follows Python identifier rules
  const validateVariableName = (name: string): string | null => {
    if (!name.trim()) {
      return 'Variable name cannot be empty';
    }

    // Valid Python identifier: starts with letter or underscore, followed by letters, numbers, or underscores
    const validPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
    if (!validPattern.test(name)) {
      if (name.includes('-')) {
        const suggested = name.replace(/-/g, '_');
        return `Variable name '${name}' contains hyphens. Use underscores instead: '${suggested}'`;
      }
      if (name.includes(' ')) {
        const suggested = name.replace(/\s+/g, '_');
        return `Variable name '${name}' contains spaces. Use underscores instead: '${suggested}'`;
      }
      return `Variable name '${name}' is invalid. Must start with a letter or underscore, followed by letters, numbers, or underscores only.`;
    }

    if (context[name]) {
      return `Variable '${name}' already exists`;
    }

    return null;
  };

  const addContextVariable = () => {
    const trimmedKey = newKey.trim();
    const trimmedValue = newValue.trim();

    if (!trimmedValue) {
      setValidationError('Value cannot be empty');
      return;
    }

    const error = validateVariableName(trimmedKey);
    if (error) {
      setValidationError(error);
      return;
    }

    onChange({ ...context, [trimmedKey]: trimmedValue });
    setNewKey('');
    setNewValue('');
    setValidationError('');
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

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Variable name"
            value={newKey}
            onChange={(e) => {
              setNewKey(e.target.value);
              setValidationError(''); // Clear error when typing
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addContextVariable();
              }
            }}
            className={`flex-1 ${validationError ? 'border-red-300' : ''}`}
          />
          <span>=</span>
          <Input
            placeholder="Value"
            value={newValue}
            onChange={(e) => {
              setNewValue(e.target.value);
              setValidationError(''); // Clear error when typing
            }}
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
        {validationError && (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
            ⚠️ {validationError}
          </div>
        )}
      </div>
    </div>
  );
};

// Counters Editor Component
const CountersEditor: React.FC<{
  counters: Record<string, { start: number; step: number }>;
  onChange: (counters: Record<string, { start: number; step: number }>) => void;
}> = ({ counters, onChange }) => {
  const [newName, setNewName] = useState('');
  const [newStart, setNewStart] = useState('0');
  const [newStep, setNewStep] = useState('1');
  const [validationError, setValidationError] = useState('');

  // Validate counter name follows Python identifier rules
  const validateCounterName = (name: string): string | null => {
    if (!name.trim()) {
      return 'Counter name cannot be empty';
    }

    // Valid Python identifier: starts with letter or underscore, followed by letters, numbers, or underscores
    const validPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
    if (!validPattern.test(name)) {
      if (name.includes('-')) {
        const suggested = name.replace(/-/g, '_');
        return `Counter name '${name}' contains hyphens. Use underscores instead: '${suggested}'`;
      }
      if (name.includes(' ')) {
        const suggested = name.replace(/\s+/g, '_');
        return `Counter name '${name}' contains spaces. Use underscores instead: '${suggested}'`;
      }
      return `Counter name '${name}' is invalid. Must start with a letter or underscore, followed by letters, numbers, or underscores only.`;
    }

    if (counters[name]) {
      return `Counter '${name}' already exists`;
    }

    return null;
  };

  const addCounter = () => {
    const trimmedName = newName.trim();
    const error = validateCounterName(trimmedName);

    if (error) {
      setValidationError(error);
      return;
    }

    const start = parseFloat(newStart) || 0;
    const step = parseFloat(newStep) || 1;
    onChange({ ...counters, [trimmedName]: { start, step } });
    setNewName('');
    setNewStart('0');
    setNewStep('1');
    setValidationError('');
  };

  const removeCounter = (name: string) => {
    const newCounters = { ...counters };
    delete newCounters[name];
    onChange(newCounters);
  };

  const updateCounter = (name: string, field: 'start' | 'step', value: string) => {
    const numValue = parseFloat(value) || 0;
    onChange({
      ...counters,
      [name]: {
        ...counters[name],
        [field]: numValue
      }
    });
  };

  return (
    <div className="space-y-3">
      {Object.entries(counters).map(([name, config]) => (
        <div key={name} className="grid grid-cols-[1fr_auto_80px_auto_80px_auto] gap-2 items-center">
          <Input value={name} disabled />
          <span className="text-xs text-gray-500 whitespace-nowrap">start:</span>
          <Input
            type="number"
            value={config.start}
            onChange={(e) => updateCounter(name, 'start', e.target.value)}
          />
          <span className="text-xs text-gray-500 whitespace-nowrap">step:</span>
          <Input
            type="number"
            value={config.step}
            onChange={(e) => updateCounter(name, 'step', e.target.value)}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeCounter(name)}
            className="text-red-600"
          >
            <Trash2 size={16} />
          </Button>
        </div>
      ))}

      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_auto_80px_auto_80px_auto] gap-2 items-center">
          <Input
            placeholder="Counter name (e.g., page_num)"
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              setValidationError(''); // Clear error when typing
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCounter();
              }
            }}
            className={validationError ? 'border-red-300' : ''}
          />
          <span className="text-xs text-gray-500 whitespace-nowrap">start:</span>
          <Input
            type="number"
            placeholder="0"
            value={newStart}
            onChange={(e) => setNewStart(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCounter();
              }
            }}
          />
          <span className="text-xs text-gray-500 whitespace-nowrap">step:</span>
          <Input
            type="number"
            placeholder="1"
            value={newStep}
            onChange={(e) => setNewStep(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCounter();
              }
            }}
          />
          <Button onClick={addCounter} size="sm">
            <Plus size={16} />
          </Button>
        </div>
        {validationError && (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
            ⚠️ {validationError}
          </div>
        )}
      </div>

      {Object.keys(counters).length === 0 && (
        <div className="text-sm text-gray-500 italic">
          No counters defined. Add counters that increment with each generated page.
        </div>
      )}

      {Object.keys(counters).length > 0 && (
        <div className="text-xs bg-blue-50 p-2 rounded space-y-1">
          <div className="text-blue-600">
            💡 <strong>Example:</strong> Counter "page_num" with start=1, step=1 produces: 1, 2, 3, 4... for each page
          </div>
          <div className="text-green-700">
            ✨ <strong>Auto-navigation:</strong> {'{page_num_prev}'} and {'{page_num_next}'} are automatically available!
          </div>
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
                  <li><code className="bg-gray-100 px-1 rounded">{`{week}`}</code> - ISO week number (1-52/53)</li>
                  <li><code className="bg-gray-100 px-1 rounded">{`{date}`}</code> - Full date (2026-01-15)</li>
                  <li><code className="bg-gray-100 px-1 rounded">{`{date_long}`}</code> - Long format (Wednesday, January 15, 2026)</li>
                  <li><code className="bg-gray-100 px-1 rounded">{`{index}`}</code> - Current instance index</li>
                  <li><code className="bg-gray-100 px-1 rounded">{`{index_padded}`}</code> - Zero-padded index (001, 002, ...)</li>
                </ul>

                {/* Navigation Variables Section */}
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                  <h5 className="font-semibold text-green-800 mb-2">✨ Automatic Navigation Variables</h5>
                  <p className="text-xs text-green-700 mb-2">
                    For all counter and date variables, <code>_prev</code> and <code>_next</code> variants are automatically generated:
                  </p>
                  <ul className="space-y-1 text-xs text-green-700">
                    <li><code className="bg-white px-1 rounded">{`{date_prev}`}</code> - Previous day (date - 1 day)</li>
                    <li><code className="bg-white px-1 rounded">{`{date_next}`}</code> - Next day (date + 1 day)</li>
                    <li><code className="bg-white px-1 rounded">{`{month_prev}`}</code>, <code className="bg-white px-1 rounded">{`{month_next}`}</code> - Previous/next month (wraps at year boundary)</li>
                    <li><code className="bg-white px-1 rounded">{`{week_prev}`}</code>, <code className="bg-white px-1 rounded">{`{week_next}`}</code> - Previous/next week number</li>
                    <li><code className="bg-white px-1 rounded">{`{year_prev}`}</code>, <code className="bg-white px-1 rounded">{`{year_next}`}</code> - Previous/next year</li>
                    <li><code className="bg-white px-1 rounded">{`{counter_prev}`}</code>, <code className="bg-white px-1 rounded">{`{counter_next}`}</code> - For any counter variable</li>
                  </ul>
                  <p className="text-xs text-amber-700 mt-2">
                    ⚠️ Boundary behavior: <code>_prev</code> variables are empty on first page of section, <code>_next</code> are empty on last page of section. When a navigation variable is empty, any link using it is skipped entirely (e.g., <code>month:{`{month_prev}`}</code> creates no link on first month).
                  </p>
                </div>
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
                  <li><strong>Index section:</strong> kind="index", master="Index", generate=ONCE</li>
                  <li><strong>Notes section:</strong> kind="notes_pages", master="NotePage", generate=COUNT, count=10</li>
                  <li><strong>Year section:</strong> kind="year_page", master="Year", generate=ONCE</li>
                  <li><strong>Months section:</strong> kind="month_pages", master="Month", generate=EACH_MONTH</li>
                  <li><strong>Days section:</strong> kind="day_pages", master="Day", generate=EACH_DAY</li>
                </ol>
                <p className="text-xs text-gray-600 mt-2">
                  💡 <strong>Tip:</strong> Define navigation anchors using anchor widgets in your masters (e.g., dest_id="home:index")
                </p>
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
