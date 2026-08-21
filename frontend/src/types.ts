// Vai trò người dùng trong hệ thống
export type UserRole =
  | "super_admin"
  | "manager"
  | "staff"
  | "individual";

// Thông tin người dùng
export interface User {
  id: number;
  full_name: string;
  email: string;
  role: UserRole;
  organization_id: number | null;
  created_at: string;
}

// Thư mục chứa tài liệu
export interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
  organization_id: number | null;
  owner_id: number | null;
  created_at: string;
  updated_at: string;
}

// Mức độ quyền truy cập tài liệu
export type AccessLevel = "view" | "edit" | "manage";

// Tài liệu trong hệ thống
export interface Document {
  id: number;
  title: string;
  file_name: string;
  file_type: string | null;
  folder_id: number | null;
  organization_id: number | null;
  owner_id: number | null;
  status: string;
  processing_status?: string;
  processing_error?: string | null;
  current_version: number;
  created_at: string;
  updated_at: string;
  access_level?: AccessLevel;
}

// Quyền truy cập tài liệu của một người dùng
export interface Permission {
  id: number;
  document_id: number;
  user_id: number;
  access_level: string;
  created_at: string;
  user_full_name?: string | null;
  user_email?: string | null;
}

// Nhật ký hoạt động của hệ thống
export interface AuditLog {
  id: number;
  user_id: number | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  details: string | null;
  created_at: string;
}

// Yêu cầu phê duyệt tài liệu
export interface Approval {
  id: number;
  document_id: number;
  reviewer_id: number;
  decision: string;
  reason: string | null;
  created_at: string;
}

// Câu hỏi trong tài liệu được AI trả lời
export interface Question {
  id: number;
  text: string;
  answer: string | null;
}

// Phiên bản của một tài liệu
export interface DocumentVersion {
  id: number;
  version: number;
  file_name: string;
  created_by: number | null;
  created_at: string;
}

// Tổ chức trong hệ thống
export interface Organization {
  id: number;
  name: string;
  created_at: string;
  member_count?: number;
}

// Chi tiết tổ chức kèm danh sách thành viên
export interface OrganizationDetail extends Organization {
  members: User[];
}

// Số lượng người dùng theo vai trò
export interface RoleCount {
  role: UserRole;
  count: number;
}

// Thống kê tổ chức cho dashboard admin
export interface OrganizationStats {
  id: number;
  name: string;
  created_at: string;
  member_count: number;
}

// Số lượng tài liệu theo trạng thái
export interface DocumentStatusCount {
  status: string;
  count: number;
}

// Dữ liệu thống kê toàn hệ thống cho admin
export interface AdminStats {
  total_users: number;
  total_organizations: number;
  total_documents: number;
  total_audit_logs: number;
  users_by_role: RoleCount[];
  organizations: OrganizationStats[];
  documents_by_status: DocumentStatusCount[];
  recent_activity: AuditLog[];
}

// Bộ lọc truy vấn nhật ký hoạt động
export interface AuditLogQuery {
  user_id?: number;
  action?: string;
  entity_type?: string;
  date_from?: string;
  date_to?: string;
  offset?: number;
  limit?: number;
}

// Phản hồi yêu cầu quên mật khẩu
export interface ForgotPasswordResponse {
  detail: string;
  reset_token: string | null;
  reset_url: string | null;
}

// Kết quả kiểm tra tính hợp lệ của token đặt lại mật khẩu
export interface ValidateResetTokenResponse {
  valid: boolean;
}
