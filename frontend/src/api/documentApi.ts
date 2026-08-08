import type { Document, DocumentVersion } from "../types";
import { request } from "./httpClient";

const API_BASE_URL = "/api/v1";

export interface UpdateDocumentPayload {
  title: string;
  folder_id: number | null;
}

function getToken() {
  return localStorage.getItem("access_token");
}

function redirectToLogin() {
  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

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

function objectUrlFromBlob(blob: Blob): string {
  return URL.createObjectURL(blob);
}

export const documentApi = {
  upload(formData: FormData): Promise<unknown> {
    return request("/documents", { method: "POST", body: formData });
  },

  list(folderId?: number | null): Promise<Document[]> {
    const query = folderId ? `?folder_id=${folderId}` : "";
    return request<Document[]>(`/documents${query}`);
  },

  get(id: number): Promise<Document> {
    return request<Document>(`/documents/${id}`);
  },

  update(id: number, data: UpdateDocumentPayload): Promise<Document> {
    return request<Document>(`/documents/${id}`, { method: "PUT", body: data });
  },

  delete(id: number): Promise<unknown> {
    return request(`/documents/${id}`, { method: "DELETE" });
  },

  versions(id: number): Promise<DocumentVersion[]> {
    return request<DocumentVersion[]>(`/documents/${id}/versions`);
  },

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

  async preview(id: number): Promise<string> {
    const blob = await fetchFile(`/documents/${id}/download`);
    return objectUrlFromBlob(blob);
  },
};