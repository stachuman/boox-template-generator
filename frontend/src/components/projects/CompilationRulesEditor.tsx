import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Project, CompilationRule, RepeatMode, UpdateCompilationRulesRequest } from '@/types';
import { APIClient } from '@/services/api';

const CompilationRulesEditor: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [rules, setRules] = useState<CompilationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projectId) {
      loadProject();
    }
  }, [projectId]);

  const loadProject = async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      setError(null);
      const projectData = await APIClient.getProject(projectId);
      setProject(projectData);
      setRules([...projectData.compilation_rules].sort((a, b) => a.order - b.order));
    } catch (err: any) {
      setError(err.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const createNewRule = (): CompilationRule => {
    const maxOrder = rules.length > 0 ? Math.max(...rules.map(r => r.order)) : 0;
    return {
      page_name: project?.pages[0]?.name || '',
      repeat_mode: 'once',
      context_rules: {},
      order: maxOrder + 1
    };
  };

  const addRule = () => {
    setRules(prev => [...prev, createNewRule()]);
  };

  const removeRule = (index: number) => {
    setRules(prev => prev.filter((_, i) => i !== index));
  };

  const updateRule = (index: number, updates: Partial<CompilationRule>) => {
    setRules(prev => prev.map((rule, i) => i === index ? { ...rule, ...updates } : rule));
  };

  const moveRule = (index: number, direction: 'up' | 'down') => {
    setRules(prev => {
      const newRules = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;

      if (targetIndex >= 0 && targetIndex < newRules.length) {
        [newRules[index], newRules[targetIndex]] = [newRules[targetIndex], newRules[index]];

        // Update order values
        newRules.forEach((rule, i) => {
          rule.order = i + 1;
        });
      }

      return newRules;
    });
  };

  const handleSave = async () => {
    if (!project) return;

    try {
      setSaving(true);
      setError(null);

      // Validate rules
      for (const rule of rules) {
        if (!rule.page_name) {
          throw new Error('All rules must have a page name');
        }
        if (rule.repeat_mode === 'count' && (!rule.count || rule.count <= 0)) {
          throw new Error('Count repeat mode requires a valid count value');
        }
        if (['each_day', 'each_week', 'each_month'].includes(rule.repeat_mode)) {
          if (!rule.start_date) {
            throw new Error(`${rule.repeat_mode} repeat mode requires a start date`);
          }
        }
      }

      const request: UpdateCompilationRulesRequest = {
        rules: rules.map((rule, index) => ({
          ...rule,
          order: index + 1
        }))
      };

      const updatedProject = await APIClient.updateCompilationRules(project.id, request);
      setProject(updatedProject);

      // Navigate back to project editor
      navigate(`/projects/${project.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to save compilation rules');
    } finally {
      setSaving(false);
    }
  };

  const repeatModeOptions: { value: RepeatMode; label: string; description: string }[] = [
    { value: 'once', label: 'Once', description: 'Generate single page' },
    { value: 'each_day', label: 'Each Day', description: 'One page per day in date range' },
    { value: 'each_week', label: 'Each Week', description: 'One page per ISO week' },
    { value: 'each_month', label: 'Each Month', description: 'One page per month' },
    { value: 'count', label: 'Count', description: 'Generate specified number of pages' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-eink-dark-gray">Loading compilation rules...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-eink-dark-gray mb-2">Project not found</h3>
          <button
            onClick={() => navigate('/projects')}
            className="px-4 py-2 bg-eink-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/projects/${project.id}`)}
            className="text-eink-dark-gray hover:text-eink-black transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-eink-black">Compilation Rules</h1>
            <p className="text-eink-dark-gray mt-1">
              Configure how named pages are repeated and linked
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={addRule}
            disabled={project.pages.length === 0}
            className="flex items-center gap-2 px-4 py-2 border border-eink-light-gray text-eink-black rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-5 h-5" />
            Add Rule
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-eink-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Rules'}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Project Info */}
      <div className="mb-6 p-4 bg-gray-50 border border-eink-light-gray rounded-lg">
        <h3 className="font-semibold text-eink-black mb-2">{project.metadata.name}</h3>
        <p className="text-sm text-eink-dark-gray mb-3">
          Available named pages: {project.pages.map(p => p.name).join(', ') || 'None'}
        </p>
        {project.pages.length === 0 && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-sm">
              No named pages found. Create pages first before setting up compilation rules.
            </p>
          </div>
        )}
      </div>

      {/* Rules List */}
      {rules.length === 0 ? (
        <div className="text-center py-12 border border-eink-light-gray rounded-lg">
          <h3 className="text-lg font-medium text-eink-dark-gray mb-2">No compilation rules</h3>
          <p className="text-eink-dark-gray mb-4">
            Add rules to define how your named pages should be repeated in the final PDF
          </p>
          <button
            onClick={addRule}
            disabled={project.pages.length === 0}
            className="px-4 py-2 bg-eink-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add First Rule
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {rules.map((rule, index) => (
            <div key={index} className="bg-white border border-eink-light-gray rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-semibold text-eink-black">
                  Rule {index + 1}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => moveRule(index, 'up')}
                    disabled={index === 0}
                    className="text-eink-dark-gray hover:text-eink-black disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveRule(index, 'down')}
                    disabled={index === rules.length - 1}
                    className="text-eink-dark-gray hover:text-eink-black disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => removeRule(index)}
                    className="text-red-600 hover:text-red-800 transition-colors"
                    title="Delete rule"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Page Name */}
                <div>
                  <label className="block text-sm font-medium text-eink-black mb-1">
                    Named Page *
                  </label>
                  <select
                    value={rule.page_name}
                    onChange={(e) => updateRule(index, { page_name: e.target.value })}
                    className="w-full px-3 py-2 border border-eink-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-eink-black focus:border-transparent"
                    required
                  >
                    <option value="">Select a page</option>
                    {project.pages.map((page) => (
                      <option key={page.name} value={page.name}>
                        {page.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Repeat Mode */}
                <div>
                  <label className="block text-sm font-medium text-eink-black mb-1">
                    Repeat Mode *
                  </label>
                  <select
                    value={rule.repeat_mode}
                    onChange={(e) => updateRule(index, { repeat_mode: e.target.value as RepeatMode })}
                    className="w-full px-3 py-2 border border-eink-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-eink-black focus:border-transparent"
                    required
                  >
                    {repeatModeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} - {option.description}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date Range for date-based repeat modes */}
                {['each_day', 'each_week', 'each_month'].includes(rule.repeat_mode) && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-eink-black mb-1">
                        Start Date *
                      </label>
                      <input
                        type="date"
                        value={rule.start_date || ''}
                        onChange={(e) => updateRule(index, { start_date: e.target.value })}
                        className="w-full px-3 py-2 border border-eink-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-eink-black focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-eink-black mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={rule.end_date || ''}
                        onChange={(e) => updateRule(index, { end_date: e.target.value })}
                        className="w-full px-3 py-2 border border-eink-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-eink-black focus:border-transparent"
                      />
                    </div>
                  </>
                )}

                {/* Count for count repeat mode */}
                {rule.repeat_mode === 'count' && (
                  <div>
                    <label className="block text-sm font-medium text-eink-black mb-1">
                      Count *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={rule.count || ''}
                      onChange={(e) => updateRule(index, { count: parseInt(e.target.value) || undefined })}
                      className="w-full px-3 py-2 border border-eink-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-eink-black focus:border-transparent"
                      placeholder="Number of pages to generate"
                      required
                    />
                  </div>
                )}
              </div>

              {/* Context Rules */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-eink-black mb-1">
                  Context Rules (Advanced)
                </label>
                <p className="text-xs text-eink-dark-gray mb-2">
                  Additional token substitutions as JSON. Example: {`{"custom_token": "value"}`}
                </p>
                <textarea
                  value={JSON.stringify(rule.context_rules, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      updateRule(index, { context_rules: parsed });
                    } catch {
                      // Invalid JSON, keep as string for now
                    }
                  }}
                  rows={3}
                  className="w-full px-3 py-2 border border-eink-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-eink-black focus:border-transparent text-sm font-mono"
                  placeholder="{}"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Help Text */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-semibold text-blue-900 mb-2">Available Tokens</h4>
        <div className="text-sm text-blue-800 grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <strong>Date-based:</strong> {`{date}, {date_long}, {year}, {month}, {month_name}, {day}`}
          </div>
          <div>
            <strong>Sequence-based:</strong> {`{index}, {index_padded}, {total}`}
          </div>
        </div>
        <p className="text-sm text-blue-800 mt-2">
          These tokens will be replaced with actual values when the project is compiled.
        </p>
      </div>
    </div>
  );
};

export default CompilationRulesEditor;