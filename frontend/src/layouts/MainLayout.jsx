import { NavLink, Outlet, useNavigate } from "react-router-dom";

import Button from "../components/ui/Button.jsx";
import { useAuth } from "../hooks/useAuth";
import { ROLE_LABELS } from "../utils/roles";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Bảng điều khiển" },
  { to: "/documents", label: "Tài liệu" },
  { to: "/search", label: "Tìm kiếm" },
  { to: "/chat", label: "Chat" },
];

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const showAdmin = user?.role === "super_admin" || user?.role === "manager";

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="layout">
      <aside className="layout-sidebar">
        <div className="sidebar-brand">AI Document Manager</div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              {item.label}
            </NavLink>
          ))}
          {showAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              Quản trị
            </NavLink>
          )}
        </nav>
      </aside>

      <div className="layout-main">
        <header className="layout-header">
          <div className="header-user">
            <div className="user-name">{user?.full_name}</div>
            <div className="user-role">
              {user ? ROLE_LABELS[user.role] || user.role : ""}
            </div>
          </div>
          <Button type="button" variant="text" onClick={handleLogout}>
            Đăng xuất
          </Button>
        </header>

        <main className="layout-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
