import { useCallback, useEffect, useState } from "react";
import { FileText, FolderOpen, Clock3, CircleCheck, Info, MessageSquare, ArrowRight } from "lucide-react";
import "../dashboard-page.css";
import { Link } from "react-router-dom";

import { documentApi } from "../api/documentApi";
import { folderApi } from "../api/folderApi";
import { useAuth } from "../hooks/useAuth";
import type { Document, Folder } from "../types";
import { formatDate } from "../utils/format";
import { fileTypeInfo, processingStatusInfo, statusInfo } from "../utils/documentMeta";
import { ROLE_LABELS } from "../utils/roles";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function DashboardPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [docResult, folderList] = await Promise.all([
        documentApi.list(null, 1, 100),
        folderApi.list(),
      ]);
      setDocuments(docResult.items);
      setTotalCount(docResult.total);
      setFolders(folderList);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải tổng quan.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const recent = [...documents]
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
    .slice(0, 8);
  const latest = recent[0];

  const total = totalCount;
  const folderCount = folders.length;
  const indexed = documents.filter((doc) =>
    ["text_extracted", "completed", "indexed"].includes(
      (doc.processing_status || "").toLowerCase()
    )
  ).length;
  const pending = documents.filter((doc) => ["processing", "pending"].includes((doc.processing_status || "").toLowerCase())).length;
  const weekAgo = Date.now() - WEEK_MS;
  const weeklyNew = documents.filter(
    (doc) => new Date(doc.created_at).getTime() >= weekAgo
  ).length;

  return (
    <div className="dashboard-grid overview-page">
      <div className="dashboard-main">
        <section className="hero-card">
          <div>
            <h1 className="hero-title">Chào mừng trở lại, {user?.full_name}</h1>
            <p className="hero-summary">
              Quản lý tài liệu, ghi chú và theo dõi nội dung đã lưu của bạn.
              {user && <> Vai trò: <strong>{ROLE_LABELS[user.role] || user.role}</strong>.</>}
            </p>
          </div>
          <div className="hero-actions">
            <Link to="/documents" className="primary-button">
              <FolderOpen size={17} aria-hidden="true" /> Mở tài liệu
            </Link>
            <Link to="/chat" className="outline-button">
              <MessageSquare size={17} aria-hidden="true" /> Bắt đầu chat
            </Link>
          </div>
        </section>

        {error && <div className="alert alert-error" role="alert">{error} <button type="button" className="secondary-button" onClick={() => void load()} disabled={loading}>Thử lại</button></div>}
        {loading && <p role="status" className="muted">Đang tải tổng quan...</p>}
        {!loading && !error && total > documents.length && <p className="muted overview-scope">Thống kê xử lý và số tài liệu thêm trong 7 ngày dựa trên {documents.length} tài liệu đã tải.</p>}

        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-icon blue"><FileText size={22} aria-hidden="true" /></div>
            <div className="stat-card-body">
              <div className="stat-head">
                <span className="stat-value">{loading || error ? "—" : total}</span>
                {!loading && !error && <span className="stat-trend up">+{weeklyNew} / 7 ngày</span>}
              </div>
              <div className="stat-label">Tổng tài liệu</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><FolderOpen size={22} aria-hidden="true" /></div>
            <div className="stat-card-body">
              <div className="stat-head">
                <span className="stat-value">{loading || error ? "—" : folderCount}</span>
              </div>
              <div className="stat-label">Thư mục</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon amber"><Clock3 size={22} aria-hidden="true" /></div>
            <div className="stat-card-body">
              <div className="stat-head">
                <span className="stat-value">{loading || error ? "—" : pending}</span>

              </div>
              <div className="stat-label">Đang chờ / xử lý</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon violet"><CircleCheck size={22} aria-hidden="true" /></div>
            <div className="stat-card-body">
              <div className="stat-head">
                <span className="stat-value">{loading || error ? "—" : indexed}</span>
              </div>
              <div className="stat-label">Đã trích xuất</div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="overview-section-heading"><h2>Tài liệu mới thêm</h2><Link to="/documents">Xem tất cả <ArrowRight size={16} aria-hidden="true" /></Link></div>
          {loading ? <p className="muted">Đang tải tài liệu...</p> : error ? <p className="muted">Chưa tải được danh sách tài liệu.</p> : recent.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon"><FolderOpen size={22} aria-hidden="true" /></span>
              Chưa có tài liệu nào.{" "}
              <Link to="/documents" className="primary-link">
                Tải tài liệu lên
              </Link>
            </div>
          ) : (
            <div className="overview-table-scroll"><table className="data-table">
              <thead>
                <tr>
                  <th>Tài liệu</th>
                  <th>Thư mục</th>
                  <th>Ngày thêm</th>
                  <th>Trạng thái AI</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((doc) => {
                  const file = fileTypeInfo(doc.file_name, doc.file_type);
                  const folder = folders.find((f) => f.id === doc.folder_id);
                  const status = processingStatusInfo(doc.processing_status);
                  return (
                    <tr key={doc.id}>
                      <td>
                        <div className="doc-cell">
                          <span className={`doc-type-icon ${file.cls}`}>
                            <FileText size={20} aria-hidden="true" />
                          </span>
                          <Link to={`/documents/${doc.id}`} className="doc-title">
                            {doc.title}
                          </Link>
                        </div>
                      </td>
                      <td className="muted">{folder?.name ?? "—"}</td>
                      <td className="muted">{formatDate(doc.created_at)}</td>
                      <td>
                        <span className={`status-badge ${status.cls}`}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          )}
        </div>
      </div>

      <aside className="dashboard-side">
        <div className="insight-card">
          <div className="insight-card-header">
            <span className="insight-icon"><Info size={22} aria-hidden="true" /></span>
            <div>
              <div className="insight-title">Thông tin nhanh</div>
              <div className="insight-subtitle">Tài liệu và thao tác thường dùng</div>
            </div>
          </div>
          <div className="insight-body">
            {loading ? <p className="muted">Đang tải...</p> : error ? <p className="muted">Chưa tải được thông tin.</p> : latest ? (
              <div>
                <div className="insight-item-label">Tài liệu mới nhất</div>
                <Link
                  to={`/documents/${latest.id}`}
                  className="insight-item-value"
                >
                  {latest.title}
                </Link>
                <span
                  className={`status-badge ${statusInfo(latest.status).cls}`}
                >
                  {statusInfo(latest.status).label}
                </span>
              </div>
            ) : (
              <div>
                <div className="insight-item-label">Chưa có tài liệu</div>
              </div>
            )}
            <div>
              <div className="insight-item-label">Gợi ý</div>
              <ul className="insight-list">
                <li>Nhóm tài liệu vào thư mục để dễ tìm kiếm.</li>
                <li>Dùng mục Tìm kiếm để tra theo nội dung.</li>
                <li>Đặt câu hỏi với tài liệu trong Chat.</li>
              </ul>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
