/**
 * Main App component for E-ink PDF Templates frontend.
 * 
 * Root component that sets up routing and global providers.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import Navigation from '@/components/Navigation';
import ProjectList from '@/components/projects/ProjectList';
import ProjectEditor from '@/components/projects/ProjectEditor';
import MasterEditor from '@/components/projects/MasterEditor';
import CompilationRulesEditor from '@/components/projects/CompilationRulesEditor';

const App: React.FC = () => {
  return (
    <DndProvider backend={HTML5Backend}>
      <Router>
        <div className="min-h-screen bg-eink-off-white">
          <Navigation />
          <main className="h-[calc(100vh-4rem)]">
            <Routes>
              {/* Project-based routes */}
              <Route path="/" element={<ProjectList />} />
              <Route path="/projects" element={<ProjectList />} />
              <Route path="/projects/:projectId" element={<ProjectEditor />} />
              <Route path="/projects/:projectId/masters/new" element={<MasterEditor />} />
              <Route path="/projects/:projectId/masters/:masterName" element={<MasterEditor />} />
              <Route path="/projects/:projectId/compilation" element={<CompilationRulesEditor />} />
            </Routes>
          </main>
        </div>
      </Router>
    </DndProvider>
  );
};

export default App;
