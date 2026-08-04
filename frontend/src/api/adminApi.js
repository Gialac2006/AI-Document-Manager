import { request } from "./httpClient";

export const adminApi = {
  listOrganizations() {
    return request("/admin/organizations");
  },

  createOrganization(name) {
    return request("/admin/organizations", {
      method: "POST",
      body: { name },
    });
  },

  getOrganization(id) {
    return request(`/admin/organizations/${id}`);
  },

  deleteOrganization(id) {
    return request(`/admin/organizations/${id}`, { method: "DELETE" });
  },

  listUsers() {
    return request("/admin/users");
  },
};
