import type { Organization, OrganizationDetail, User } from "../types";
import { request } from "./httpClient";

export const adminApi = {
  listOrganizations(): Promise<Organization[]> {
    return request<Organization[]>("/admin/organizations");
  },

  createOrganization(name: string): Promise<unknown> {
    return request("/admin/organizations", {
      method: "POST",
      body: { name },
    });
  },

  getOrganization(id: number): Promise<OrganizationDetail> {
    return request<OrganizationDetail>(`/admin/organizations/${id}`);
  },

  deleteOrganization(id: number): Promise<unknown> {
    return request(`/admin/organizations/${id}`, { method: "DELETE" });
  },

  listUsers(): Promise<User[]> {
    return request<User[]>("/admin/users");
  },
};
