/**
 * Main navigation component.
 * 
 * Provides top-level navigation between different app sections.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileText, Folder } from 'lucide-react';
import clsx from 'clsx';

const Navigation: React.FC = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Projects', icon: Folder },
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname.startsWith('/projects');
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="toolbar h-16 flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <FileText className="w-6 h-6" />
        <h1 className="text-xl font-semibold">E-ink PDF Templates</h1>
      </div>
      
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
    </nav>
  );
};

export default Navigation;