export const ROLE_LABELS = {
  super_admin: "Admin hệ thống",
  manager: "Quản lý",
  staff: "Nhân viên",
  individual: "Cá nhân",
};

export function homeForRole(role) {
  return role === "super_admin" || role === "manager" ? "/admin" : "/dashboard";
}
