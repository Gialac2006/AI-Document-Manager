import type {
  AdminStats,
  AuditLog,
  AuditLogQuery,
  Document,
  Organization,
  OrganizationDetail,
  User,
} from "../types";
import { request } from "./httpClient";

// API quản trị: tổ chức, người dùng, thống kê và nhật ký
export const adminApi = {
  // Lấy danh sách tổ chức
  listOrganizations(): Promise<Organization[]> {
    return request<Organization[]>("/admin/organizations");
  },

  // Tạo tổ chức mới
  createOrganization(name: string): Promise<unknown> {
    return request("/admin/organizations", {
      method: "POST",
      body: { name },
    });
  },

  // Lấy chi tiết tổ chức theo id
  getOrganization(id: number): Promise<OrganizationDetail> {
    return request<OrganizationDetail>(`/admin/organizations/${id}`);
  },

  // Xoá tổ chức theo id
  deleteOrganization(id: number): Promise<unknown> {
    return request(`/admin/organizations/${id}`, { method: "DELETE" });
  },

  // Lấy danh sách người dùng
  listUsers(): Promise<User[]> {
    return request<User[]>("/admin/users");
  },

  // Lấy thống kê tổng quan hệ thống
  getStats(): Promise<AdminStats> {
    return request<AdminStats>("/admin/stats");
  },

  // Lấy danh sách tài liệu chờ phê duyệt
  pendingApprovals(): Promise<Document[]> {
    return request<Document[]>("/admin/pending-approvals");
  },

  // Lấy nhật ký hoạt động của một người dùng
  auditLogs(userId: number, limit = 100): Promise<AuditLog[]> {
    return request<AuditLog[]>(
      `/audit-logs?user_id=${userId}&limit=${limit}`,
    );
  },

  // Lấy toàn bộ nhật ký với bộ lọc tìm kiếm
  listAllAuditLogs(query: AuditLogQuery = {}): Promise<AuditLog[]> {
    const params = new URLSearchParams();
    if (query.user_id != null) params.set("user_id", String(query.user_id));
    if (query.action) params.set("action", query.action);
    if (query.entity_type) params.set("entity_type", query.entity_type);
    if (query.date_from) params.set("date_from", query.date_from);
    if (query.date_to) params.set("date_to", query.date_to);
    if (query.offset != null) params.set("offset", String(query.offset));
    if (query.limit != null) params.set("limit", String(query.limit));
    const qs = params.toString();
    return request<AuditLog[]>(`/audit-logs${qs ? `?${qs}` : ""}`);
  },
};
