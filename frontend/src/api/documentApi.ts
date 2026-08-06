import type { Document, DocumentVersion } from "../types";
import { request } from "./httpClient";

export interface UpdateDocumentPayload {
  title: string;
  folder_id: number | null;
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

  downloadUrl(id: number): string {
    return `/api/v1/documents/${id}/download`;
  },

  versions(id: number): Promise<DocumentVersion[]> {
    return request<DocumentVersion[]>(`/documents/${id}/versions`);
  },
};
