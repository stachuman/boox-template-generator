/**
 * Page management panel for multi-page templates.
 * 
 * Provides controls to add, delete, navigate, and manage pages.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Copy, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { useEditorStore } from '@/stores/editorStore';
import BatchPageModal from './BatchPageModal';

const PageManager: React.FC = () => {
  const [isAddDropdownOpen, setIsAddDropdownOpen] = useState(false);
  const [isDuplicateDropdownOpen, setIsDuplicateDropdownOpen] = useState(false);
  const [batchModalState, setBatchModalState] = useState<{
    isOpen: boolean;
    mode: 'add' | 'duplicate';
  }>({ isOpen: false, mode: 'add' });

  const addDropdownRef = useRef<HTMLDivElement>(null);
  const duplicateDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addDropdownRef.current && !addDropdownRef.current.contains(event.target as Node)) {
        setIsAddDropdownOpen(false);
      }
      if (duplicateDropdownRef.current && !duplicateDropdownRef.current.contains(event.target as Node)) {
        setIsDuplicateDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const {
    currentPage,
    totalPages,
    setCurrentPage,
    addPage,
    addPages,
    deletePage,
    duplicatePage,
    duplicatePages,
    getWidgetsForCurrentPage,
    getWidgetsForPage,
    currentTemplate,
    addMaster,
    removeMaster,
    renameMaster,
    assignMasterToPage,
    getAssignedMasterForPage,
  } = useEditorStore();

  const [newMasterName, setNewMasterName] = useState('Header/Footer');
  const masters = currentTemplate?.masters || [];
  const assignedMasterId = getAssignedMasterForPage(currentPage);

  const handleAddPage = () => {
    addPage();
    setIsAddDropdownOpen(false);
  };

  const handleAddMultiplePages = () => {
    setBatchModalState({ isOpen: true, mode: 'add' });
    setIsAddDropdownOpen(false);
  };

  const handleDeletePage = () => {
    if (totalPages <= 1) return;
    if (confirm(`Delete page ${currentPage}? All widgets on this page will be removed.`)) {
      deletePage(currentPage);
    }
  };

  const handleDuplicatePage = () => {
    const widgetCount = getWidgetsForCurrentPage().length;
    if (confirm(`Duplicate page ${currentPage} with ${widgetCount} widget(s)?`)) {
      duplicatePage(currentPage);
    }
    setIsDuplicateDropdownOpen(false);
  };

  const handleDuplicateMultiplePages = () => {
    setBatchModalState({ isOpen: true, mode: 'duplicate' });
    setIsDuplicateDropdownOpen(false);
  };

  const handleBatchAddPages = (count: number) => {
    addPages(count);
  };

  const handleBatchDuplicatePages = (sourcePageNumber: number, count: number) => {
    duplicatePages(sourcePageNumber, count);
  };

  const closeBatchModal = () => {
    setBatchModalState({ isOpen: false, mode: 'add' });
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  return (
    <div className="w-64 border-r border-eink-pale-gray bg-eink-white flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-eink-pale-gray">
        <h3 className="font-semibold text-sm">Pages</h3>
        <p className="text-xs text-eink-gray">Manage template pages</p>
      </div>

      {/* Page Navigation */}
      <div className="p-3 border-b border-eink-pale-gray">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            Page {currentPage} of {totalPages}
          </span>
        </div>
        
        <div className="flex items-center space-x-1">
          <button
            onClick={handlePreviousPage}
            disabled={currentPage <= 1}
            className={clsx(
              "p-1 rounded",
              currentPage <= 1
                ? "text-eink-light-gray cursor-not-allowed"
                : "text-eink-dark-gray hover:bg-eink-pale-gray"
            )}
            title="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <div className="flex-1 text-center">
            <input
              type="number"
              min="1"
              max={totalPages}
              value={currentPage}
              onChange={(e) => {
                const page = parseInt(e.target.value);
                if (page >= 1 && page <= totalPages) {
                  setCurrentPage(page);
                }
              }}
              className="w-12 text-center text-sm border border-eink-pale-gray rounded px-1 py-0.5"
            />
          </div>
          
          <button
            onClick={handleNextPage}
            disabled={currentPage >= totalPages}
            className={clsx(
              "p-1 rounded",
              currentPage >= totalPages
                ? "text-eink-light-gray cursor-not-allowed"
                : "text-eink-dark-gray hover:bg-eink-pale-gray"
            )}
            title="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Page Actions */}
      <div className="p-3 space-y-2">
        {/* Add Page Dropdown */}
        <div className="relative" ref={addDropdownRef}>
          <div className="flex">
            <button
              onClick={handleAddPage}
              className="flex-1 flex items-center space-x-2 px-3 py-2 text-sm bg-eink-pale-gray hover:bg-eink-light-gray rounded-l transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Page</span>
            </button>
            <button
              onClick={() => setIsAddDropdownOpen(!isAddDropdownOpen)}
              className="px-2 py-2 bg-eink-pale-gray hover:bg-eink-light-gray border-l border-eink-light-gray rounded-r transition-colors"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
          
          {isAddDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-eink-pale-gray rounded shadow-lg z-10">
              <button
                onClick={handleAddPage}
                className="w-full text-left px-3 py-2 text-sm hover:bg-eink-pale-gray border-b border-eink-pale-gray"
              >
                Add 1 Page
              </button>
              <button
                onClick={handleAddMultiplePages}
                className="w-full text-left px-3 py-2 text-sm hover:bg-eink-pale-gray"
              >
                Add Multiple Pages...
              </button>
            </div>
          )}
        </div>
        
        {/* Duplicate Page Dropdown */}
        <div className="relative" ref={duplicateDropdownRef}>
          <div className="flex">
            <button
              onClick={handleDuplicatePage}
              className="flex-1 flex items-center space-x-2 px-3 py-2 text-sm border border-eink-pale-gray hover:bg-eink-pale-gray rounded-l transition-colors"
            >
              <Copy className="w-4 h-4" />
              <span>Duplicate Page</span>
            </button>
            <button
              onClick={() => setIsDuplicateDropdownOpen(!isDuplicateDropdownOpen)}
              className="px-2 py-2 border border-l-0 border-eink-pale-gray hover:bg-eink-pale-gray rounded-r transition-colors"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
          
          {isDuplicateDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-eink-pale-gray rounded shadow-lg z-10">
              <button
                onClick={handleDuplicatePage}
                className="w-full text-left px-3 py-2 text-sm hover:bg-eink-pale-gray border-b border-eink-pale-gray"
              >
                Duplicate Current Page
              </button>
              <button
                onClick={handleDuplicateMultiplePages}
                className="w-full text-left px-3 py-2 text-sm hover:bg-eink-pale-gray"
              >
                Duplicate Multiple Times...
              </button>
            </div>
          )}
        </div>
        
        <button
          onClick={handleDeletePage}
          disabled={totalPages <= 1}
          className={clsx(
            "w-full flex items-center space-x-2 px-3 py-2 text-sm rounded transition-colors",
            totalPages <= 1
              ? "text-eink-light-gray cursor-not-allowed border border-eink-pale-gray"
              : "text-red-600 border border-red-200 hover:bg-red-50"
          )}
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete Page</span>
        </button>
      </div>

      {/* Master Assignment */}
      <div className="p-3 border-b border-eink-pale-gray">
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm font-medium">Master for this page</div>
            <button
              className="text-xs text-eink-gray hover:text-eink-black"
              onClick={() => {
                const id = addMaster(newMasterName.trim() || 'Master');
                assignMasterToPage(currentPage, id);
              }}
              title="Quick add a master and assign to this page"
            >
              + New
            </button>
          </div>
          <select
            className="input-field w-full text-sm"
            value={assignedMasterId || ''}
            onChange={(e) => assignMasterToPage(currentPage, e.target.value || null)}
          >
            <option value="">None</option>
            {masters.map(m => (
              <option key={m.id} value={m.id}>{m.name || m.id}</option>
            ))}
          </select>
        </div>
        <div className="mt-2">
          <div className="text-sm font-medium mb-1">Masters</div>
          <div className="space-y-2">
            {masters.length === 0 && (
              <div className="text-xs text-eink-light-gray">No masters yet</div>
            )}
            {masters.map((m) => (
              <div key={m.id} className="flex items-center space-x-2">
                <input
                  className="input-field text-xs flex-1"
                  value={m.name || ''}
                  onChange={(e) => renameMaster(m.id, e.target.value)}
                />
                <button
                  className="text-xs text-red-600 hover:text-red-800"
                  title="Delete master"
                  onClick={() => {
                    if (confirm('Delete this master? Assigned pages will revert to None.')) removeMaster(m.id);
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center space-x-2 mt-2">
            <input
              className="input-field text-xs flex-1"
              placeholder="New master name"
              value={newMasterName}
              onChange={(e) => setNewMasterName(e.target.value)}
            />
            <button
              className="btn-secondary text-xs"
              onClick={() => {
                const id = addMaster(newMasterName.trim() || 'Master');
                setNewMasterName('Header/Footer');
                assignMasterToPage(currentPage, id);
              }}
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Page List */}
      <div className="flex-1 overflow-auto p-3">
        <div className="space-y-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
            const widgetCount = pageNum === currentPage 
              ? getWidgetsForCurrentPage().length 
              : getWidgetsForPage(pageNum).length;
            const isCurrentPage = pageNum === currentPage;
            
            return (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={clsx(
                  "w-full text-left px-2 py-2 rounded text-sm transition-colors",
                  isCurrentPage
                    ? "bg-eink-dark-gray text-white"
                    : "hover:bg-eink-pale-gray"
                )}
              >
                <div className="flex justify-between items-center">
                  <span>Page {pageNum}</span>
                  <span className={clsx(
                    "text-xs",
                    isCurrentPage ? "opacity-75" : "text-eink-gray"
                  )}>
                    {widgetCount} widget{widgetCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-eink-pale-gray text-xs text-eink-light-gray">
        <p>• Click page to switch</p>
        <p>• Use dropdown for batch operations</p>
        <p>• Delete removes all widgets</p>
      </div>

      {/* Batch Page Modal */}
      <BatchPageModal
        isOpen={batchModalState.isOpen}
        mode={batchModalState.mode}
        currentPage={currentPage}
        totalPages={totalPages}
        widgetCount={getWidgetsForCurrentPage().length}
        onClose={closeBatchModal}
        onAddPages={handleBatchAddPages}
        onDuplicatePages={handleBatchDuplicatePages}
      />
    </div>
  );
};

export default PageManager;
