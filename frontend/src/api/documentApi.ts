import type {
  Approval,
  AuditLog,
  Document,
  DocumentVersion,
  Permission,
} from "../types";
import { request } from "./httpClient";

const API_BASE_URL = "/api/v1";

// Dữ liệu cập nhật tài liệu
export interface UpdateDocumentPayload {
  title: string;
  folder_id: number | null;
}

// Lấy token đăng nhập từ localStorage
function getToken() {
  return localStorage.getItem("access_token");
}

// Chuyển hướng về trang đăng nhập nếu chưa ở đó
function redirectToLogin() {
  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

// Tải file từ máy chủ dưới dạng Blob
async function fetchFile(path: string): Promise<Blob> {
  const headers: Record<string, string> = {};
  if (getToken()) {
    headers.Authorization = `Bearer ${getToken()}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers,
      cache: "no-store",
    });
  } catch {
    throw new Error("Không thể kết nối tới máy chủ");
  }

  if (response.status === 401 && getToken()) {
    localStorage.removeItem("access_token");
    redirectToLogin();
  }

  if (!response.ok) {
    throw new Error(`Không thể tải file (HTTP ${response.status})`);
  }
  return response.blob();
}

// Tạo URL tạm thời từ Blob để tải/xem file
function objectUrlFromBlob(blob: Blob): string {
  return URL.createObjectURL(blob);
}

// API quản lý tài liệu: tải lên, tải về, quyền và phê duyệt
export const documentApi = {
  // Tải tài liệu mới lên máy chủ
  upload(formData: FormData): Promise<unknown> {
    return request("/documents", { method: "POST", body: formData });
  },

  // Tải lên phiên bản mới cho tài liệu
  uploadNewVersion(id: number, file: File): Promise<Document> {
    const formData = new FormData();
    formData.append("file", file);
    return request<Document>(`/documents/${id}/upload`, {
      method: "POST",
      body: formData,
    });
  },

  // Lấy danh sách tài liệu (có thể theo thư mục)
  list(folderId?: number | null): Promise<Document[]> {
    const query = folderId ? `?folder_id=${folderId}` : "";
    return request<Document[]>(`/documents${query}`);
  },

  // Lấy chi tiết tài liệu theo id
  get(id: number): Promise<Document> {
    return request<Document>(`/documents/${id}`);
  },

  // Cập nhật tiêu đề/thư mục của tài liệu
  update(id: number, data: UpdateDocumentPayload): Promise<Document> {
    return request<Document>(`/documents/${id}`, { method: "PUT", body: data });
  },

  // Xoá tài liệu theo id
  delete(id: number): Promise<unknown> {
    return request(`/documents/${id}`, { method: "DELETE" });
  },

  // Lấy danh sách phiên bản của tài liệu
  versions(id: number): Promise<DocumentVersion[]> {
    return request<DocumentVersion[]>(`/documents/${id}/versions`);
  },

  // Gọi API tải tài liệu về máy
  async download(id: number, fileName: string): Promise<void> {
    const blob = await fetchFile(`/documents/${id}/download`);
    const url = objectUrlFromBlob(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  // Gọi API tải một phiên bản cụ thể về máy
  async downloadVersion(
    id: number,
    version: number,
    fileName: string,
  ): Promise<void> {
    const blob = await fetchFile(`/documents/${id}/versions/${version}/download`);
    const url = objectUrlFromBlob(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  // Tạo URL xem trước tài liệu (theo phiên bản nếu có)
  async preview(id: number, version?: number): Promise<string> {
    const path = version
      ? `/documents/${id}/versions/${version}/download`
      : `/documents/${id}/download`;
    const blob = await fetchFile(path);
    return objectUrlFromBlob(blob);
  },

  // Lấy danh sách quyền truy cập của tài liệu
  listPermissions(id: number): Promise<Permission[]> {
    return request<Permission[]>(`/documents/${id}/permissions`);
  },

  // Cấp quyền truy cập cho người dùng
  grantPermission(
    id: number,
    userId: number,
    accessLevel: string,
  ): Promise<Permission> {
    return request<Permission>(`/documents/${id}/permissions`, {
      method: "POST",
      body: { user_id: userId, access_level: accessLevel },
    });
  },

  // Thu hồi quyền truy cập của người dùng
  revokePermission(id: number, userId: number): Promise<unknown> {
    return request(`/documents/${id}/permissions/${userId}`, {
      method: "DELETE",
    });
  },

  // Lấy nhật ký hoạt động của tài liệu
  auditLogs(id: number): Promise<AuditLog[]> {
    return request<AuditLog[]>(`/documents/${id}/audit-logs`);
  },

  // Lấy danh sách yêu cầu phê duyệt của tài liệu
  listApprovals(id: number): Promise<Approval[]> {
    return request<Approval[]>(`/documents/${id}/approvals`);
  },

  // Gửi quyết định phê duyệt/từ chối tài liệu
  submitApproval(
    id: number,
    decision: "approved" | "rejected",
    reason: string,
  ): Promise<Document> {
    return request<Document>(`/documents/${id}/approval`, {
      method: "POST",
      body: { decision, reason },
    });
  },
};