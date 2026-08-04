import { useCallback, useEffect, useState } from "react";

import { adminApi } from "../api/adminApi";
import { userApi } from "../api/userApi";
import Button from "../components/ui/Button.jsx";
import { useAuth } from "../hooks/useAuth";
import { ROLE_LABELS } from "../utils/roles";

const ROLE_OPTIONS = [
  { value: "staff", label: "Nhân viên" },
  { value: "manager", label: "Quản lý" },
  { value: "individual", label: "Cá nhân" },
];

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("vi-VN");
}

export default function AdminPage() {
  const { user } = useAuth();

  return (
    <div>
      <h1>Quản trị</h1>
      {user?.role === "super_admin" ? <SuperAdminPanel /> : <ManagerPanel />}
    </div>
  );
}

function Alert({ type, children }) {
  if (!children) return null;
  return <div className={`alert alert-${type}`}>{children}</div>;
}

function SuperAdminPanel() {
  const [organizations, setOrganizations] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [orgName, setOrgName] = useState("");
  const [expandedOrg, setExpandedOrg] = useState(null);
  const [orgMembers, setOrgMembers] = useState([]);

  const [newUser, setNewUser] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "staff",
    organization_id: "",
  });

  const load = useCallback(async () => {
    const [orgs, usrs] = await Promise.all([
      adminApi.listOrganizations(),
      adminApi.listUsers(),
    ]);
    setOrganizations(orgs);
    setUsers(usrs);
  }, []);

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [load]);

  const handleCreateOrg = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await adminApi.createOrganization(orgName.trim());
      setOrgName("");
      setMessage("Đã tạo tổ chức");
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteOrg = async (id) => {
    if (!window.confirm("Xoá tổ chức và toàn bộ người dùng bên trong?")) return;
    setError("");
    setMessage("");
    try {
      await adminApi.deleteOrganization(id);
      setMessage("Đã xoá tổ chức");
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleOrg = async (id) => {
    if (expandedOrg === id) {
      setExpandedOrg(null);
      setOrgMembers([]);
      return;
    }
    try {
      const detail = await adminApi.getOrganization(id);
      setOrgMembers(detail.members || []);
      setExpandedOrg(id);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await userApi.create({
        full_name: newUser.full_name,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role,
        organization_id: newUser.organization_id
          ? Number(newUser.organization_id)
          : null,
      });
      setNewUser({
        full_name: "",
        email: "",
        password: "",
        role: "staff",
        organization_id: "",
      });
      setMessage("Đã tạo người dùng");
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm("Xoá người dùng này?")) return;
    setError("");
    setMessage("");
    try {
      await userApi.remove(id);
      setMessage("Đã xoá người dùng");
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="admin-panels">
      <Alert type="error">{error}</Alert>
      <Alert type="success">{message}</Alert>

      <section className="panel">
        <h2>Tổ chức</h2>

        <form className="inline-form" onSubmit={handleCreateOrg}>
          <input
            type="text"
            required
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Tên tổ chức mới"
          />
          <Button variant="secondary" type="submit">
            Tạo tổ chức
          </Button>
        </form>

        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tên</th>
              <th>Ngày tạo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {organizations.map((org) => (
              <OrganizationRow
                key={org.id}
                org={org}
                expanded={expandedOrg === org.id}
                members={orgMembers}
                onToggle={() => toggleOrg(org.id)}
                onDelete={() => handleDeleteOrg(org.id)}
              />
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>Người dùng hệ thống</h2>

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
            minLength={6}
            value={newUser.password}
            onChange={(e) =>
              setNewUser({ ...newUser, password: e.target.value })
            }
            placeholder="Mật khẩu"
          />
          <select
            value={newUser.role}
            onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.full_name}</td>
                <td>{u.email}</td>
                <td>
                  <span className={`role-badge role-${u.role}`}>
                    {ROLE_LABELS[u.role] || u.role}
                  </span>
                </td>
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
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function OrganizationRow({ org, expanded, members, onToggle, onDelete }) {
  return (
    <>
      <tr>
        <td>{org.id}</td>
        <td>{org.name}</td>
        <td>{formatDate(org.created_at)}</td>
        <td>
          <Button variant="secondary" type="button" onClick={onToggle}>
            {expanded ? "Ẩn thành viên" : "Thành viên"}
          </Button>{" "}
          <Button variant="danger" type="button" onClick={onDelete}>
            Xoá
          </Button>
        </td>
      </tr>
      {expanded && (
        <tr className="org-members-row">
          <td colSpan={4}>
            {members.length === 0 ? (
              <p className="muted">Tổ chức chưa có thành viên.</p>
            ) : (
              <ul className="member-list">
                {members.map((member) => (
                  <li key={member.id}>
                    {member.full_name} — {member.email} (
                    {ROLE_LABELS[member.role] || member.role})
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function ManagerPanel() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [newUser, setNewUser] = useState({
    full_name: "",
    email: "",
    password: "",
  });

  const load = useCallback(async () => {
    const usrs = await userApi.list();
    setUsers(usrs);
  }, []);

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [load]);

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await userApi.create({
        full_name: newUser.full_name,
        email: newUser.email,
        password: newUser.password,
      });
      setNewUser({ full_name: "", email: "", password: "" });
      setMessage("Đã thêm nhân viên");
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteStaff = async (id) => {
    if (!window.confirm("Xoá nhân viên này?")) return;
    setError("");
    setMessage("");
    try {
      await userApi.remove(id);
      setMessage("Đã xoá nhân viên");
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="admin-panels">
      <Alert type="error">{error}</Alert>
      <Alert type="success">{message}</Alert>

      <section className="panel">
        <h2>Nhân viên trong tổ chức</h2>
        <p className="muted">Thêm và quản lý nhân viên của tổ chức bạn.</p>

        <form className="create-user-form" onSubmit={handleCreateStaff}>
          <input
            type="text"
            required
            value={newUser.full_name}
            onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
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
            minLength={6}
            value={newUser.password}
            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            placeholder="Mật khẩu"
          />
          <Button variant="secondary" type="submit">
            Thêm nhân viên
          </Button>
        </form>

        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Họ và tên</th>
              <th>Email</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.full_name}</td>
                <td>{u.email}</td>
                <td>
                  <Button
                    variant="danger"
                    type="button"
                    onClick={() => handleDeleteStaff(u.id)}
                  >
                    Xoá
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
