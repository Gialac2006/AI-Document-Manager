import { Link } from "react-router-dom";

import { documentApi } from "../api/documentApi";
import { useAuth } from "../hooks/useAuth";
import type { Document } from "../types";
import { formatDate } from "../utils/format";

const FILE_META: Record<string, { icon: string; className: string }> = {
  ".pdf": { icon: "📕", className: "pdf" },
  ".doc": { icon: "📘", className: "doc" },
  ".docx": { icon: "📘", className: "doc" },
  ".xls": { icon: "📊", className: "xls" },
  ".xlsx": { icon: "📊", className: "xls" },
  ".csv": { icon: "📊", className: "xls" },
  ".ppt": { icon: "📽️", className: "doc" },
  ".pptx": { icon: "📽️", className: "doc" },
  ".txt": { icon: "📝", className: "" },
  ".md": { icon: "📝", className: "" },
  ".png": { icon: "🖼️", className: "img" },
  ".jpg": { icon: "🖼️", className: "img" },
  ".jpeg": { icon: "🖼️", className: "img" },
  ".gif": { icon: "🖼️", className: "img" },
};

interface DocumentCardProps {
  document: Document;
  onDelete: (id: number) => void;
}

export default function DocumentCard({ document, onDelete }: DocumentCardProps) {
  const { user } = useAuth();
  const canDelete = user?.role !== "staff";
  const meta = FILE_META[document.file_type || ""] || { icon: "📄", className: "" };

  return (
    <div className="document-card">
      <div className={`document-card-icon ${meta.className}`}>{meta.icon}</div>
      <div className="document-card-body">
        <Link to={`/documents/${document.id}`} className="document-card-title">
          {document.title}
        </Link>
        <div className="document-card-meta">
          <span>{document.file_name}</span>
          <span>🕒 {formatDate(document.updated_at)}</span>
          <span className="badge">Phiên bản {document.current_version}</span>
        </div>
      </div>
      <div className="document-card-actions">
        <a
          href={documentApi.downloadUrl(document.id)}
          className="icon-button"
          title="Tải xuống"
        >
          ⬇️
        </a>
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
