export interface UserResponse {
  id: string;
  username: string;
  email: string;
  created_at: string;
  is_active: boolean;
  is_admin: boolean;
  terms_accepted_at?: string;
  is_impersonating?: boolean;
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

export interface AuthStateSnapshot {
  user: UserResponse | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}
