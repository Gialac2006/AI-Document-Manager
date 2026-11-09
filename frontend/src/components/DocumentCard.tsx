import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Image, Sheet, Download, MoreHorizontal, Trash2 } from "lucide-react";
import { documentApi } from "../api/documentApi";
import { useAuth } from "../hooks/useAuth";
import type { Document } from "../types";
import { fileTypeInfo, normalizeAccessLevel, statusInfo } from "../utils/documentMeta";
import { formatDate } from "../utils/format";
import "../documents.css";

interface DocumentCardProps {
  document: Document;
  onDelete: (id: number) => void;
  pendingChanges?: number;
}

export default function DocumentCard({ document: doc, onDelete, pendingChanges = 0 }: DocumentCardProps) {
  const { user } = useAuth();
  const canDelete = user?.role === "super_admin" || normalizeAccessLevel(doc.access_level) === "manage";
  const meta = fileTypeInfo(doc.file_name, doc.file_type);
  const status = statusInfo(doc.status);
  const Icon = meta.cls === "img" ? Image : meta.cls === "xls" ? Sheet : FileText;
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    };
    window.addEventListener("pointerdown", outside);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("pointerdown", outside);
      window.removeEventListener("keydown", escape);
    };
  }, [open]);

  async function download() {
    setDownloading(true); setError("");
    try { await documentApi.download(doc.id, doc.file_name); }
    catch (err) { setError(err instanceof Error ? err.message : "Không thể tải tài liệu."); }
    finally { setDownloading(false); }
  }

  return <article className="document-card document-card-clean">
    <div className="document-card-top">
      <div className="document-file-symbol"><Icon size={21} strokeWidth={1.7} aria-hidden="true" /></div>
      <div className="document-card-body">
        <Link to={`/documents/${doc.id}`} className="document-card-title" title={doc.title}>{doc.title}</Link>
        <span className="document-file-name" title={doc.file_name}>{doc.file_name}</span>
      </div>
    </div>
    <div className="document-card-meta">
      <span>{(doc.file_name.split(".").pop() || "Tài liệu").toUpperCase()} · v{doc.current_version}</span>
      <span>Cập nhật {formatDate(doc.updated_at)}</span>
      <div className="document-card-tags">
        <span className={`status-badge ${status.cls}`}>{status.label}</span>
        {doc.category && <span className="status-badge neutral">{doc.category}</span>}
      </div>
    </div>
    {pendingChanges > 0 && <Link className="document-change-link" to={`/documents/${doc.id}`}>
      <span aria-hidden="true" />Cần đối chiếu ({pendingChanges})
    </Link>}
    {error && <p className="document-action-error" role="alert">{error}</p>}
    <footer className="document-card-footer">
      <Link className="document-open-link" to={`/documents/${doc.id}`}>Mở tài liệu</Link>
      <button type="button" className="document-action" disabled={downloading} onClick={() => void download()}>
        <Download size={16} aria-hidden="true" />{downloading ? "Đang tải..." : "Tải xuống"}
      </button>
      {canDelete && <div className="document-more" ref={menu} onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}>
        <button ref={trigger} type="button" className="document-action" aria-label={`Thao tác với ${doc.title}`}
          aria-expanded={open} aria-controls={`document-actions-${doc.id}`} onClick={() => setOpen(value => !value)}>
          <MoreHorizontal size={18} />
        </button>
        {open && <div className="document-dropdown" id={`document-actions-${doc.id}`}>
          <button type="button" onClick={() => { setOpen(false); trigger.current?.focus(); onDelete(doc.id); }}>
            <Trash2 size={16} aria-hidden="true" />Xóa tài liệu
          </button>
        </div>}
      </div>}
    </footer>
  </article>;
}