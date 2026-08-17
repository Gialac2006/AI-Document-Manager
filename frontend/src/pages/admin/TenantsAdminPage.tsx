import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { adminApi } from "../../api/adminApi";
import Button from "../../components/ui/Button.tsx";
import type { Organization, User } from "../../types";
import { formatDate } from "../../utils/format";
import { ROLE_LABELS } from "../../utils/roles";

type SortKey = "name" | "member_count" | "created_at";
type SortDir = "asc" | "desc";

interface SortState {
  key: SortKey;
  dir: SortDir;
}

const SORTABLE_KEYS: SortKey[] = ["name", "member_count", "created_at"];

// Trang quản lý tổ chức (tenant): tạo, xoá, tìm kiếm, sắp xếp và xem thành viên
export default function TenantsAdminPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [orgName, setOrgName] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState>({ key: "name", dir: "asc" });
  const [expandedOrg, setExpandedOrg] = useState<number | null>(null);
  const [orgMembers, setOrgMembers] = useState<User[]>([]);

  const load = useCallback(async () => {
    setOrganizations(await adminApi.listOrganizations());
  }, []);

  useEffect(() => {
    load().catch((err) => setError((err as Error).message));
  }, [load]);

  // Lọc và sắp xếp danh sách tổ chức theo từ khoá tìm kiếm và thứ tự đã chọn
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = organizations.filter(
      (org) => !q || org.name.toLowerCase().includes(q),
    );
    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      if (sort.key === "name") {
        cmp = a.name.localeCompare(b.name, "vi");
      } else if (sort.key === "member_count") {
        cmp = (a.member_count ?? 0) - (b.member_count ?? 0);
      } else {
        cmp = (a.created_at || "").localeCompare(b.created_at || "");
      }
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [organizations, search, sort]);

  // Đổi hướng sắp xếp tăng/giảm khi click vào cột
  const toggleSort = (key: SortKey) => {
    if (!SORTABLE_KEYS.includes(key)) return;
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  };

  const sortIndicator = (key: SortKey) => {
    if (sort.key !== key) return "";
    return sort.dir === "asc" ? " ↑" : " ↓";
  };

  // Tạo tổ chức mới từ form và làm mới danh sách
  const handleCreateOrg = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await adminApi.createOrganization(orgName.trim());
      setOrgName("");
      setMessage("Đã tạo tổ chức");
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Xoá tổ chức sau khi xác nhận, kèm toàn bộ người dùng bên trong
  const handleDeleteOrg = async (id: number) => {
    if (!window.confirm("Xoá tổ chức và toàn bộ người dùng bên trong?")) return;
    setError("");
    setMessage("");
    try {
      await adminApi.deleteOrganization(id);
      setMessage("Đã xoá tổ chức");
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Bung/thu chi tiết thành viên của một tổ chức
  const toggleOrg = async (id: number) => {
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
      setError((err as Error).message);
    }
  };

  return (
    <div className="admin-panels">
      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <section className="panel">
        <h2 className="panel-title">Tổ chức (Tenant)</h2>
        <p className="muted">
          Quản lý các tổ chức trên hệ thống. Mỗi tổ chức chứa tài liệu và thành viên riêng.
        </p>

        <form className="inline-form" onSubmit={handleCreateOrg}>
          <input
            type="text"
            required
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Tên tổ chức mới"
            aria-label="Tên tổ chức mới"
          />
          <Button variant="secondary" type="submit">
            Tạo tổ chức
          </Button>
        </form>

        <div className="filter-bar">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên tổ chức…"
            className="filter-input"
            aria-label="Tìm tổ chức"
          />
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>
                <button type="button" className="sort-header" onClick={() => toggleSort("name")}>
                  Tên{sortIndicator("name")}
                </button>
              </th>
              <th>
                <button type="button" className="sort-header" onClick={() => toggleSort("member_count")}>
                  Thành viên{sortIndicator("member_count")}
                </button>
              </th>
              <th>
                <button type="button" className="sort-header" onClick={() => toggleSort("created_at")}>
                  Ngày tạo{sortIndicator("created_at")}
                </button>
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  Không có tổ chức nào.
                </td>
              </tr>
            ) : (
              filtered.map((org) => (
                <OrganizationRow
                  key={org.id}
                  org={org}
                  expanded={expandedOrg === org.id}
                  members={orgMembers}
                  onToggle={() => toggleOrg(org.id)}
                  onDelete={() => handleDeleteOrg(org.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

interface OrganizationRowProps {
  org: Organization;
  expanded: boolean;
  members: User[];
  onToggle: () => void;
  onDelete: () => void;
}

// Dòng hiển thị một tổ chức, có nút xem thành viên và xoá
function OrganizationRow({ org, expanded, members, onToggle, onDelete }: OrganizationRowProps) {
  return (
    <>
      <tr>
        <td>{org.id}</td>
        <td>{org.name}</td>
        <td>
          <span className="badge">{org.member_count ?? 0} thành viên</span>
        </td>
        <td className="muted">{formatDate(org.created_at)}</td>
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
          <td colSpan={5}>
            {members.length === 0 ? (
              <p className="muted">Tổ chức chưa có thành viên.</p>
            ) : (
              <ul className="member-list">
                {members.map((member) => (
                  <li key={member.id}>
                    {member.full_name} — {member.email}{" "}
                    <span className={`role-badge role-${member.role}`}>
                      {ROLE_LABELS[member.role] ?? member.role}
                    </span>
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
