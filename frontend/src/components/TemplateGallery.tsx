/**
 * Template gallery component for browsing and managing templates.
 * 
 * Displays saved templates with thumbnails and management actions.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FileText, Calendar, Trash2, Edit3 } from 'lucide-react';
import { APIClient, APIClientError } from '@/services/api';
import { TemplateResponse } from '@/types';

const TemplateGallery: React.FC = () => {
  const [templates, setTemplates] = useState<TemplateResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await APIClient.getTemplates();
      setTemplates(response.templates);
    } catch (err) {
      if (err instanceof APIClientError) {
        setError(err.apiError.message);
      } else {
        setError('Failed to load templates');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      await APIClient.deleteTemplate(templateId);
      setTemplates(prev => prev.filter(t => t.id !== templateId));
    } catch (err) {
      if (err instanceof APIClientError) {
        alert(`Failed to delete template: ${err.apiError.message}`);
      } else {
        alert('Failed to delete template');
      }
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-eink-black border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-eink-gray">Loading templates...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <FileText className="w-12 h-12 text-eink-light-gray mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Error Loading Templates</h2>
          <p className="text-eink-gray mb-4">{error}</p>
          <button
            onClick={loadTemplates}
            className="btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="toolbar flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Template Gallery</h2>
          <p className="text-sm text-eink-gray">{templates.length} templates</p>
        </div>
        <Link to="/editor" className="btn-primary flex items-center space-x-2">
          <Plus className="w-4 h-4" />
          <span>New Template</span>
        </Link>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {templates.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-eink-light-gray mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Templates Yet</h3>
            <p className="text-eink-gray mb-6">
              Create your first template to get started with PDF generation.
            </p>
            <Link to="/editor" className="btn-primary inline-flex items-center space-x-2">
              <Plus className="w-4 h-4" />
              <span>Create Template</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {templates.map((template) => (
              <div key={template.id} className="card p-4 hover:shadow-md transition-shadow">
                {/* Template Preview Placeholder */}
                <div className="aspect-[8.5/11] bg-eink-pale-gray rounded mb-3 flex items-center justify-center">
                  <FileText className="w-8 h-8 text-eink-gray" />
                </div>

                {/* Template Info */}
                <div className="space-y-2">
                  <h3 className="font-medium truncate" title={template.name}>
                    {template.name}
                  </h3>
                  
                  {template.description && (
                    <p className="text-sm text-eink-gray line-clamp-2" title={template.description}>
                      {template.description}
                    </p>
                  )}

                  <div className="flex items-center space-x-4 text-xs text-eink-light-gray">
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(template.created_at)}</span>
                    </div>
                  </div>

                  <div className="text-xs text-eink-light-gray">
                    Profile: {template.profile}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-eink-pale-gray">
                  <Link
                    to={`/editor/${template.id}`}
                    className="btn-secondary text-xs flex items-center space-x-1"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Edit</span>
                  </Link>
                  
                  <button
                    onClick={() => handleDeleteTemplate(template.id)}
                    className="text-red-600 hover:text-red-800 p-1 rounded"
                    title="Delete template"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplateGallery;