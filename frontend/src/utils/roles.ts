import type { UserRole } from "../types";

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Admin hệ thống",
  manager: "Quản lý",
  staff: "Nhân viên",
  individual: "Cá nhân",
};

export function homeForRole(role: UserRole) {
  return role === "super_admin" || role === "manager" ? "/admin" : "/dashboard";
}
