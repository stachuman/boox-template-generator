import React, { useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import ProjectList from '@/components/projects/ProjectList';
import ProjectEditor from '@/components/projects/ProjectEditor';
import MasterEditor from '@/components/projects/MasterEditor';
import CompilationRulesEditor from '@/components/projects/CompilationRulesEditor';
import { useProjectStore } from '@/stores/projectStore';
import Navigation from '@/components/Navigation';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import PublicGallery from '@/components/public/PublicGallery';
import PublicProjectDetail from '@/components/public/PublicProjectDetail';
import PublicRoute from '@/components/common/PublicRoute';
import LoginPage from '@/components/auth/LoginPage';
import RegisterPage from '@/components/auth/RegisterPage';
import PasswordResetPage from '@/components/auth/PasswordResetPage';
import AdminDashboard from '@/pages/AdminDashboard';
import type { Project } from '@/types';

const AppShell = () => (
  <div className="flex min-h-screen flex-col bg-eink-off-white">
    <Navigation />
    <main className="flex-1 overflow-hidden">
      <div className="h-full overflow-auto">
        <Outlet />
      </div>
    </main>
  </div>
);

const GalleryRoute = () => {
  const navigate = useNavigate();
  const addProject = useProjectStore((state) => state.addProject);

  const handleCloneSuccess = useCallback((project: Project) => {
    addProject(project);
    navigate(`/projects/${project.id}`);
  }, [addProject, navigate]);

  return <PublicGallery onCloneSuccess={handleCloneSuccess} />;
};

const PublicProjectDetailRoute = () => {
  return <PublicProjectDetail />;
};

const App: React.FC = () => {
  return (
    <DndProvider backend={HTML5Backend}>
      <Router>
        <Routes>
          {/* Public gallery routes - no auth required */}
          <Route path="/" element={<AppShell />}>
            <Route path="gallery" element={<GalleryRoute />} />
            <Route path="gallery/id/:projectId" element={<PublicProjectDetailRoute />} />
            <Route path="gallery/:slug" element={<PublicProjectDetailRoute />} />
          </Route>

          {/* Protected routes - require authentication */}
          <Route
            path="/"
            element={(
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            )}
          >
            <Route index element={<Navigate to="/projects" replace />} />
            <Route path="projects" element={<ProjectList />} />
            <Route path="projects/:projectId" element={<ProjectEditor />} />
            <Route path="projects/:projectId/masters/new" element={<MasterEditor />} />
            <Route path="projects/:projectId/masters/:masterName" element={<MasterEditor />} />
            <Route path="projects/:projectId/compilation" element={<CompilationRulesEditor />} />
            <Route path="admin" element={<AdminDashboard />} />
          </Route>

          <Route
            path="/login"
            element={(
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            )}
          />
          <Route
            path="/register"
            element={(
              <PublicRoute>
                <RegisterPage />
              </PublicRoute>
            )}
          />
          <Route
            path="/reset-password"
            element={(
              <PublicRoute>
                <PasswordResetPage />
              </PublicRoute>
            )}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </DndProvider>
  );
};

export default App;
