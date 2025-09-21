import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Project, ProjectListItem, NamedPage, CompilationRule } from '@/types';

interface ProjectStore {
  // Current state
  currentProject: Project | null;
  projects: ProjectListItem[];

  // Loading states
  loading: boolean;
  saving: boolean;
  error: string | null;

  // UI state
  activeTab: 'pages' | 'compilation';

  // Actions
  setCurrentProject: (project: Project | null) => void;
  setProjects: (projects: ProjectListItem[]) => void;
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setError: (error: string | null) => void;
  setActiveTab: (tab: 'pages' | 'compilation') => void;

  // Project operations
  addProject: (project: Project) => void;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  removeProject: (projectId: string) => void;

  // Named page operations
  addNamedPage: (page: NamedPage) => void;
  updateNamedPage: (pageName: string, updates: Partial<NamedPage>) => void;
  removeNamedPage: (pageName: string) => void;

  // Compilation rules operations
  setCompilationRules: (rules: CompilationRule[]) => void;
  addCompilationRule: (rule: CompilationRule) => void;
  updateCompilationRule: (index: number, updates: Partial<CompilationRule>) => void;
  removeCompilationRule: (index: number) => void;
  reorderCompilationRule: (fromIndex: number, toIndex: number) => void;

  // Utility functions
  getProjectById: (projectId: string) => ProjectListItem | undefined;
  getPageByName: (pageName: string) => NamedPage | undefined;
  clearStore: () => void;
}

export const useProjectStore = create<ProjectStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentProject: null,
      projects: [],
      loading: false,
      saving: false,
      error: null,
      activeTab: 'pages',

      // Basic setters
      setCurrentProject: (project) => set({ currentProject: project }),
      setProjects: (projects) => set({ projects }),
      setLoading: (loading) => set({ loading }),
      setSaving: (saving) => set({ saving }),
      setError: (error) => set({ error }),
      setActiveTab: (tab) => set({ activeTab: tab }),

      // Project operations
      addProject: (project) => {
        const newProjectListItem: ProjectListItem = {
          id: project.id,
          name: project.metadata.name,
          description: project.metadata.description,
          page_count: project.pages.length,
          created_at: project.metadata.created_at,
          updated_at: project.metadata.updated_at
        };

        set((state) => ({
          projects: [newProjectListItem, ...state.projects]
        }));
      },

      updateProject: (projectId, updates) => {
        set((state) => {
          // Update current project if it matches
          let updatedCurrentProject = state.currentProject;
          if (state.currentProject && state.currentProject.id === projectId) {
            updatedCurrentProject = {
              ...state.currentProject,
              ...updates
            };
          }

          // Update projects list
          const updatedProjects = state.projects.map(project => {
            if (project.id !== projectId) return project;

            return {
              ...project,
              name: updates.metadata?.name || project.name,
              description: updates.metadata?.description || project.description,
              page_count: updates.pages?.length || project.page_count,
              updated_at: updates.metadata?.updated_at || project.updated_at
            };
          });

          return {
            currentProject: updatedCurrentProject,
            projects: updatedProjects
          };
        });
      },

      removeProject: (projectId) => {
        set((state) => ({
          projects: state.projects.filter(p => p.id !== projectId),
          currentProject: state.currentProject?.id === projectId ? null : state.currentProject
        }));
      },

      // Named page operations
      addNamedPage: (page) => {
        set((state) => {
          if (!state.currentProject) return state;

          const updatedProject = {
            ...state.currentProject,
            pages: [...state.currentProject.pages, page],
            metadata: {
              ...state.currentProject.metadata,
              updated_at: new Date().toISOString()
            }
          };

          return { currentProject: updatedProject };
        });
      },

      updateNamedPage: (pageName, updates) => {
        set((state) => {
          if (!state.currentProject) return state;

          const updatedPages = state.currentProject.pages.map(page => {
            if (page.name !== pageName) return page;

            return {
              ...page,
              ...updates,
              updated_at: new Date().toISOString()
            };
          });

          const updatedProject = {
            ...state.currentProject,
            pages: updatedPages,
            metadata: {
              ...state.currentProject.metadata,
              updated_at: new Date().toISOString()
            }
          };

          return { currentProject: updatedProject };
        });
      },

      removeNamedPage: (pageName) => {
        set((state) => {
          if (!state.currentProject) return state;

          const updatedProject = {
            ...state.currentProject,
            pages: state.currentProject.pages.filter(page => page.name !== pageName),
            metadata: {
              ...state.currentProject.metadata,
              updated_at: new Date().toISOString()
            }
          };

          return { currentProject: updatedProject };
        });
      },

      // Compilation rules operations
      setCompilationRules: (rules) => {
        set((state) => {
          if (!state.currentProject) return state;

          const updatedProject = {
            ...state.currentProject,
            compilation_rules: rules,
            metadata: {
              ...state.currentProject.metadata,
              updated_at: new Date().toISOString()
            }
          };

          return { currentProject: updatedProject };
        });
      },

      addCompilationRule: (rule) => {
        set((state) => {
          if (!state.currentProject) return state;

          const updatedProject = {
            ...state.currentProject,
            compilation_rules: [...state.currentProject.compilation_rules, rule],
            metadata: {
              ...state.currentProject.metadata,
              updated_at: new Date().toISOString()
            }
          };

          return { currentProject: updatedProject };
        });
      },

      updateCompilationRule: (index, updates) => {
        set((state) => {
          if (!state.currentProject || index < 0 || index >= state.currentProject.compilation_rules.length) {
            return state;
          }

          const updatedRules = state.currentProject.compilation_rules.map((rule, i) => {
            if (i !== index) return rule;
            return { ...rule, ...updates };
          });

          const updatedProject = {
            ...state.currentProject,
            compilation_rules: updatedRules,
            metadata: {
              ...state.currentProject.metadata,
              updated_at: new Date().toISOString()
            }
          };

          return { currentProject: updatedProject };
        });
      },

      removeCompilationRule: (index) => {
        set((state) => {
          if (!state.currentProject || index < 0 || index >= state.currentProject.compilation_rules.length) {
            return state;
          }

          const updatedRules = state.currentProject.compilation_rules.filter((_, i) => i !== index);

          const updatedProject = {
            ...state.currentProject,
            compilation_rules: updatedRules,
            metadata: {
              ...state.currentProject.metadata,
              updated_at: new Date().toISOString()
            }
          };

          return { currentProject: updatedProject };
        });
      },

      reorderCompilationRule: (fromIndex, toIndex) => {
        set((state) => {
          if (!state.currentProject ||
              fromIndex < 0 || fromIndex >= state.currentProject.compilation_rules.length ||
              toIndex < 0 || toIndex >= state.currentProject.compilation_rules.length) {
            return state;
          }

          const rules = [...state.currentProject.compilation_rules];
          const [movedRule] = rules.splice(fromIndex, 1);
          rules.splice(toIndex, 0, movedRule);

          // Update order values
          const updatedRules = rules.map((rule, index) => ({
            ...rule,
            order: index + 1
          }));

          const updatedProject = {
            ...state.currentProject,
            compilation_rules: updatedRules,
            metadata: {
              ...state.currentProject.metadata,
              updated_at: new Date().toISOString()
            }
          };

          return { currentProject: updatedProject };
        });
      },

      // Utility functions
      getProjectById: (projectId) => {
        return get().projects.find(p => p.id === projectId);
      },

      getPageByName: (pageName) => {
        const currentProject = get().currentProject;
        if (!currentProject) return undefined;
        return currentProject.pages.find(p => p.name === pageName);
      },

      clearStore: () => {
        set({
          currentProject: null,
          projects: [],
          loading: false,
          saving: false,
          error: null,
          activeTab: 'pages'
        });
      }
    }),
    {
      name: 'project-store'
    }
  )
);