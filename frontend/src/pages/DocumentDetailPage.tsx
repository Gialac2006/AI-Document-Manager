import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { documentApi } from "../api/documentApi";
import { folderApi } from "../api/folderApi";
import Button from "../components/ui/Button.tsx";
import Spinner from "../components/ui/Spinner.tsx";
import { useAuth } from "../hooks/useAuth";
import type { Document, DocumentVersion, Folder } from "../types";
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

  return (
    <div>
      <div className="page-header">
        <div>
          <Link to="/documents" className="text-button" style={{ marginBottom: "6px", display: "inline-block" }}>
            ← Quay lại tài liệu
          </Link>
          <h1>{document.title}</h1>
          <p className="page-header-desc">{document.file_name}</p>
        </div>
        <div className="row-actions" style={{ marginTop: "0" }}>
          <a
            href={documentApi.downloadUrl(document.id)}
            className="secondary-button"
          >
            ⬇️ Tải xuống
          </a>
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

      <div className="admin-panels">
        <section className="panel">
          <h2 className="panel-title">
            Thông tin tài liệu
            {document.status && <span className="badge">{document.status}</span>}
          </h2>

          {editing ? (
            <div>
              <div className="form-group">
                <label>Tiêu đề</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Thư mục</label>
                <select value={folderId} onChange={(e) => setFolderId(e.target.value)}>
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
                <div className="detail-meta-value">{document.file_type || "—"}</div>
              </div>
              <div className="detail-meta-item">
                <div className="detail-meta-label">Phiên bản hiện tại</div>
                <div className="detail-meta-value">v{document.current_version}</div>
              </div>
              <div className="detail-meta-item">
                <div className="detail-meta-label">Ngày cập nhật</div>
                <div className="detail-meta-value">{formatDate(document.updated_at)}</div>
              </div>
              <div className="detail-meta-item">
                <div className="detail-meta-label">Ngày tạo</div>
                <div className="detail-meta-value">{formatDate(document.created_at)}</div>
              </div>
            </div>
          )}
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
      </div>
    </div>
  );
}
