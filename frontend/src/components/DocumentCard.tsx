import { Link } from "react-router-dom";

import { documentApi } from "../api/documentApi";
import { useAuth } from "../hooks/useAuth";
import type { Document } from "../types";
import { fileTypeInfo, statusInfo } from "../utils/documentMeta";
import { formatDate } from "../utils/format";

interface DocumentCardProps {
  document: Document;
  onDelete: (id: number) => void;
}

// Component thẻ hiển thị 1 tài liệu trong danh sách
export default function DocumentCard({ document, onDelete }: DocumentCardProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "super_admin";
  const canDelete = isAdmin || document.access_level === "manage";
  const meta = fileTypeInfo(document.file_name, document.file_type);
  const status = statusInfo(document.status);

  return (
    <div className="document-card">
      <div className={`document-card-icon ${meta.cls}`}>{meta.icon}</div>
      <div className="document-card-body">
        <Link to={`/documents/${document.id}`} className="document-card-title">
          {document.title}
        </Link>
        <div className="document-card-meta">
          <span>{document.file_name}</span>
          <span>🕒 {formatDate(document.updated_at)}</span>
          <span className={`status-badge ${status.cls}`}>{status.label}</span>
        </div>
      </div>
      <div className="document-card-actions">
        <button
          type="button"
          className="icon-button"
          title="Tải xuống"
          onClick={() => documentApi.download(document.id, document.file_name)}
        >
          ⬇️
        </button>
        {canDelete && (
          <button
            type="button"
            className="icon-button danger"
            title="Xoá"
            onClick={() => onDelete(document.id)}
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  );
}