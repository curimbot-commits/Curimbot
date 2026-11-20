// src/app/services/models/user.model.ts
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  created_at: string;
  last_login: string | null;
  is_active: boolean;
  two_factor_enabled?: boolean;
  profile_photo_url?: string | null;
}

export interface UserCreate {
  name?: string;
  email: string;
  password: string;
  password_confirm: string;
}

export interface Token {
  access_token: string;
  token_type: string;
  refresh_token: string;
  requires_2fa?: boolean;
  message?: string;
}

export interface LoginStatsResponse {
  email: string;
  period_hours: number;
  total_attempts: number;
  successful_attempts: number;
  failed_attempts: number;
  success_rate: number;
  last_attempt: string | null;
}

export interface UserInfoResponse {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  created_at: string;
  last_login: string | null;
  is_active: boolean;
  two_factor_enabled?: boolean;
  profile_photo_url?: string | null;
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
  confirm_password: string;
}

export interface UserManagementResponse {
  message: string;
  user_id: number;
  user_email: string;
  new_role: string;
  updated_by: string;
  updated_at: string;
}

/*************************** */
export interface TwoFASetupResponse {
  backup_codes: string[];
  message: string;
  qr_code: string;
  secret: string;
}

interface LoginRequest {
  grant_type?: 'password' | null;
  username: string;
  password: string;
  scope?: string;
  client_id?: string | null;
  client_secret?: string | null;
}

/** Segundo paso del login con 2FA: ya no se reenvía la contraseña. */
export interface Login2FARequest {
  challenge_token: string;
  code: string;
  single_session?: boolean;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface TwoFAConfirmRequest {
  code: string;
}

export interface TwoFAStatusResponse {
  enabled: boolean;
  backup_codes_remaining?: number;
}
export interface TwoFADisableRequest {
  code: string; // Código de 6 dígitos o código de respaldo
  password?: string; // Contraseña actual como medida de seguridad adicional
}
export type AuthStatsSummary = Record<string, unknown>;

/**
 * Estado temporal entre el login y la verificación 2FA (sessionStorage).
 * Guarda el challenge_token del backend (5 min, un solo uso), nunca la contraseña.
 */
export interface Temp2FAAuth {
  email: string;
  challenge_token: string;
}

export interface ActiveSession {
  id: number;
  device: string;
  device_type: string;
  os: string;
  browser: string;
  ip_address: string;
  location: string;
  is_active: boolean;
  is_current: boolean;
  last_active: string;
  created_at: string;
  expires_at?: string;
}

export interface RevokeAllResponse {
  message: string;
  count: number;
}

export interface SessionStatsResponse {
  total_sessions: number;
  active_sessions: number;
  inactive_sessions: number;
  current_device: string | null;
  last_login: string | null;
}
