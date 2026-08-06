import type { Folder } from "../types";
import { request } from "./httpClient";

export interface CreateFolderPayload {
  name: string;
  parent_id: number | null;
}

export const folderApi = {
  list(): Promise<Folder[]> {
    return request<Folder[]>("/folders");
  },

  create(data: CreateFolderPayload): Promise<unknown> {
    return request("/folders", { method: "POST", body: data });
  },

  rename(id: number, name: string): Promise<unknown> {
    return request(`/folders/${id}`, { method: "PUT", body: { name } });
  },

  delete(id: number): Promise<unknown> {
    return request(`/folders/${id}`, { method: "DELETE" });
  },
};
