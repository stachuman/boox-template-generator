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

import TemplateEditor from '@/components/TemplateEditor';
import TemplateGallery from '@/components/TemplateGallery';
import Navigation from '@/components/Navigation';

const App: React.FC = () => {
  return (
    <DndProvider backend={HTML5Backend}>
      <Router>
        <div className="min-h-screen bg-eink-off-white">
          <Navigation />
          <main className="h-[calc(100vh-4rem)]">
            <Routes>
              <Route path="/" element={<TemplateGallery />} />
              <Route path="/editor" element={<TemplateEditor />} />
              <Route path="/editor/:templateId" element={<TemplateEditor />} />
            </Routes>
          </main>
        </div>
      </Router>
    </DndProvider>
  );
};

export default App;