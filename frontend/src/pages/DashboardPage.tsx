import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { documentApi } from "../api/documentApi";
import { folderApi } from "../api/folderApi";
import { useAuth } from "../hooks/useAuth";
import type { Document, Folder } from "../types";
import { formatDate } from "../utils/format";
import { ROLE_LABELS } from "../utils/roles";

const QUICK_ACTIONS = [
  { to: "/documents", icon: "📁", title: "Tài liệu", desc: "Upload và quản lý tài liệu" },
  { to: "/search", icon: "🔍", title: "Tìm kiếm", desc: "Tìm kiếm ngữ nghĩa theo nội dung" },
  { to: "/chat", icon: "💬", title: "Chat", desc: "Hỏi đáp theo tài liệu (RAG)" },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [docList, folderList] = await Promise.all([
        documentApi.list(),
        folderApi.list(),
      ]);
      setDocuments(docList);
      setFolders(folderList);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="dashboard-welcome">
        <h1>Chào mừng, {user?.full_name}</h1>
        <p>
          Bạn đang đăng nhập với vai trò{" "}
          <strong>{user ? ROLE_LABELS[user.role] || user.role : ""}</strong>. Chọn một hành
          động bên dưới để bắt đầu.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon blue">📄</div>
          <div>
            <div className="stat-value">{documents.length}</div>
            <div className="stat-label">Tài liệu</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">📂</div>
          <div>
            <div className="stat-value">{folders.length}</div>
            <div className="stat-label">Thư mục</div>
          </div>
        </div>
      </div>

      <h2 className="section-title">Bắt đầu nhanh</h2>
      <div className="card-grid">
        {QUICK_ACTIONS.map((action) => (
          <Link key={action.to} to={action.to} className="card">
            <h3>
              <span>{action.icon}</span> {action.title}
            </h3>
            <p>{action.desc}</p>
          </Link>
        ))}
      </div>

      <h2 className="section-title" style={{ marginTop: "26px" }}>
        Tài liệu gần đây
      </h2>
      <div className="panel">
        {documents.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🗂️</span>
            Chưa có tài liệu nào.{" "}
            <Link to="/documents" className="primary-link">
              Tải tài liệu lên
            </Link>
          </div>
        ) : (
          <ul className="recent-list">
            {documents.slice(0, 6).map((doc) => (
              <li key={doc.id}>
                <span>📄</span>
                <Link to={`/documents/${doc.id}`}>{doc.title}</Link>
                <span className="badge">v{doc.current_version}</span>
                <span className="muted">{formatDate(doc.updated_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
