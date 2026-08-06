import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import Button from "../components/ui/Button.tsx";
import { useAuth } from "../hooks/useAuth";
import { ROLE_LABELS } from "../utils/roles";

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Chính",
    items: [{ to: "/dashboard", label: "Bảng điều khiển", icon: "🏠" }],
  },
  {
    label: "Quản lý",
    items: [{ to: "/documents", label: "Tài liệu", icon: "📁" }],
  },
  {
    label: "AI",
    items: [
      { to: "/search", label: "Tìm kiếm", icon: "🔍" },
      { to: "/chat", label: "Chat", icon: "💬" },
    ],
  },
];

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Bảng điều khiển",
  "/documents": "Quản lý tài liệu",
  "/search": "Tìm kiếm ngữ nghĩa",
  "/chat": "Chat với tài liệu",
  "/admin": "Quản trị hệ thống",
};

function initials(name?: string) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebar_collapsed") === "1"
  );

  useEffect(() => {
    localStorage.setItem("sidebar_collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  const showAdmin = user?.role === "super_admin" || user?.role === "manager";

  const groups: NavGroup[] = showAdmin
    ? [
        ...NAV_GROUPS,
        { label: "Hệ thống", items: [{ to: "/admin", label: "Quản trị", icon: "🛠️" }] },
      ]
    : NAV_GROUPS;

  const pageTitle = PAGE_TITLES[location.pathname] || "AI Document Manager";

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className={`layout ${collapsed ? "collapsed" : ""}`}>
      <aside className="layout-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-logo">📄</div>
          <div className="sidebar-brand-name">AI Document Manager</div>
        </div>

        <nav className="sidebar-nav">
          {groups.map((group) => (
            <div className="sidebar-group" key={group.label}>
              <div className="sidebar-group-label">{group.label}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    isActive ? "nav-link active" : "nav-link"
                  }
                  title={item.label}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            className="collapse-button"
            onClick={() => setCollapsed((c) => !c)}
          >
            <span>{collapsed ? "➡️" : "⬅️"}</span>
            <span className="collapse-label">Thu gọn</span>
          </button>
        </div>
      </aside>

      <div className="layout-main">
        <header className="topbar">
          <div className="topbar-title">
            <h1>{pageTitle}</h1>
          </div>
          <div className="topbar-actions">
            <div className="user-menu">
              <div className="avatar">{initials(user?.full_name)}</div>
              <div className="user-menu-info">
                <div className="user-name">{user?.full_name}</div>
                <div className="user-role">
                  {user ? ROLE_LABELS[user.role] || user.role : ""}
                </div>
              </div>
            </div>
            <Button type="button" variant="text" onClick={handleLogout}>
              Đăng xuất
            </Button>
          </div>
        </header>

        <main className="layout-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
