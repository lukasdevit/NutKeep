export interface User {
  id: number;
  username: string;
  storage_limit: number;
  is_admin: number;
  used: number;
  file_count: number;
  created_at: string;
}

export interface Props {
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>;
}

export interface MigratePreview {
  count: number;
  totalSize: number;
  backend: string;
}
