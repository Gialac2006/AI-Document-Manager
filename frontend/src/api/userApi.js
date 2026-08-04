import { request } from "./httpClient";

export const userApi = {
  list() {
    return request("/users");
  },

  create(data) {
    return request("/users", { method: "POST", body: data });
  },

  remove(id) {
    return request(`/users/${id}`, { method: "DELETE" });
  },
};
