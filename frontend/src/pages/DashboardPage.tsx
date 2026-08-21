import { useCallback, useEffect, useState } from "react";
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
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [docResult, folderList] = await Promise.all([
        documentApi.list(null, 1, 100),
        folderApi.list(),
      ]);
      setDocuments(docResult.items);
      setFolders(folderList);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const recent = [...documents]
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
    .slice(0, 8);
  const latest = recent[0];

  const total = documents.length;
  const folderCount = folders.length;
  const indexed = documents.filter((doc) =>
    ["text_extracted", "completed", "indexed"].includes(
      (doc.processing_status || "").toLowerCase()
    )
  ).length;
  const pending = documents.length - indexed;
  const weekAgo = Date.now() - WEEK_MS;
  const weeklyNew = documents.filter(
    (doc) => new Date(doc.created_at).getTime() >= weekAgo
  ).length;

  return (
    <div className="dashboard-grid">
      <div className="dashboard-main">
        <section className="hero-card">
          <div>
            <h1 className="hero-title">Chào mừng trở lại, {user?.full_name}</h1>
            <p className="hero-summary">
              Bạn đang đăng nhập với vai trò{" "}
              <strong>{user ? ROLE_LABELS[user.role] || user.role : ""}</strong>. Hệ
              thống hiện có {total} tài liệu
              {pending > 0 ? `, ${pending} tài liệu đang chờ xử lý AI.` : "."}
            </p>
          </div>
          <div className="hero-actions">
            <Link to="/documents" className="primary-button">
              Tải tài liệu lên
            </Link>
            <Link to="/chat" className="outline-button">
              Bắt đầu chat
            </Link>
          </div>
        </section>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-icon blue">📄</div>
            <div className="stat-card-body">
              <div className="stat-head">
                <span className="stat-value">{total}</span>
                <span className="stat-trend up">+{weeklyNew} / 7 ngày</span>
              </div>
              <div className="stat-label">Tổng tài liệu</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green">📂</div>
            <div className="stat-card-body">
              <div className="stat-head">
                <span className="stat-value">{folderCount}</span>
              </div>
              <div className="stat-label">Thư mục</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon amber">⏳</div>
            <div className="stat-card-body">
              <div className="stat-head">
                <span className="stat-value">{pending}</span>
                {pending > 0 ? (
                  <span className="status-badge processing">Đang xử lý</span>
                ) : (
                  <span className="status-badge indexed">Hoàn tất</span>
                )}
              </div>
              <div className="stat-label">Công việc đang chờ</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon violet">✅</div>
            <div className="stat-card-body">
              <div className="stat-head">
                <span className="stat-value">{indexed}</span>
              </div>
              <div className="stat-label">Đã xử lý AI</div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Tài liệu gần đây</div>
          {recent.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🗂️</span>
              Chưa có tài liệu nào.{" "}
              <Link to="/documents" className="primary-link">
                Tải tài liệu lên
              </Link>
            </div>
          ) : (
            <table className="data-table">
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
                            {file.icon}
                          </span>
                          <Link to={`/documents/${doc.id}`} className="doc-title">
                            {doc.title}
                          </Link>
                        </div>
                      </td>
                      <td className="muted">{folder?.name ?? "—"}</td>
                      <td className="muted">{formatDate(doc.updated_at)}</td>
                      <td>
                        <span className={`status-badge ${status.cls}`}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <aside className="dashboard-side">
        <div className="insight-card">
          <div className="insight-card-header">
            <span className="insight-icon">✨</span>
            <div>
              <div className="insight-title">Thông tin nhanh</div>
              <div className="insight-subtitle">Tổng quan hệ thống của bạn</div>
            </div>
          </div>
          <div className="insight-body">
            {latest ? (
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