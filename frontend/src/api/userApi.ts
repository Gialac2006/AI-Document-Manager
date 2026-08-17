import type { User, UserRole } from "../types";
import { request } from "./httpClient";

export interface CreateUserPayload {
  full_name: string;
  email: string;
  password: string;
  role?: UserRole;
  organization_id?: number | null;
}

export const userApi = {
  list(): Promise<User[]> {
    return request<User[]>("/users");
  },

  create(data: CreateUserPayload): Promise<unknown> {
    return request("/users", { method: "POST", body: data });
  },

  remove(id: number): Promise<unknown> {
    return request(`/users/${id}`, { method: "DELETE" });
  },

  lookupByEmail(email: string): Promise<User> {
    return request<User>(`/users/lookup?email=${encodeURIComponent(email)}`);
  },
};
