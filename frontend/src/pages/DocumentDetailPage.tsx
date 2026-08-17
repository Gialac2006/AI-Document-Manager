import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { documentApi } from "../api/documentApi";
import { folderApi } from "../api/folderApi";
import { userApi } from "../api/userApi";
import DocumentPreview from "../components/DocumentPreview.tsx";
import Button from "../components/ui/Button.tsx";
import Spinner from "../components/ui/Spinner.tsx";
import { useAuth } from "../hooks/useAuth";
import type {
  Approval,
  AuditLog,
  Document,
  DocumentVersion,
  Folder,
  Permission,
} from "../types";
import { fileTypeInfo, isPreviewable, statusInfo } from "../utils/documentMeta";
import { formatDate } from "../utils/format";

const ACCESS_LABELS: Record<string, string> = {
  view: "Xem",
  edit: "Chỉnh sửa",
  manage: "Quản lý",
  admin: "Quản lý",
};

const LEVEL_OPTIONS = ["view", "edit", "manage"];

function levelToBackend(level: string): string {
  return level === "manage" ? "admin" : level;
}

function levelFromBackend(level: string): string {
  return level === "admin" ? "manage" : level;
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    create: "Tạo mới",
    edit: "Chỉnh sửa",
    view: "Xem",
    download: "Tải xuống",
    delete: "Xoá",
    upload_version: "Cập nhật phiên bản",
    share_grant: "Chia sẻ",
    share_revoke: "Thu hồi chia sẻ",
    approve: "Phê duyệt",
    reject: "Từ chối",
    submit: "Gửi phê duyệt",
  };
  return map[action] ?? action;
}

// Trang chi tiết tài liệu: xem trước, phiên bản, chia sẻ, phê duyệt và nhật ký hoạt động
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
  const [uploading, setUploading] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [shareEmail, setShareEmail] = useState("");
  const [shareLevel, setShareLevel] = useState("view");
  const [shareError, setShareError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [approvalNote, setApprovalNote] = useState("");
  const [approving, setApproving] = useState(false);

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Tải lên phiên bản mới cho tài liệu rồi làm mới dữ liệu
  const handleNewVersion = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      await documentApi.uploadNewVersion(docId, file);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      resetFileInput();
    }
  };

  // Nạp toàn bộ dữ liệu của tài liệu (thông tin, thư mục, phiên bản, quyền, nhật ký, phê duyệt)
  const load = useCallback(async () => {
    try {
      const [doc, folderList, versionList, perms, logs, appr] =
        await Promise.all([
          documentApi.get(docId),
          folderApi.list(),
          documentApi.versions(docId),
          documentApi.listPermissions(docId),
          documentApi.auditLogs(docId),
          documentApi.listApprovals(docId),
        ]);
      setDocument(doc);
      setFolders(folderList);
      setVersions(versionList);
      setPermissions(perms);
      setAuditLogs(logs);
      setApprovals(appr);
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

  // Lưu thay đổi tiêu đề và thư mục của tài liệu
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

  // Xoá tài liệu sau khi xác nhận rồi quay lại trang danh sách
  const handleDelete = async () => {
    if (!window.confirm("Xoá tài liệu này?")) return;
    try {
      await documentApi.delete(docId);
      navigate("/documents");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Chia sẻ tài liệu cho người dùng khác theo email với mức quyền đã chọn
  const handleAddShare = async () => {
    const email = shareEmail.trim();
    if (!email) return;
    setSharing(true);
    setShareError("");
    try {
      const target = await userApi.lookupByEmail(email);
      await documentApi.grantPermission(
        docId,
        target.id,
        levelToBackend(shareLevel),
      );
      setPermissions(await documentApi.listPermissions(docId));
      setShareEmail("");
      setShareLevel("view");
    } catch (err) {
      setShareError((err as Error).message);
    } finally {
      setSharing(false);
    }
  };

  // Thu hồi quyền truy cập tài liệu của một người dùng
  const handleRevokeShare = async (userId: number) => {
    if (!window.confirm("Thu hồi quyền truy cập của người dùng này?")) return;
    setShareError("");
    try {
      await documentApi.revokePermission(docId, userId);
      setPermissions(await documentApi.listPermissions(docId));
    } catch (err) {
      setShareError((err as Error).message);
    }
  };

  // Gửi quyết định phê duyệt/từ chối cho tài liệu (bắt buộc lý do khi từ chối)
  const handleApproval = async (decision: "approved" | "rejected") => {
    const reason = approvalNote.trim();
    if (decision === "rejected" && !reason) {
      window.alert("Vui lòng nhập lý do khi từ chối.");
      return;
    }
    setApproving(true);
    setError("");
    try {
      await documentApi.submitApproval(docId, decision, reason);
      setApprovalNote("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setApproving(false);
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

  const access = document.access_level ?? "view";
  const canManage = access === "manage";
  const canEdit = access === "edit" || canManage;
  const canDelete = canManage;
  const meta = fileTypeInfo(document.file_name, document.file_type);
  const status = statusInfo(document.status);
  const isPending = document.status === "pending";
  const previewable = isPreviewable(document.file_name, document.file_type);
  const activeVersion =
    previewVersion != null
      ? versions.find((v) => v.version === previewVersion)
      : null;
  const previewFileName = activeVersion?.file_name ?? document.file_name;
  const canApprove =
    canManage &&
    (user?.role === "manager" || user?.role === "super_admin");
  const canShare = canManage && !isPending;

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
          {canEdit && (
            <>
              <Button
                variant="secondary"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? "Đang tải..." : "⬆️ Tải bản mới"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                onChange={handleNewVersion}
              />
              {!editing && (
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  Sửa
                </Button>
              )}
            </>
          )}
          {canEdit && <span className="muted access-chip">{ACCESS_LABELS[access]} · {access}</span>}
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
            <h2 className="panel-title">
              Xem trước
              {previewVersion != null && (
                <span className="version-preview-label">
                  đang xem v{previewVersion} (bản cũ)
                </span>
              )}
            </h2>
            {previewable ? (
              <DocumentPreview
                documentId={document.id}
                fileName={previewFileName}
                fileType={document.file_type}
                version={previewVersion ?? undefined}
              />
            ) : (
              <div className="empty-state">
                <span className="empty-icon">📄</span>
                Loại file này chưa hỗ trợ xem trước. Tải xuống để mở bằng phần
                mềm phù hợp.
              </div>
            )}
            {previewVersion != null && (
              <div className="version-preview-bar">
                <span className="muted">
                  Bạn đang xem bản cũ. Tải về để so sánh với bản mới nhất.
                </span>
                <Button
                  variant="text"
                  onClick={() => setPreviewVersion(null)}
                >
                  ← Trở về bản mới nhất
                </Button>
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

          <section className="panel">
            <h2 className="panel-title">Lịch sử phiên bản</h2>
            {versions.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">🗃️</span>
                Chưa có phiên bản nào.
              </div>
            ) : (
              <table className="data-table versions-table">
                <colgroup>
                  <col className="version-col" />
                  <col />
                  <col className="time-col" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Phiên bản</th>
                    <th>Tên file</th>
                    <th>Thời điểm</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {versions.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <span className="badge">v{v.version}</span>
                      </td>
                      <td className="file-col">{v.file_name}</td>
                      <td className="muted">{formatDate(v.created_at)}</td>
                      <td>
                        <div className="row-actions-compact">
                          <Button
                            variant="secondary"
                            onClick={() => setPreviewVersion(v.version)}
                          >
                            Xem
                          </Button>
                          <Button
                            variant="text"
                            onClick={() =>
                              documentApi.downloadVersion(
                                document.id,
                                v.version,
                                v.file_name,
                              )
                            }
                          >
                            ⬇ Tải
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <aside className="detail-side">
          <section className="panel">
            <h2 className="panel-title">Trạng thái tài liệu</h2>
            <div className="ai-status-card">
              <span className={`status-badge ${status.cls}`}>
                {status.label}
              </span>
              <p className="ai-status-desc">
                {status.cls === "pending" &&
                  "Tài liệu đang chờ quản lý duyệt trước khi chính thức sử dụng trong hệ thống."}
                {status.cls === "approved" &&
                  "Tài liệu đã được duyệt và chính thức sử dụng trong hệ thống."}
                {status.cls === "rejected" &&
                  "Tài liệu bị từ chối duyệt. Liên hệ quản lý để biết lý do."}
                {status.cls === "indexed" &&
                  "Tài liệu đã được OCR và đưa vào chỉ mục tìm kiếm."}
                {status.cls === "processing" &&
                  "Tài liệu đang được AI xử lý. Vui lòng chờ trong giây lát."}
                {status.cls === "neutral" &&
                  "Tài liệu chưa qua xử lý. Hệ thống sẽ chạy OCR/AI trong Giai đoạn 3."}
              </p>
            </div>
          </section>

          {canShare && (
            <section className="panel">
              <h2 className="panel-title">Chia sẻ tài liệu</h2>
              <div className="form-group">
                <label>Email người nhận</label>
                <input
                  type="email"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              <div className="form-group">
                <label>Quyền truy cập</label>
                <select
                  value={shareLevel}
                  onChange={(e) => setShareLevel(e.target.value)}
                >
                  {LEVEL_OPTIONS.map((l) => (
                    <option key={l} value={l}>
                      {ACCESS_LABELS[l]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="row-actions" style={{ marginTop: "8px" }}>
                <Button
                  variant="primary"
                  disabled={sharing || !shareEmail.trim()}
                  onClick={handleAddShare}
                >
                  {sharing ? "Đang chia sẻ..." : "Chia sẻ"}
                </Button>
              </div>
              {shareError && <div className="alert alert-error">{shareError}</div>}

              {permissions.length > 0 && (
                <div className="share-list" style={{ marginTop: "12px" }}>
                  {permissions.map((p) => (
                    <div key={p.id} className="share-item">
                      <div className="share-item-info">
                        <span className="share-item-name">
                          {p.user_full_name || `#${p.user_id}`}
                        </span>
                        <span className="share-item-email">
                          {p.user_email}
                        </span>
                      </div>
                      <span className="share-item-level">
                        {ACCESS_LABELS[levelFromBackend(p.access_level)] ??
                          p.access_level}
                      </span>
                      <Button
                        variant="text"
                        onClick={() => handleRevokeShare(p.user_id)}
                      >
                        Thu hồi
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {permissions.length === 0 && (
                <div className="empty-state">
                  <span className="empty-icon">🔗</span>
                  Chưa chia sẻ cho ai.
                </div>
              )}
            </section>
          )}

          {canApprove && (
            <section className="panel">
              <h2 className="panel-title">Phê duyệt tài liệu</h2>
              {document.status === "approved" ? (
                <div className="empty-state">
                  <span className="empty-icon">✅</span>
                  Tài liệu đã được duyệt và chính thức sử dụng.
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label>Nhận xét / lý do</label>
                    <textarea
                      rows={3}
                      value={approvalNote}
                      onChange={(e) => setApprovalNote(e.target.value)}
                      placeholder="Ghi chú cho quyết định"
                    />
                  </div>
                  <div className="row-actions" style={{ marginTop: "8px" }}>
                    <Button
                      variant="primary"
                      disabled={approving}
                      onClick={() => handleApproval("approved")}
                    >
                      ✓ Duyệt
                    </Button>
                    <Button
                      variant="danger"
                      disabled={approving}
                      onClick={() => handleApproval("rejected")}
                    >
                      ✕ Từ chối
                    </Button>
                  </div>
                </>
              )}
              {approvals.length > 0 && (
                <div style={{ marginTop: "12px" }}>
                  {approvals.map((a) => (
                    <div key={a.id} className="permission-item">
                      <span className={`badge ${a.decision === "approved" ? "badge-ok" : a.decision === "rejected" ? "badge-danger" : ""}`}>
                        {a.decision === "approved" ? "✓ Đã duyệt" : a.decision === "rejected" ? "✕ Đã từ chối" : "Chờ xử lý"}
                      </span>
                      {a.reason && <div className="muted small">{a.reason}</div>}
                      <div className="muted">{formatDate(a.created_at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="panel">
            <h2 className="panel-title">Nhật ký hoạt động</h2>
            {auditLogs.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">📋</span>
                Chưa có hoạt động nào.
              </div>
            ) : (
              <div className="audit-list">
                {auditLogs.map((log) => (
                  <div key={log.id} className="audit-item">
                    <div className="audit-item-head">
                      <span className="badge">{actionLabel(log.action)}</span>
                      <span className="muted">{formatDate(log.created_at)}</span>
                    </div>
                    {log.details && <div className="muted small">{log.details}</div>}
                  </div>
                ))}
              </div>
            )}
          </section>
          </aside>
      </div>
    </div>
  );
}