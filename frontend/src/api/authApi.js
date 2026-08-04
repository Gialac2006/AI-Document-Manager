import { request, setToken } from "./httpClient";

export const authApi = {
  async login({ email, password }) {
    const data = await request("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
    setToken(data.token.access_token);
    return data.user;
  },

  async register({ full_name, email, password, organization_name }) {
    const data = await request("/auth/register", {
      method: "POST",
      body: { full_name, email, password, organization_name },
      auth: false,
    });
    return data.user;
  },

  me() {
    return request("/auth/me");
  },

  forgotPassword(email) {
    return request("/auth/forgot-password", {
      method: "POST",
      body: { email },
      auth: false,
    });
  },

  validateResetToken(token) {
    return request(`/auth/reset-password/validate?token=${token}`, {
      auth: false,
    });
  },

  resetPassword(token, newPassword) {
    return request("/auth/reset-password", {
      method: "POST",
      body: { token, new_password: newPassword },
      auth: false,
    });
  },

  logout() {
    setToken(null);
  },
};
