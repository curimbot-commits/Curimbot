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
}

export interface RevokeSessionResponse {
  message: string;
  revoked_count?: number;
}
