import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { documentApi } from "../api/documentApi";
import { folderApi } from "../api/folderApi";
import DocumentPreview from "../components/DocumentPreview.tsx";
import Button from "../components/ui/Button.tsx";
import Spinner from "../components/ui/Spinner.tsx";
import { useAuth } from "../hooks/useAuth";
import type { Document, DocumentVersion, Folder } from "../types";
import { fileTypeInfo, isPreviewable, statusInfo } from "../utils/documentMeta";
import { formatDate } from "../utils/format";

export default function DocumentDetailPage() {
  const { id } = useParams();
  const docId = Number(id);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [document, setDocument] = useState<Document | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [folderId, setFolderId] = useState("");

  const load = useCallback(async () => {
    try {
      const [doc, folderList, versionList] = await Promise.all([
        documentApi.get(docId),
        folderApi.list(),
        documentApi.versions(docId),
      ]);
      setDocument(doc);
      setFolders(folderList);
      setVersions(versionList);
      setTitle(doc.title);
      setFolderId(doc.folder_id ? String(doc.folder_id) : "");
      setError("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    try {
      const updated = await documentApi.update(docId, {
        title: title.trim(),
        folder_id: folderId ? Number(folderId) : null,
      });
      setDocument(updated);
      setEditing(false);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Xoá tài liệu này?")) return;
    try {
      await documentApi.delete(docId);
      navigate("/documents");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading) return <Spinner />;

  if (!document) {
    return (
      <div>
        <h1>Chi tiết tài liệu</h1>
        {error && <div className="alert alert-error">{error}</div>}
        <Link to="/documents" className="primary-link">
          ← Quay lại tài liệu
        </Link>
      </div>
    );
  }

  const canDelete = user?.role !== "staff";
  const meta = fileTypeInfo(document.file_name, document.file_type);
  const status = statusInfo(document.status);
  const previewable = isPreviewable(document.file_name, document.file_type);

  return (
    <div>
      <div className="page-header">
        <div>
          <Link
            to="/documents"
            className="text-button"
            style={{ marginBottom: "6px", display: "inline-block" }}
          >
            ← Quay lại tài liệu
          </Link>
          <div className="doc-detail-title-row">
            <h1>{document.title}</h1>
            <span className={`status-badge ${status.cls}`}>{status.label}</span>
          </div>
          <p className="page-header-desc">
            <span className={`doc-type-icon ${meta.cls}`}>{meta.icon}</span>{" "}
            {document.file_name}
          </p>
        </div>
        <div className="row-actions" style={{ marginTop: "0" }}>
          <Button
            variant="secondary"
            onClick={() => documentApi.download(document.id, document.file_name)}
          >
            ⬇️ Tải xuống
          </Button>
          {!editing && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Sửa
            </Button>
          )}
          {canDelete && (
            <Button variant="danger" onClick={handleDelete}>
              Xoá
            </Button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="detail-grid">
        <div className="detail-main">
          <section className="panel">
            <h2 className="panel-title">Xem trước</h2>
            {previewable ? (
              <DocumentPreview
                documentId={document.id}
                fileName={document.file_name}
                fileType={document.file_type}
              />
            ) : (
              <div className="empty-state">
                <span className="empty-icon">📄</span>
                Loại file này chưa hỗ trợ xem trước. Tải xuống để mở bằng phần
                mềm phù hợp.
              </div>
            )}
          </section>

          <section className="panel">
            <h2 className="panel-title">Thông tin tài liệu</h2>
            {editing ? (
              <div>
                <div className="form-group">
                  <label>Tiêu đề</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Thư mục</label>
                  <select
                    value={folderId}
                    onChange={(e) => setFolderId(e.target.value)}
                  >
                    <option value="">— Gốc —</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="row-actions">
                  <Button variant="primary" onClick={handleSave}>
                    Lưu thay đổi
                  </Button>
                  <Button variant="text" onClick={() => setEditing(false)}>
                    Huỷ
                  </Button>
                </div>
              </div>
            ) : (
              <div className="detail-meta-grid">
                <div className="detail-meta-item">
                  <div className="detail-meta-label">Tên file</div>
                  <div className="detail-meta-value">{document.file_name}</div>
                </div>
                <div className="detail-meta-item">
                  <div className="detail-meta-label">Loại file</div>
                  <div className="detail-meta-value">
                    {document.file_type?.toUpperCase() || "—"}
                  </div>
                </div>
                <div className="detail-meta-item">
                  <div className="detail-meta-label">Phiên bản hiện tại</div>
                  <div className="detail-meta-value">
                    v{document.current_version}
                  </div>
                </div>
                <div className="detail-meta-item">
                  <div className="detail-meta-label">Ngày tạo</div>
                  <div className="detail-meta-value">
                    {formatDate(document.created_at)}
                  </div>
                </div>
                <div className="detail-meta-item">
                  <div className="detail-meta-label">Ngày cập nhật</div>
                  <div className="detail-meta-value">
                    {formatDate(document.updated_at)}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        <aside className="detail-side">
          <section className="panel">
            <h2 className="panel-title">Trạng thái AI</h2>
            <div className="ai-status-card">
              <span className={`status-badge ${status.cls}`}>
                {status.label}
              </span>
              <p className="ai-status-desc">
                {status.cls === "indexed" &&
                  "Tài liệu đã được OCR và đưa vào chỉ mục tìm kiếm."}
                {status.cls === "processing" &&
                  "Tài liệu đang được AI xử lý. Vui lòng chờ trong giây lát."}
                {status.cls === "neutral" &&
                  "Tài liệu chưa qua xử lý. Hệ thống sẽ chạy OCR/AI trong Giai đoạn 3."}
              </p>
            </div>
          </section>

          <section className="panel">
            <h2 className="panel-title">Lịch sử phiên bản</h2>
            {versions.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">🗃️</span>
                Chưa có phiên bản nào.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Phiên bản</th>
                    <th>Tên file</th>
                    <th>Thời điểm</th>
                  </tr>
                </thead>
                <tbody>
                  {versions.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <span className="badge">v{v.version}</span>
                      </td>
                      <td>{v.file_name}</td>
                      <td>{formatDate(v.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}