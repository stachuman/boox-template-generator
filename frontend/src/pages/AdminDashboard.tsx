/**
 * Admin Dashboard - Main admin panel for user and project management.
 * Following CLAUDE.md - no dummy implementations.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, FolderOpen, KeyRound, LogIn } from 'lucide-react';
import { useAuth } from '@/auth/useAuth';
import { AdminAPI, UserStats, UserProjectsResponse } from '@/services/adminApi';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [users, setUsers] = useState<UserStats[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userProjects, setUserProjects] = useState<UserProjectsResponse | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);

  // Check if user is admin
  useEffect(() => {
    if (!user?.is_admin) {
      navigate('/projects');
    }
  }, [user, navigate]);

  // Load users
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await AdminAPI.listUsers(0, 100);
      setUsers(data.users);
      setTotalUsers(data.total);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const loadUserProjects = async (userId: string) => {
    try {
      setLoadingProjects(true);
      setSelectedUserId(userId);
      setError(null);
      const data = await AdminAPI.getUserProjects(userId);
      setUserProjects(data);
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.message || 'Failed to load user projects';
      setError(errorMsg);
      console.error('Failed to load user projects:', err);
      setUserProjects(null);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleImpersonate = async (userId: string) => {
    try {
      await AdminAPI.impersonateUser(userId);
      // Small delay to ensure cookie is set before reload
      await new Promise(resolve => setTimeout(resolve, 100));
      // Reload page to apply impersonation
      window.location.href = '/projects';
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to impersonate user');
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (!newPassword || newPassword.length < 8) {
      setResetPasswordError('Password must be at least 8 characters');
      return;
    }

    try {
      setResetPasswordError(null);
      await AdminAPI.resetUserPassword(userId, newPassword);
      setResetPasswordUserId(null);
      setNewPassword('');
      alert('Password reset successfully');
    } catch (err: any) {
      setResetPasswordError(err.response?.data?.detail || 'Failed to reset password');
    }
  };

  if (!user?.is_admin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-eink-off-white">
      {/* Header */}
      <div className="border-b border-eink-pale-gray bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/projects')}
                className="flex items-center space-x-2 text-eink-dark-gray hover:text-eink-black"
              >
                <ArrowLeft size={20} />
                <span>Back to Projects</span>
              </button>
              <h1 className="text-2xl font-bold text-eink-black">Admin Dashboard</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 text-red-800">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Users List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg border border-eink-pale-gray">
              <div className="border-b border-eink-pale-gray px-6 py-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Users size={20} />
                  Users ({totalUsers})
                </h2>
              </div>

              {loading ? (
                <div className="p-6 text-center text-eink-dark-gray">Loading users...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-eink-off-white text-sm text-eink-dark-gray">
                      <tr>
                        <th className="px-6 py-3 text-left">Username</th>
                        <th className="px-6 py-3 text-left">Email</th>
                        <th className="px-6 py-3 text-center">Projects</th>
                        <th className="px-6 py-3 text-center">Admin</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-eink-pale-gray text-sm">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-eink-off-white">
                          <td className="px-6 py-4 font-medium">{u.username}</td>
                          <td className="px-6 py-4 text-eink-dark-gray">{u.email}</td>
                          <td className="px-6 py-4 text-center">{u.project_count}</td>
                          <td className="px-6 py-4 text-center">
                            {u.is_admin && <span className="text-eink-blue">✓</span>}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => loadUserProjects(u.id)}
                                className="p-1 text-eink-blue hover:bg-blue-50 rounded"
                                title="View projects"
                              >
                                <FolderOpen size={16} />
                              </button>
                              <button
                                onClick={() => setResetPasswordUserId(u.id)}
                                className="p-1 text-eink-blue hover:bg-blue-50 rounded"
                                title="Reset password"
                              >
                                <KeyRound size={16} />
                              </button>
                              {!u.is_admin && (
                                <button
                                  onClick={() => handleImpersonate(u.id)}
                                  className="p-1 text-eink-blue hover:bg-blue-50 rounded"
                                  title="Impersonate user"
                                >
                                  <LogIn size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - User Projects or Reset Password */}
          <div>
            {resetPasswordUserId ? (
              <div className="bg-white rounded-lg border border-eink-pale-gray p-6">
                <h3 className="text-lg font-semibold mb-4">Reset Password</h3>
                <p className="text-sm text-eink-dark-gray mb-4">
                  User: {users.find(u => u.id === resetPasswordUserId)?.username}
                </p>

                {resetPasswordError && (
                  <div className="mb-4 text-sm text-red-600">{resetPasswordError}</div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-eink-pale-gray rounded-md"
                      placeholder="Min 8 characters"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleResetPassword(resetPasswordUserId)}
                      className="flex-1 bg-eink-blue text-white px-4 py-2 rounded-md hover:opacity-90"
                    >
                      Reset Password
                    </button>
                    <button
                      onClick={() => {
                        setResetPasswordUserId(null);
                        setNewPassword('');
                        setResetPasswordError(null);
                      }}
                      className="px-4 py-2 border border-eink-pale-gray rounded-md hover:bg-eink-off-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : userProjects ? (
              <div className="bg-white rounded-lg border border-eink-pale-gray">
                <div className="border-b border-eink-pale-gray px-6 py-4">
                  <h3 className="text-lg font-semibold">
                    {userProjects.username}'s Projects ({userProjects.total})
                  </h3>
                </div>

                {loadingProjects ? (
                  <div className="p-6 text-center text-eink-dark-gray">Loading...</div>
                ) : (
                  <div className="p-6 space-y-3">
                    {userProjects.projects.length === 0 ? (
                      <p className="text-sm text-eink-dark-gray text-center">No projects</p>
                    ) : (
                      userProjects.projects.map((project) => (
                        <div
                          key={project.id}
                          className="border border-eink-pale-gray rounded-lg p-4 hover:bg-eink-off-white"
                        >
                          <h4 className="font-medium">{project.name}</h4>
                          <p className="text-sm text-eink-dark-gray mt-1">{project.description}</p>
                          <div className="mt-2 text-xs text-eink-light-gray">
                            {project.device_profile}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                <div className="border-t border-eink-pale-gray px-6 py-4">
                  <button
                    onClick={() => {
                      setUserProjects(null);
                      setSelectedUserId(null);
                    }}
                    className="text-sm text-eink-blue hover:underline"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-eink-pale-gray p-6 text-center text-eink-dark-gray">
                <FolderOpen size={48} className="mx-auto mb-4 opacity-30" />
                <p>Select a user to view their projects</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
