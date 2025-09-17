/**
 * Modal dialog for batch page operations.
 * 
 * Provides UI for creating multiple pages or duplicating pages in batch.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React, { useState } from 'react';
import { X, Plus, Copy } from 'lucide-react';
import clsx from 'clsx';

interface BatchPageModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'add' | 'duplicate';
  currentPage: number;
  totalPages: number;
  widgetCount: number;
  onAddPages: (count: number) => void;
  onDuplicatePages: (sourcePageNumber: number, count: number) => void;
}

const BatchPageModal: React.FC<BatchPageModalProps> = ({
  isOpen,
  onClose,
  mode,
  currentPage,
  totalPages,
  widgetCount,
  onAddPages,
  onDuplicatePages
}) => {
  const [pageCount, setPageCount] = useState(1);
  const [sourcePageNumber, setSourcePageNumber] = useState(currentPage);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (pageCount < 1 || pageCount > (mode === 'add' ? 100 : 50)) {
      return;
    }

    setIsProcessing(true);
    
    try {
      if (mode === 'add') {
        onAddPages(pageCount);
      } else {
        if (sourcePageNumber < 1 || sourcePageNumber > totalPages) {
          throw new Error(`Invalid source page number`);
        }
        onDuplicatePages(sourcePageNumber, pageCount);
      }
      onClose();
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setPageCount(1);
      setSourcePageNumber(currentPage);
      onClose();
    }
  };

  const maxPages = mode === 'add' ? 100 : 50;
  const isValidPageCount = pageCount >= 1 && pageCount <= maxPages;
  const isValidSourcePage = sourcePageNumber >= 1 && sourcePageNumber <= totalPages;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-full">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold flex items-center space-x-2">
            {mode === 'add' ? <Plus className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            <span>{mode === 'add' ? 'Add Pages' : 'Duplicate Pages'}</span>
          </h2>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Source Page Selection (Duplicate mode only) */}
          {mode === 'duplicate' && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Source Page to Duplicate
              </label>
              <select
                value={sourcePageNumber}
                onChange={(e) => setSourcePageNumber(parseInt(e.target.value))}
                disabled={isProcessing}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <option key={pageNum} value={pageNum}>
                    Page {pageNum}
                    {pageNum === currentPage ? ' (current)' : ''}
                  </option>
                ))}
              </select>
              {mode === 'duplicate' && isValidSourcePage && (
                <p className="text-xs text-gray-600 mt-1">
                  Contains {widgetCount} widget{widgetCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}

          {/* Page Count */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Number of Pages to {mode === 'add' ? 'Add' : 'Create'}
            </label>
            <input
              type="number"
              min="1"
              max={maxPages}
              value={pageCount}
              onChange={(e) => setPageCount(parseInt(e.target.value) || 1)}
              disabled={isProcessing}
              className={clsx(
                "w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                isValidPageCount ? "border-gray-300" : "border-red-300"
              )}
              placeholder={`1-${maxPages}`}
            />
            <p className="text-xs text-gray-600 mt-1">
              Maximum: {maxPages} pages per operation
            </p>
            {!isValidPageCount && (
              <p className="text-xs text-red-600 mt-1">
                Please enter a number between 1 and {maxPages}
              </p>
            )}
          </div>

          {/* Preview */}
          <div className="mb-6 p-3 bg-gray-50 rounded-md">
            <p className="text-sm font-medium mb-1">Preview:</p>
            <p className="text-sm text-gray-600">
              {mode === 'add' 
                ? `${pageCount} new blank page${pageCount !== 1 ? 's' : ''} will be added`
                : `Page ${sourcePageNumber} will be duplicated ${pageCount} time${pageCount !== 1 ? 's' : ''}`
              }
            </p>
            <p className="text-xs text-gray-500 mt-1">
              New total: {totalPages + pageCount} pages
            </p>
          </div>

          {/* Actions */}
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isProcessing}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing || !isValidPageCount || (mode === 'duplicate' && !isValidSourcePage)}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Processing...' : (mode === 'add' ? 'Add Pages' : 'Duplicate Pages')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BatchPageModal;