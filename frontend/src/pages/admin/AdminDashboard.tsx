import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { adminApi } from "../../api/adminApi";
import type { AdminStats, User } from "../../types";
import { auditActionLabel } from "../../utils/audit";
import { formatDate } from "../../utils/format";
import { ROLE_LABELS } from "../../utils/roles";

const ROLE_ORDER: User["role"][] = [
  "super_admin",
  "manager",
  "staff",
  "individual",
];

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: "Chờ duyệt", cls: "pending" },
  approved: { label: "Đã duyệt", cls: "approved" },
  rejected: { label: "Bị từ chối", cls: "rejected" },
  uploaded: { label: "Đã tải lên", cls: "neutral" },
  completed: { label: "Đã index", cls: "indexed" },
  indexed: { label: "Đã index", cls: "indexed" },
  processing: { label: "Đang xử lý", cls: "processing" },
};

function statusMeta(status: string) {
  const s = (status || "").toLowerCase();
  return STATUS_META[s] ?? { label: status || "Khác", cls: "neutral" };
}

function barPercent(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.round((value / max) * 100);
}

// Trang dashboard quản trị: hiển thị thống kê hệ thống, biểu đồ, tài liệu chờ duyệt
export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [pending, setPending] = useState<Awaited<
    ReturnType<typeof adminApi.pendingApprovals>
  > | null>(null);
  const [error, setError] = useState("");

  // Tải song song dữ liệu thống kê, danh sách người dùng và tài liệu chờ duyệt
  const load = useCallback(async () => {
    try {
      const [statsData, userList, pendingList] = await Promise.all([
        adminApi.getStats(),
        adminApi.listUsers(),
        adminApi.pendingApprovals(),
      ]);
      setStats(statsData);
      setUsers(userList);
      setPending(pendingList);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return <div className="alert alert-error">{error}</div>;
  }

  if (!stats) {
    return <p className="muted">Đang tải…</p>;
  }

  const userNameById = (id: number | null | undefined) =>
    users.find((u) => u.id === id)?.full_name ?? "Hệ thống";

  const maxRole = Math.max(...stats.users_by_role.map((r) => r.count), 0);
  const maxStatus = Math.max(...stats.documents_by_status.map((d) => d.count), 0);
  const totalDocs = stats.documents_by_status.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="admin-dashboard">
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon blue">👥</div>
          <div className="stat-card-body">
            <div className="stat-value">{stats.total_users}</div>
            <div className="stat-label">Người dùng</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">🏢</div>
          <div className="stat-card-body">
            <div className="stat-value">{stats.total_organizations}</div>
            <div className="stat-label">Tổ chức</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber">📄</div>
          <div className="stat-card-body">
            <div className="stat-value">{stats.total_documents}</div>
            <div className="stat-label">Tài liệu</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon violet">🕓</div>
          <div className="stat-card-body">
            <div className="stat-value">{stats.total_audit_logs}</div>
            <div className="stat-label">Sự kiện hoạt động</div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-main">
          <section className="panel">
            <h2 className="panel-title">
              Tài liệu theo trạng thái
              <span className="muted small">Tổng {totalDocs}</span>
            </h2>
            {stats.documents_by_status.length === 0 ? (
              <p className="muted">Chưa có tài liệu nào.</p>
            ) : (
              <div className="bar-list">
                {stats.documents_by_status.map((item) => {
                  const meta = statusMeta(item.status);
                  return (
                    <div className="bar-row" key={item.status}>
                      <div className="bar-row-label">
                        <span className={`status-badge ${meta.cls}`}>
                          {meta.label}
                        </span>
                        <span className="bar-row-value">{item.count}</span>
                      </div>
                      <div className="bar-track">
                        <div
                          className={`bar-fill ${meta.cls}`}
                          style={{ width: `${barPercent(item.count, maxStatus)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="panel">
            <h2 className="panel-title">
              Chờ phê duyệt
              <Link to="/documents" className="primary-link">
                Xem tài liệu
              </Link>
            </h2>
            {!pending || pending.length === 0 ? (
              <p className="muted">Không có tài liệu nào đang chờ duyệt.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tài liệu</th>
                    <th>Người tạo</th>
                    <th>Ngày tạo</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((doc) => (
                    <tr key={doc.id}>
                      <td>
                        <Link to={`/documents/${doc.id}`} className="doc-title">
                          {doc.title}
                        </Link>
                      </td>
                      <td className="muted">{userNameById(doc.owner_id)}</td>
                      <td className="muted">{formatDate(doc.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <aside className="dashboard-side">
          <section className="panel">
            <h2 className="panel-title">Phân bố vai trò</h2>
            {stats.users_by_role.length === 0 ? (
              <p className="muted">Chưa có dữ liệu.</p>
            ) : (
              <div className="bar-list">
                {ROLE_ORDER.filter((role) =>
                  stats.users_by_role.some((r) => r.role === role)
                ).map((role) => {
                  const item = stats.users_by_role.find((r) => r.role === role);
                  const count = item?.count ?? 0;
                  return (
                    <div className="bar-row" key={role}>
                      <div className="bar-row-label">
                        <span className={`role-badge role-${role}`}>
                          {ROLE_LABELS[role] ?? role}
                        </span>
                        <span className="bar-row-value">{count}</span>
                      </div>
                      <div className="bar-track">
                        <div
                          className="bar-fill role"
                          style={{ width: `${barPercent(count, maxRole)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="panel">
            <h2 className="panel-title">Tổ chức</h2>
            {stats.organizations.length === 0 ? (
              <p className="muted">Chưa có tổ chức nào.</p>
            ) : (
              <ul className="insight-list">
                {stats.organizations.map((org) => (
                  <li key={org.id} className="org-stat-item">
                    <Link to={`/admin/tenants`} className="org-stat-name">
                      {org.name}
                    </Link>
                    <span className="badge">{org.member_count} thành viên</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <h2 className="panel-title">Hoạt động gần đây</h2>
            {stats.recent_activity.length === 0 ? (
              <p className="muted">Chưa có hoạt động nào.</p>
            ) : (
              <ul className="activity-list">
                {stats.recent_activity.map((log) => (
                  <li key={log.id}>
                    <div className="audit-item-head">
                      <span className="badge">{auditActionLabel(log.action)}</span>
                      <span className="muted small">
                        {formatDate(log.created_at)}
                      </span>
                    </div>
                    <div className="activity-body">
                      <span className="activity-user">
                        {userNameById(log.user_id)}
                      </span>
                      {log.details && (
                        <span className="muted small"> · {log.details}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
