# Frontend Multi-User Implementation Plan

## Executive Summary

This document outlines the implementation plan for adding multi-user authentication and public project features to the React frontend. The implementation will integrate with the existing JWT-based backend API while maintaining CLAUDE.md coding standards.

## Status
- Phase 1 and Phase 2 complete (auth foundation + UI).
- Public gallery, sharing controls, and cloning flows implemented.
- Remaining: ongoing UX polish, automated testing, preview enhancements.

## 1. Current State Analysis

### 1.1 Existing Architecture
- **Framework**: React 18 + TypeScript + Vite
- **Routing**: React Router v6
- **State Management**: Zustand (already available)
- **HTTP Client**: Axios with interceptors
- **UI Framework**: Tailwind CSS + Lucide icons
- **Forms**: React Hook Form

### 1.2 Current Routes
```
/ → ProjectList (unauthenticated)
/projects → ProjectList
/projects/:id → ProjectEditor
/projects/:id/masters/new → MasterEditor
/projects/:id/masters/:name → MasterEditor
/projects/:id/compilation → CompilationRulesEditor
```

### 1.3 Missing Components
- Authentication system (login/register/logout)
- User session management
- Protected routes
- Public project gallery
- Project sharing controls
- JWT token persistence and refresh

## 2. Implementation Architecture

### 2.1 Authentication Flow Design
```
1. User visits app → Check localStorage for JWT
2. Valid JWT → Extract user info → Continue to app
3. Invalid/Missing JWT → Redirect to login
4. Login success → Store JWT → Redirect to projects
5. API calls → Attach Authorization header
6. 401 response → Clear JWT → Redirect to login
```

### 2.2 New Directory Structure
```
frontend/src/
├── auth/
│   ├── AuthContext.tsx          # React context for auth state
│   ├── AuthProvider.tsx         # Context provider component
│   ├── useAuth.tsx              # Authentication hook
│   └── types.ts                 # Auth-related TypeScript types
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx        # Login form component
│   │   ├── RegisterForm.tsx     # Registration form component
│   │   ├── AuthLayout.tsx       # Layout for auth pages
│   │   └── PasswordResetForm.tsx # Password reset handling
│   ├── public/
│   │   ├── PublicGallery.tsx    # Public projects gallery
│   │   ├── PublicProjectCard.tsx # Individual project card
│   │   └── CloneDialog.tsx      # Clone project modal
│   ├── projects/
│   │   ├── ProjectSharingControls.tsx # Make public/private controls
│   │   └── ProjectHeader.tsx    # Enhanced with sharing status
│   └── common/
│       ├── ProtectedRoute.tsx   # Route guard component
│       ├── Navigation.tsx       # Main navigation with user menu
│       └── UserMenu.tsx         # User dropdown menu
├── services/
│   ├── auth.ts                  # Authentication API client
│   ├── public.ts                # Public projects API client
│   └── storage.ts               # localStorage utilities
└── stores/
    ├── auth.ts                  # Zustand auth store
    └── public.ts                # Zustand public projects store
```

## 3. Implementation Plan

### 3.1 Phase 1: Authentication Foundation (Week 1)

#### Step 1.1: Authentication Store & Context
```typescript
// src/stores/auth.ts
interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loadUserFromToken: () => Promise<void>;
}
```

#### Step 1.2: Authentication API Client
```typescript
// src/services/auth.ts
export class AuthAPI {
  static async login(username: string, password: string): Promise<TokenResponse>;
  static async register(username: string, email: string, password: string): Promise<UserResponse>;
  static async getMe(): Promise<UserResponse>;
  static async requestPasswordReset(email: string): Promise<void>;
  static async confirmPasswordReset(token: string, newPassword: string): Promise<void>;
}
```

#### Step 1.3: JWT Token Management
```typescript
// src/services/storage.ts
export class TokenStorage {
  static getToken(): string | null;
  static setToken(token: string): void;
  static removeToken(): void;
  static isTokenExpired(token: string): boolean;
}
```

#### Step 1.4: Update API Client with Auth
```typescript
// Update src/services/api.ts
apiClient.interceptors.request.use((config) => {
  const token = TokenStorage.getToken();
  if (token && !TokenStorage.isTokenExpired(token)) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      TokenStorage.removeToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### 3.2 Phase 2: Authentication UI (Week 1-2)

#### Step 2.1: Authentication Forms
```typescript
// src/components/auth/LoginForm.tsx
export const LoginForm: React.FC = () => {
  const { login } = useAuth();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>();

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data.username, data.password);
      navigate('/projects');
    } catch (error) {
      setError('Invalid credentials');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Form fields with proper validation */}
    </form>
  );
};
```

#### Step 2.2: Protected Routes
```typescript
// src/components/common/ProtectedRoute.tsx
export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <>{children}</>;
};
```

#### Step 2.3: Updated App Router
```typescript
// src/App.tsx - New routing structure
<Routes>
  {/* Public routes */}
  <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />
  <Route path="/reset-password" element={<PasswordResetPage />} />
  <Route path="/public" element={<PublicGallery />} />
  <Route path="/public/:projectId" element={<PublicProjectView />} />

  {/* Protected routes */}
  <Route path="/" element={<ProtectedRoute><ProjectList /></ProtectedRoute>} />
  <Route path="/projects" element={<ProtectedRoute><ProjectList /></ProtectedRoute>} />
  <Route path="/projects/:projectId" element={<ProtectedRoute><ProjectEditor /></ProtectedRoute>} />
  {/* Other protected routes */}
</Routes>
```

### 3.3 Phase 3: Public Project Features (Week 2)

#### Step 3.1: Public Projects Store
```typescript
// src/stores/public.ts
interface PublicProjectsState {
  projects: PublicProject[];
  isLoading: boolean;
  searchTerm: string;
  sortBy: 'name' | 'created_at' | 'clone_count';
  loadProjects: () => Promise<void>;
  searchProjects: (term: string) => void;
  setSortBy: (sort: string) => void;
}
```

#### Step 3.2: Public Gallery UI
```typescript
// src/components/public/PublicGallery.tsx
export const PublicGallery: React.FC = () => {
  const { projects, isLoading, loadProjects } = usePublicProjects();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    loadProjects();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Public Templates</h1>
        <p className="text-gray-600">Discover and clone community templates</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map(project => (
          <PublicProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
};
```

#### Step 3.3: Clone Project Dialog
```typescript
// src/components/public/CloneDialog.tsx
interface CloneDialogProps {
  project: PublicProject;
  isOpen: boolean;
  onClose: () => void;
}

export const CloneDialog: React.FC<CloneDialogProps> = ({ project, isOpen, onClose }) => {
  const { cloneProject } = useProjects();
  const { register, handleSubmit } = useForm<CloneFormData>();

  const onSubmit = async (data: CloneFormData) => {
    await cloneProject(project.id, data.name, data.description);
    navigate('/projects');
    onClose();
  };

  // Modal implementation with form
};
```

### 3.4 Phase 4: Project Sharing Features (Week 2-3)

#### Step 4.1: Project Sharing Controls
```typescript
// src/components/projects/ProjectSharingControls.tsx
export const ProjectSharingControls: React.FC<{ project: Project }> = ({ project }) => {
  const { updateProject } = useProjects();
  const [isPublic, setIsPublic] = useState(project.metadata.is_public);
  const [urlSlug, setUrlSlug] = useState(project.metadata.public_url_slug || '');

  const handleTogglePublic = async () => {
    await updateProject(project.id, {
      is_public: !isPublic,
      public_url_slug: !isPublic ? urlSlug : null
    });
    setIsPublic(!isPublic);
  };

  return (
    <div className="bg-white p-4 rounded-lg border">
      <h3 className="font-medium mb-3">Project Sharing</h3>
      <div className="space-y-3">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={handleTogglePublic}
            className="rounded"
          />
          <span>Make this project public</span>
        </label>

        {isPublic && (
          <div>
            <label className="block text-sm font-medium mb-1">
              Public URL Slug (optional)
            </label>
            <input
              type="text"
              value={urlSlug}
              onChange={(e) => setUrlSlug(e.target.value)}
              placeholder="my-awesome-template"
              className="w-full px-3 py-2 border rounded-md"
            />
            <p className="text-xs text-gray-500 mt-1">
              Public URL: /public/projects/{urlSlug || project.id}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
```

#### Step 4.2: Enhanced Project Header
```typescript
// src/components/projects/ProjectHeader.tsx
export const ProjectHeader: React.FC<{ project: Project }> = ({ project }) => {
  return (
    <header className="bg-white border-b px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <h1 className="text-xl font-semibold">{project.metadata.name}</h1>
          {project.metadata.is_public && (
            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
              Public
            </span>
          )}
          {project.metadata.cloned_from && (
            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
              Cloned from {project.metadata.original_author}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {project.metadata.is_public && (
            <a
              href={`/public/projects/${project.metadata.public_url_slug || project.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800"
            >
              <ExternalLink size={16} />
            </a>
          )}
          <ProjectMenu project={project} />
        </div>
      </div>
    </header>
  );
};
```

### 3.5 Phase 5: Navigation & User Experience (Week 3)

#### Step 5.1: Main Navigation
```typescript
// src/components/common/Navigation.tsx
export const Navigation: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <nav className="bg-white border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link to="/" className="text-xl font-bold">E-ink PDF</Link>

            <div className="flex space-x-6">
              <NavLink to="/projects" className="nav-link">
                My Projects
              </NavLink>
              <NavLink to="/public" className="nav-link">
                Public Gallery
              </NavLink>
            </div>
          </div>

          <UserMenu user={user} onLogout={logout} />
        </div>
      </div>
    </nav>
  );
};
```

#### Step 5.2: User Menu
```typescript
// src/components/common/UserMenu.tsx
export const UserMenu: React.FC<{ user: User; onLogout: () => void }> = ({ user, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 text-gray-700 hover:text-gray-900"
      >
        <User size={20} />
        <span>{user.username}</span>
        <ChevronDown size={16} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border">
          <div className="py-1">
            <div className="px-4 py-2 text-sm text-gray-500 border-b">
              {user.email}
            </div>
            <button
              onClick={onLogout}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
```

## 4. TypeScript Interfaces

### 4.1 Authentication Types
```typescript
// src/auth/types.ts
export interface User {
  id: string;
  username: string;
  email: string;
  created_at: string;
  is_active: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface LoginFormData {
  username: string;
  password: string;
}

export interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface PasswordResetFormData {
  email: string;
}

export interface PasswordResetConfirmData {
  token: string;
  newPassword: string;
  confirmPassword: string;
}
```

### 4.2 Public Project Types
```typescript
// src/types/public.ts
export interface PublicProject {
  id: string;
  metadata: Record<string, any>;
  url_slug: string | null;
  author: string;
  original_author: string | null;
  clone_count: number;
  created_at: string;
  updated_at: string;
}

export interface CloneFormData {
  name: string;
  description?: string;
}

export interface PublicProjectListResponse {
  projects: PublicProject[];
  total: number;
}
```

## 5. Implementation Guidelines

### 5.1 CLAUDE.md Compliance
- **No dummy implementations**: All functions must work completely
- **Proper error handling**: Use try-catch with meaningful error messages
- **Input validation**: Validate all form inputs and API responses
- **Fail fast**: Show clear error states, don't silently fail
- **Type safety**: Use proper TypeScript interfaces throughout

### 5.2 Security Considerations
- Store JWT tokens in localStorage (with expiration checks)
- Clear tokens on 401 responses
- Validate all user inputs
- Use HTTPS in production
- Implement proper CORS handling

### 5.3 User Experience
- Loading states for all async operations
- Clear error messages with actionable guidance
- Responsive design for mobile devices
- Keyboard navigation support
- Proper focus management

### 5.4 Performance
- Lazy load public gallery projects
- Implement search debouncing
- Cache user profile data
- Optimize re-renders with React.memo
- Use pagination for large project lists

## 6. Testing Strategy

### 6.1 Unit Tests
- Authentication store logic
- Form validation functions
- API client methods
- Token storage utilities

### 6.2 Integration Tests
- Authentication flow end-to-end
- Protected route behavior
- Public project cloning
- API error handling

### 6.3 E2E Tests
- User registration and login
- Project creation and sharing
- Public gallery browsing
- Clone project workflow

## 7. Deployment Configuration

### 7.1 Environment Variables
```bash
# .env.production
VITE_API_BASE_URL=https://api.einkpdf.com/api
VITE_PUBLIC_URL=https://einkpdf.com/public
```

### 7.2 Build Configuration
- Ensure proper TypeScript compilation
- Optimize bundle size with tree shaking
- Configure proper source maps for debugging
- Set up proper routing for SPA deployment

## 8. Timeline Summary

- **Week 1**: Authentication foundation + UI components
- **Week 2**: Public projects + sharing features
- **Week 3**: Navigation, UX polish, testing
- **Week 4**: Integration testing, bug fixes, documentation

Total estimated effort: **3-4 weeks** for complete implementation.

This plan ensures full integration with the existing backend while maintaining CLAUDE.md standards and providing a complete multi-user experience.