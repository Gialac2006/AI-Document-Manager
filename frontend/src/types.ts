export type UserRole =
  | "super_admin"
  | "manager"
  | "staff"
  | "individual";

export interface User {
  id: number;
  full_name: string;
  email: string;
  role: UserRole;
  organization_id: number | null;
  created_at: string;
}

export interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
  organization_id: number | null;
  owner_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: number;
  title: string;
  file_name: string;
  file_type: string | null;
  folder_id: number | null;
  organization_id: number | null;
  owner_id: number | null;
  status: string;
  current_version: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentVersion {
  id: number;
  version: number;
  file_name: string;
  created_by: number | null;
  created_at: string;
}

export interface Organization {
  id: number;
  name: string;
  created_at: string;
}

export interface OrganizationDetail extends Organization {
  members: User[];
}

export interface ForgotPasswordResponse {
  detail: string;
  reset_token: string | null;
  reset_url: string | null;
}

export interface ValidateResetTokenResponse {
  valid: boolean;
}
