/**
 * Link list data editor modal.
 *
 * Provides a dedicated interface for editing link labels and destinations.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, MoveUp, MoveDown } from 'lucide-react';

interface LinkListEditorModalProps {
  isOpen: boolean;
  labels: string[];
  destinations: string[];
  onClose: () => void;
  onSave: (labels: string[], destinations: string[]) => void;
}

const LinkListEditorModal: React.FC<LinkListEditorModalProps> = ({
  isOpen,
  labels,
  destinations,
  onClose,
  onSave
}) => {
  const [draftLabels, setDraftLabels] = useState<string[]>([]);
  const [draftDestinations, setDraftDestinations] = useState<string[]>([]);

  // Initialize draft state when modal opens
  useEffect(() => {
    if (isOpen) {
      setDraftLabels([...labels]);
      setDraftDestinations([...destinations]);
    }
  }, [isOpen, labels, destinations]);

  const handleLabelChange = (index: number, value: string) => {
    const newLabels = [...draftLabels];
    newLabels[index] = value;
    setDraftLabels(newLabels);
  };

  const handleDestinationChange = (index: number, value: string) => {
    const newDestinations = [...draftDestinations];
    newDestinations[index] = value;
    setDraftDestinations(newDestinations);
  };

  const handleAddItem = () => {
    setDraftLabels([...draftLabels, '']);
    setDraftDestinations([...draftDestinations, '']);
  };

  const handleRemoveItem = (index: number) => {
    setDraftLabels(draftLabels.filter((_, i) => i !== index));
    setDraftDestinations(draftDestinations.filter((_, i) => i !== index));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;

    const newLabels = [...draftLabels];
    const newDestinations = [...draftDestinations];

    [newLabels[index - 1], newLabels[index]] = [newLabels[index], newLabels[index - 1]];
    [newDestinations[index - 1], newDestinations[index]] = [newDestinations[index], newDestinations[index - 1]];

    setDraftLabels(newLabels);
    setDraftDestinations(newDestinations);
  };

  const handleMoveDown = (index: number) => {
    if (index === draftLabels.length - 1) return;

    const newLabels = [...draftLabels];
    const newDestinations = [...draftDestinations];

    [newLabels[index], newLabels[index + 1]] = [newLabels[index + 1], newLabels[index]];
    [newDestinations[index], newDestinations[index + 1]] = [newDestinations[index + 1], newDestinations[index]];

    setDraftLabels(newLabels);
    setDraftDestinations(newDestinations);
  };

  const handleApply = () => {
    onSave(draftLabels, draftDestinations);
  };

  if (!isOpen) return null;

  const hasLengthMismatch = draftLabels.length !== draftDestinations.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white w-[800px] max-w-[95vw] max-h-[90vh] rounded shadow-lg flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Edit Link List</h3>
            <p className="text-xs text-eink-gray mt-1">
              Define labels and destinations for each link. Use tokens like {'{year}'}, {'{month}'}, {'{index}'} for dynamic values.
            </p>
          </div>
          <button
            type="button"
            className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-auto">
          <div className="space-y-2">
            {/* Header row */}
            <div className="grid grid-cols-[40px_1fr_1fr_80px] gap-2 text-xs font-medium text-gray-600 mb-2">
              <div className="text-center">#</div>
              <div>Label</div>
              <div>Destination</div>
              <div className="text-center">Actions</div>
            </div>

            {/* Data rows */}
            {draftLabels.map((label, index) => (
              <div key={index} className="grid grid-cols-[40px_1fr_1fr_80px] gap-2 items-center">
                <div className="text-center text-sm text-gray-500">{index + 1}</div>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => handleLabelChange(index, e.target.value)}
                  placeholder="Label (e.g., Jan, Note 1)"
                  className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <input
                  type="text"
                  value={draftDestinations[index] || ''}
                  onChange={(e) => handleDestinationChange(index, e.target.value)}
                  placeholder="Destination (e.g., month:2026-01)"
                  className="px-2 py-1.5 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <div className="flex items-center justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className="p-1 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    <MoveUp size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === draftLabels.length - 1}
                    className="p-1 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    <MoveDown size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}

            {/* Add button */}
            <button
              type="button"
              onClick={handleAddItem}
              className="w-full py-2 border-2 border-dashed border-gray-300 rounded hover:border-blue-400 hover:bg-blue-50 text-sm text-gray-600 hover:text-blue-600 flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              Add Link
            </button>
          </div>

          {/* Info/Warning */}
          <div className="mt-4 space-y-2">
            {hasLengthMismatch && (
              <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
                ⚠️ Warning: {draftLabels.length} labels but {draftDestinations.length} destinations. Arrays must have the same length!
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
              <strong>💡 Tips:</strong>
              <ul className="mt-1 ml-4 list-disc text-xs space-y-1">
                <li>Use tokens like <code className="bg-white px-1">{'{year}'}</code>, <code className="bg-white px-1">{'{month}'}</code>, <code className="bg-white px-1">{'{index}'}</code> for dynamic values</li>
                <li>Destination format: <code className="bg-white px-1">prefix:value</code> (e.g., <code className="bg-white px-1">month:2026-01</code>)</li>
                <li>Links will be rendered in the order shown above</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {draftLabels.length} link{draftLabels.length !== 1 ? 's' : ''} defined
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              className="px-4 py-2 border rounded hover:bg-gray-50"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleApply}
              disabled={hasLengthMismatch}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LinkListEditorModal;
