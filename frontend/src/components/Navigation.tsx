/**
 * Main navigation component.
 * 
 * Provides top-level navigation between different app sections.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Folder, Globe, BookOpen, ExternalLink, Heart, Shield, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/auth/useAuth';
import { VersionService } from '@/services/version';
import { AdminAPI } from '@/services/adminApi';

const Navigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleStopImpersonation = async () => {
    try {
      await AdminAPI.stopImpersonation();
      window.location.href = '/admin';
    } catch (err) {
      console.error('Failed to stop impersonation:', err);
    }
  };

  const navItems = [
    { path: '/', label: 'Projects', icon: Folder },
    { path: '/gallery', label: 'Public gallery', icon: Globe },
    ...(user?.is_admin ? [{ path: '/admin', label: 'Admin', icon: Shield }] : []),
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname.startsWith('/projects');
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {user?.is_impersonating && (
        <div className="bg-yellow-100 border-b border-yellow-200 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm text-yellow-800">
            <Shield className="h-4 w-4" />
            <span>Impersonating user: <strong>{user.username}</strong></span>
          </div>
          <button
            onClick={handleStopImpersonation}
            className="flex items-center space-x-1 px-3 py-1 bg-yellow-200 hover:bg-yellow-300 rounded-md text-sm text-yellow-900 transition-colors"
          >
            <XCircle className="h-4 w-4" />
            <span>Stop Impersonating</span>
          </button>
        </div>
      )}
      <nav className="toolbar h-12 flex items-center justify-between px-4">
        <div className="flex items-center space-x-1">
          {navItems.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={clsx(
                'flex items-center space-x-2 px-3 py-2 rounded-md transition-colors',
                isActive(path)
                  ? 'bg-eink-black text-eink-white'
                  : 'text-eink-dark-gray hover:bg-eink-pale-gray'
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </Link>
          ))}
        </div>

      <div className="flex items-center space-x-3">
        <a
          href="https://github.com/stachuman/boox-template-generator/blob/main/TUTORIAL.md"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-1 rounded-md border border-eink-pale-gray px-3 py-2 text-sm text-eink-dark-gray transition-colors hover:border-eink-black hover:text-eink-black"
          title="Open tutorial in new tab"
        >
          <BookOpen className="h-4 w-4" />
          <span>Tutorial</span>
          <ExternalLink className="h-3 w-3" />
        </a>
        <a
          href="https://paypal.me/StachuMan"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-1 rounded-md border border-red-200 px-3 py-2 text-sm text-red-600 transition-colors hover:border-red-400 hover:text-red-700"
          title="Support this project"
        >
          <Heart className="h-4 w-4" />
          <span>Donate</span>
          <ExternalLink className="h-3 w-3" />
        </a>
        <span className="text-xs text-eink-dark-gray">{VersionService.getVersionString()}</span>
        {user ? (
          <>
            <span className="text-sm text-eink-dark-gray">Signed in as {user.username}</span>
            <button
              type="button"
              onClick={logout}
              className="flex items-center space-x-1 rounded-md border border-eink-pale-gray px-3 py-2 text-sm text-eink-dark-gray transition-colors hover:border-eink-black hover:text-eink-black"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </button>
          </>
        ) : (
          <Link
            to="/login"
            className="flex items-center space-x-1 rounded-md border border-eink-pale-gray px-3 py-2 text-sm text-eink-dark-gray transition-colors hover:border-eink-black hover:text-eink-black"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign in</span>
          </Link>
        )}
      </div>
      </nav>
    </>
  );
};

export default Navigation;