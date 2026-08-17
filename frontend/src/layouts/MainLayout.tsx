import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { ROLE_LABELS } from "../utils/roles";
import { formatDate } from "../utils/format";

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
  "/admin/dashboard": "Dashboard",
  "/admin/users": "Quản lý người dùng",
  "/admin/tenants": "Quản lý tổ chức",
  "/admin/audit-logs": "Nhật ký hoạt động",
};

// Lấy chữ cái đầu của họ tên để hiển thị avatar
function initials(name?: string) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

// Layout chính sau khi đăng nhập: sidebar, topbar với menu người dùng và vùng nội dung
export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebar_collapsed") === "1"
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem("sidebar_collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const showAdmin = user?.role === "super_admin" || user?.role === "manager";

  const groups: NavGroup[] = showAdmin
    ? [
        ...NAV_GROUPS,
        { label: "Hệ thống", items: [{ to: "/admin", label: "Quản trị", icon: "🛠️" }] },
      ]
    : NAV_GROUPS;

  const pageTitle = PAGE_TITLES[location.pathname] || "AI Document Manager";

  // Xử lý đăng xuất: đóng menu rồi chuyển về trang đăng nhập
  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate("/login", { replace: true });
  };

  // Xử lý tìm kiếm ở topbar: chuyển sang trang tìm kiếm với từ khoá
  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  const goToProfile = () => {
    setMenuOpen(false);
    navigate("/profile");
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
            <form className="topbar-search" onSubmit={handleSearch}>
              <span className="topbar-search-icon">🔍</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm tài liệu..."
                aria-label="Tìm kiếm tài liệu"
              />
            </form>

            <div className="dropdown" ref={menuRef}>
              <button
                type="button"
                className="dropdown-trigger"
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <div className="avatar">{initials(user?.full_name)}</div>
                <div className="user-menu-info">
                  <div className="user-name">{user?.full_name}</div>
                  <div className="user-role">
                    {user ? ROLE_LABELS[user.role] || user.role : ""}
                  </div>
                </div>
              </button>

              {menuOpen && (
                <div className="dropdown-menu" role="menu">
                  <div className="dropdown-header">
                    <span className="dropdown-header-info">Thông tin người dùng</span>
                    <Link
                      to="/profile"
                      className="dropdown-profile-link"
                      onClick={() => setMenuOpen(false)}
                      title="Hồ sơ"
                    >
                      <span className="dropdown-avatar">
                        {initials(user?.full_name)}
                      </span>
                      <span className="dropdown-identity">
                        <span className="dropdown-name">{user?.full_name}</span>
                        <span className="dropdown-email">{user?.email}</span>
                      </span>
                    </Link>
                  </div>

                  <div className="dropdown-info">
                    <div className="dropdown-info-row">
                      <span className="dropdown-info-label">Vai trò</span>
                      <span className={`role-badge role-${user?.role}`}>
                        {user ? ROLE_LABELS[user.role] || user.role : ""}
                      </span>
                    </div>
                    <div className="dropdown-info-row">
                      <span className="dropdown-info-label">Tham gia</span>
                      <span className="dropdown-info-value">
                        {formatDate(user?.created_at)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="dropdown-item profile-item"
                    onClick={goToProfile}
                    role="menuitem"
                  >
                    👤 Thông tin người dùng
                  </button>
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={handleLogout}
                    role="menuitem"
                  >
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="layout-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
