import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";

interface Tab {
  to: string;
  label: string;
  end?: boolean;
}

// Layout quản trị: hiển thị thanh tab điều hướng, phân quyền theo vai trò super_admin
export default function AdminLayout() {
  const { user } = useAuth();
  const isSuper = user?.role === "super_admin";

  const tabs: Tab[] = isSuper
    ? [
        { to: "/admin/dashboard", label: "Dashboard", end: true },
        { to: "/admin/users", label: "Người dùng" },
        { to: "/admin/tenants", label: "Tổ chức" },
        { to: "/admin/audit-logs", label: "Nhật ký hoạt động" },
      ]
    : [
        { to: "/admin/users", label: "Người dùng" },
        { to: "/admin/audit-logs", label: "Nhật ký hoạt động" },
      ];

  return (
    <div className="admin-layout">
      <nav className="admin-tabs" aria-label="Quản trị">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              isActive ? "admin-tab active" : "admin-tab"
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
