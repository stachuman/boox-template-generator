/**
 * Main navigation component.
 * 
 * Provides top-level navigation between different app sections.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogOut, Folder, Globe, BookOpen, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/auth/useAuth';

const Navigation: React.FC = () => {
  const location = useLocation();
  const { user, logout } = useAuth();

  const navItems = [
    { path: '/', label: 'Projects', icon: Folder },
    { path: '/gallery', label: 'Public gallery', icon: Globe },
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname.startsWith('/projects');
    }
    return location.pathname.startsWith(path);
  };

  return (
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
        <span className="text-sm text-eink-dark-gray">{user ? `Signed in as ${user.username}` : ''}</span>
        <button
          type="button"
          onClick={logout}
          className="flex items-center space-x-1 rounded-md border border-eink-pale-gray px-3 py-2 text-sm text-eink-dark-gray transition-colors hover:border-eink-black hover:text-eink-black"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign out</span>
        </button>
      </div>
    </nav>
  );
};

export default Navigation;