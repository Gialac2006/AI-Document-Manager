import type { ForgotPasswordResponse, User } from "../types";
import { request, setToken } from "./httpClient";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  full_name: string;
  email: string;
  password: string;
  organization_name?: string;
}

interface AuthResponse {
  user: User;
  token: { access_token: string };
}

export const authApi = {
  async login({ email, password }: LoginCredentials): Promise<User> {
    const data = await request<AuthResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
    setToken(data.token.access_token);
    return data.user;
  },

  async register(data: RegisterPayload): Promise<User> {
    const response = await request<AuthResponse>("/auth/register", {
      method: "POST",
      body: data,
      auth: false,
    });
    return response.user;
  },

  me(): Promise<User> {
    return request<User>("/auth/me");
  },

  forgotPassword(email: string): Promise<ForgotPasswordResponse> {
    return request<ForgotPasswordResponse>("/auth/forgot-password", {
      method: "POST",
      body: { email },
      auth: false,
    });
  },

  validateResetToken(token: string): Promise<{ valid: boolean }> {
    return request<{ valid: boolean }>(
      `/auth/reset-password/validate?token=${token}`,
      { auth: false }
    );
  },

  resetPassword(token: string, newPassword: string): Promise<unknown> {
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
