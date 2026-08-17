import { useCallback, useEffect, useState } from "react";

import { adminApi } from "../../api/adminApi";
import { userApi } from "../../api/userApi";
import Button from "../../components/ui/Button.tsx";
import { useAuth } from "../../hooks/useAuth";
import type { AuditLog, AuditLogQuery, User } from "../../types";
import { AUDIT_ACTION_OPTIONS, auditActionLabel } from "../../utils/audit";
import { downloadCSV } from "../../utils/csv";
import { formatDate } from "../../utils/format";

const PAGE_SIZE = 50;
const EXPORT_LIMIT = 500;

// Trang nhật ký hoạt động: xem, lọc và xuất CSV lịch sử hành động của người dùng
export default function AuditLogsAdminPage() {
  const { user } = useAuth();
  const isSuper = user?.role === "super_admin";

  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [selectedUserId, setSelectedUserId] = useState<number | "">("");
  const [actionFilter, setActionFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Nạp danh sách người dùng để hiển thị tên thay cho id trong log
  const loadUsers = useCallback(async () => {
    if (isSuper) {
      setUsers(await adminApi.listUsers());
    } else {
      setUsers(await userApi.list());
    }
  }, [isSuper]);

  useEffect(() => {
    loadUsers().catch((err) => setError((err as Error).message));
  }, [loadUsers]);

  // Xây dựng query lọc log theo người dùng, hành động và khoảng thời gian
  const buildQuery = useCallback(
    (nextOffset: number, limit: number): AuditLogQuery => {
      const query: AuditLogQuery = { offset: nextOffset, limit };
      if (selectedUserId !== "") query.user_id = selectedUserId;
      if (actionFilter) query.action = actionFilter;
      if (dateFrom) query.date_from = `${dateFrom}T00:00:00`;
      if (dateTo) query.date_to = `${dateTo}T23:59:59`;
      return query;
    },
    [selectedUserId, actionFilter, dateFrom, dateTo],
  );

  // Tải danh sách log theo offset để phân trang
  const load = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      setError("");
      try {
        const data = await adminApi.listAllAuditLogs(
          buildQuery(nextOffset, PAGE_SIZE),
        );
        setLogs(data);
        setOffset(nextOffset);
        setHasMore(data.length === PAGE_SIZE);
      } catch (err) {
        setError((err as Error).message);
        setLogs([]);
      } finally {
        setLoading(false);
      }
    },
    [buildQuery],
  );

  useEffect(() => {
    load(0);
  }, [load]);

  const userNameById = (id: number | null | undefined) =>
    users.find((u) => u.id === id)?.full_name ?? "Hệ thống";

  // Xuất danh sách log hiện tại ra file CSV
  const handleExport = async () => {
    try {
      const data = await adminApi.listAllAuditLogs(
        buildQuery(0, EXPORT_LIMIT),
      );
      const rows = data.map((log) => [
        log.id,
        userNameById(log.user_id),
        auditActionLabel(log.action),
        log.entity_type ?? "",
        log.details ?? "",
        formatDate(log.created_at),
      ]);
      downloadCSV(
        `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`,
        ["ID", "Người dùng", "Hành động", "Loại đối tượng", "Chi tiết", "Thời gian"],
        rows,
      );
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="admin-panels">
      {error && <div className="alert alert-error">{error}</div>}

      <section className="panel">
        <h2 className="panel-title">
          Nhật ký hoạt động
          <Button variant="secondary" type="button" onClick={handleExport}>
            ⬇️ Export CSV
          </Button>
        </h2>
        <p className="muted">
          {isSuper
            ? "Xem toàn bộ hoạt động trên hệ thống, lọc theo người dùng, hành động và thời gian."
            : "Xem lịch sử hoạt động của nhân viên trong tổ chức."}
        </p>

        <div className="filter-bar">
          <select
            value={selectedUserId}
            onChange={(e) =>
              setSelectedUserId(e.target.value ? Number(e.target.value) : "")
            }
            className="filter-select"
            aria-label="Lọc theo người dùng"
          >
            <option value="">
              {isSuper ? "Tất cả người dùng" : "Chọn người dùng…"}
            </option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} — {u.email}
              </option>
            ))}
          </select>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="filter-select"
            aria-label="Lọc theo hành động"
          >
            <option value="">Tất cả hành động</option>
            {AUDIT_ACTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="filter-input"
            aria-label="Từ ngày"
          />
          <span className="muted small">→</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="filter-input"
            aria-label="Đến ngày"
          />
        </div>

        {loading ? (
          <p className="muted">Đang tải…</p>
        ) : logs.length === 0 ? (
          <p className="muted">Không có bản ghi nào phù hợp.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Người dùng</th>
                <th>Hành động</th>
                <th>Loại đối tượng</th>
                <th>Chi tiết</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.id}</td>
                  <td className="muted">{userNameById(log.user_id)}</td>
                  <td>
                    <span className="badge">{auditActionLabel(log.action)}</span>
                  </td>
                  <td className="muted">{log.entity_type ?? "—"}</td>
                  <td className="muted">{log.details ?? "—"}</td>
                  <td className="muted">{formatDate(log.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="pagination-bar">
          <Button
            variant="secondary"
            type="button"
            disabled={offset === 0}
            onClick={() => load(offset - PAGE_SIZE)}
          >
            ← Trước
          </Button>
          <span className="muted small">
            Trang {Math.floor(offset / PAGE_SIZE) + 1}
          </span>
          <Button
            variant="secondary"
            type="button"
            disabled={!hasMore}
            onClick={() => load(offset + PAGE_SIZE)}
          >
            Sau →
          </Button>
        </div>
      </section>
    </div>
  );
}
