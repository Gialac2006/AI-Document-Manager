import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { adminApi } from "../../api/adminApi";
import { userApi } from "../../api/userApi";
import Button from "../../components/ui/Button.tsx";
import { useAuth } from "../../hooks/useAuth";
import type { Organization, User, UserRole } from "../../types";
import { downloadCSV } from "../../utils/csv";
import { formatDate } from "../../utils/format";
import { ROLE_LABELS } from "../../utils/roles";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "staff", label: "Nhân viên" },
  { value: "manager", label: "Quản lý" },
  { value: "individual", label: "Cá nhân" },
];

interface NewUserForm {
  full_name: string;
  email: string;
  password: string;
  role: UserRole;
  organization_id: string;
}

const EMPTY_NEW_USER: NewUserForm = {
  full_name: "",
  email: "",
  password: "",
  role: "staff",
  organization_id: "",
};

// Trang quản lý người dùng: xem, tạo, xoá, lọc và xuất CSV danh sách người dùng
export default function UsersAdminPage() {
  const { user } = useAuth();
  const isSuper = user?.role === "super_admin";

  const [users, setUsers] = useState<User[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [orgFilter, setOrgFilter] = useState("");
  const [newUser, setNewUser] = useState<NewUserForm>(EMPTY_NEW_USER);

  const load = useCallback(async () => {
    if (isSuper) {
      const [userList, orgList] = await Promise.all([
        adminApi.listUsers(),
        adminApi.listOrganizations(),
      ]);
      setUsers(userList);
      setOrganizations(orgList);
    } else {
      setUsers(await userApi.list());
    }
  }, [isSuper]);

  useEffect(() => {
    load().catch((err) => setError((err as Error).message));
  }, [load]);

  // Lọc danh sách người dùng theo từ khoá, vai trò và tổ chức
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (q && !`${u.full_name} ${u.email}`.toLowerCase().includes(q)) {
        return false;
      }
      if (roleFilter && u.role !== roleFilter) return false;
      if (orgFilter && u.organization_id !== Number(orgFilter)) return false;
      return true;
    });
  }, [users, search, roleFilter, orgFilter]);

  const orgName = (id: number | null) =>
    organizations.find((o) => o.id === id)?.name ?? "—";

  // Tạo người dùng mới từ form, phân quyền vai trò theo super_admin
  const handleCreateUser = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await userApi.create({
        full_name: newUser.full_name.trim(),
        email: newUser.email.trim(),
        password: newUser.password,
        role: isSuper ? newUser.role : undefined,
        organization_id: isSuper && newUser.organization_id
          ? Number(newUser.organization_id)
          : undefined,
      });
      setNewUser(EMPTY_NEW_USER);
      setMessage("Đã tạo người dùng");
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Xoá người dùng sau khi xác nhận và làm mới danh sách
  const handleDeleteUser = async (id: number) => {
    if (!window.confirm("Xoá người dùng này?")) return;
    setError("");
    setMessage("");
    try {
      await userApi.remove(id);
      setMessage("Đã xoá người dùng");
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Xuất danh sách người dùng đã lọc ra file CSV
  const handleExport = () => {
    const rows = filtered.map((u) => [
      u.id,
      u.full_name,
      u.email,
      ROLE_LABELS[u.role] ?? u.role,
      isSuper ? orgName(u.organization_id) : "Tổ chức của tôi",
      formatDate(u.created_at),
    ]);
    downloadCSV(
      `users-${new Date().toISOString().slice(0, 10)}.csv`,
      ["ID", "Họ và tên", "Email", "Vai trò", "Tổ chức", "Ngày tạo"],
      rows,
    );
  };

  return (
    <div className="admin-panels">
      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <section className="panel">
        <h2 className="panel-title">
          {isSuper ? "Người dùng hệ thống" : "Nhân viên trong tổ chức"}
          <Button variant="secondary" type="button" onClick={handleExport}>
            ⬇️ Export CSV
          </Button>
        </h2>
        <p className="muted">
          {isSuper
            ? "Quản lý tất cả người dùng trên hệ thống, có thể xuất danh sách ra CSV."
            : "Thêm và quản lý nhân viên của tổ chức bạn."}
        </p>

        <div className="filter-bar">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên hoặc email…"
            className="filter-input"
            aria-label="Tìm người dùng"
          />
          {isSuper && (
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="filter-select"
              aria-label="Lọc theo vai trò"
            >
              <option value="">Tất cả vai trò</option>
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
          {isSuper && (
            <select
              value={orgFilter}
              onChange={(e) => setOrgFilter(e.target.value)}
              className="filter-select"
              aria-label="Lọc theo tổ chức"
            >
              <option value="">Tất cả tổ chức</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <form className="create-user-form" onSubmit={handleCreateUser}>
          <input
            type="text"
            required
            value={newUser.full_name}
            onChange={(e) =>
              setNewUser({ ...newUser, full_name: e.target.value })
            }
            placeholder="Họ và tên"
          />
          <input
            type="email"
            required
            value={newUser.email}
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            placeholder="Email"
          />
          <input
            type="password"
            required
            minLength={8}
            value={newUser.password}
            onChange={(e) =>
              setNewUser({ ...newUser, password: e.target.value })
            }
            placeholder="Mật khẩu"
          />
          {isSuper && (
            <select
              value={newUser.role}
              onChange={(e) =>
                setNewUser({ ...newUser, role: e.target.value as UserRole })
              }
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
          {isSuper && (
            <select
              value={newUser.organization_id}
              onChange={(e) =>
                setNewUser({ ...newUser, organization_id: e.target.value })
              }
            >
              <option value="">Không thuộc tổ chức</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          )}
          <Button variant="secondary" type="submit">
            Tạo người dùng
          </Button>
        </form>

        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Họ và tên</th>
              <th>Email</th>
              <th>Vai trò</th>
              {isSuper && <th>Tổ chức</th>}
              <th>Ngày tạo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={isSuper ? 7 : 6} className="muted">
                  Không có người dùng nào.
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.full_name}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`role-badge role-${u.role}`}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </td>
                  {isSuper && <td className="muted">{orgName(u.organization_id)}</td>}
                  <td className="muted">{formatDate(u.created_at)}</td>
                  <td>
                    <Button
                      variant="danger"
                      type="button"
                      onClick={() => handleDeleteUser(u.id)}
                    >
                      Xoá
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
