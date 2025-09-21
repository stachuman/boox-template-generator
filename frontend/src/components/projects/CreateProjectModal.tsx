import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { CreateProjectRequest, DeviceProfile } from '@/types';
import { APIClient } from '@/services/api';

interface CreateProjectModalProps {
  onClose: () => void;
  onSubmit: (request: CreateProjectRequest) => Promise<void>;
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState<CreateProjectRequest>({
    name: '',
    description: '',
    device_profile: 'boox-note-air-4c',
    author: '',
    category: 'planner'
  });
  const [profiles, setProfiles] = useState<DeviceProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profilesLoading, setProfilesLoading] = useState(true);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      setProfilesLoading(true);
      const profileList = await APIClient.getProfiles();
      setProfiles(profileList);
      if (profileList.length > 0) {
        setFormData(prev => ({ ...prev, device_profile: profileList[0].name }));
      }
    } catch (err: any) {
      console.error('Failed to load device profiles:', err);
    } finally {
      setProfilesLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Project name is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSubmit(formData);
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof CreateProjectRequest, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-eink-black">Create New Project</h2>
          <button
            onClick={onClose}
            className="text-eink-light-gray hover:text-eink-dark-gray transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-eink-black mb-1">
              Project Name *
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-eink-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-eink-black focus:border-transparent"
              placeholder="Enter project name"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-eink-black mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-eink-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-eink-black focus:border-transparent"
              placeholder="Describe your project (optional)"
            />
          </div>

          <div>
            <label htmlFor="device_profile" className="block text-sm font-medium text-eink-black mb-1">
              Device Profile
            </label>
            {profilesLoading ? (
              <div className="text-sm text-eink-dark-gray">Loading profiles...</div>
            ) : (
              <select
                id="device_profile"
                value={formData.device_profile}
                onChange={(e) => handleInputChange('device_profile', e.target.value)}
                className="w-full px-3 py-2 border border-eink-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-eink-black focus:border-transparent"
              >
                {profiles.map((profile) => (
                  <option key={profile.name} value={profile.name}>
                    {profile.name} ({profile.display.screen_size[0]}×{profile.display.screen_size[1]})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label htmlFor="author" className="block text-sm font-medium text-eink-black mb-1">
              Author
            </label>
            <input
              type="text"
              id="author"
              value={formData.author}
              onChange={(e) => handleInputChange('author', e.target.value)}
              className="w-full px-3 py-2 border border-eink-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-eink-black focus:border-transparent"
              placeholder="Your name (optional)"
            />
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-eink-black mb-1">
              Category
            </label>
            <select
              id="category"
              value={formData.category}
              onChange={(e) => handleInputChange('category', e.target.value)}
              className="w-full px-3 py-2 border border-eink-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-eink-black focus:border-transparent"
            >
              <option value="planner">Planner</option>
              <option value="notebook">Notebook</option>
              <option value="calendar">Calendar</option>
              <option value="journal">Journal</option>
              <option value="forms">Forms</option>
              <option value="other">Other</option>
            </select>
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
              disabled={loading || !formData.name.trim()}
              className="flex-1 px-4 py-2 bg-eink-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProjectModal;