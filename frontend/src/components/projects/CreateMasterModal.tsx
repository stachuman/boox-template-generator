import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

interface CreateMasterModalProps {
  readonly onClose: () => void;
  readonly onSubmit: (masterName: string) => void;
}

const CreateMasterModal: React.FC<CreateMasterModalProps> = ({ onClose, onSubmit }) => {
  if (!onClose) {
    throw new Error('CreateMasterModal: onClose prop is required');
  }
  if (!onSubmit) {
    throw new Error('CreateMasterModal: onSubmit prop is required');
  }

  const [masterName, setMasterName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus the input when modal opens
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = masterName.trim();

    if (!trimmedName) {
      setError('Master name is required');
      return;
    }

    if (trimmedName.length < 2) {
      setError('Master name must be at least 2 characters long');
      return;
    }

    if (trimmedName.length > 100) {
      setError('Master name must be less than 100 characters');
      return;
    }

    // Strict validation for safe filename characters only
    const validChars = /^[a-zA-Z0-9\s\-_.()]+$/;
    if (!validChars.test(trimmedName)) {
      setError('Master name can only contain letters, numbers, spaces, hyphens, underscores, periods, and parentheses');
      return;
    }

    // Prevent names that are only whitespace or special characters
    const hasAlphanumeric = /[a-zA-Z0-9]/.test(trimmedName);
    if (!hasAlphanumeric) {
      setError('Master name must contain at least one letter or number');
      return;
    }

    onSubmit(trimmedName);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4" onKeyDown={handleKeyDown}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-eink-black">Create New Master</h2>
          <button
            onClick={onClose}
            className="text-eink-light-gray hover:text-eink-dark-gray transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="masterName" className="block text-sm font-medium text-eink-black mb-1">
              Master Name *
            </label>
            <input
              ref={inputRef}
              type="text"
              id="masterName"
              value={masterName}
              onChange={(e) => {
                setMasterName(e.target.value);
                if (error) setError(null); // Clear error when user types
              }}
              className="w-full px-3 py-2 border border-eink-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-eink-black focus:border-transparent"
              placeholder="Enter master template name"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-eink-light-gray text-eink-dark-gray rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!masterName.trim()}
              className="flex-1 px-4 py-2 bg-eink-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Master
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateMasterModal;