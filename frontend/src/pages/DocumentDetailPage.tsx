import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { FileText } from "lucide-react";

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
import { fileTypeInfo, isPreviewable, normalizeAccessLevel, processingStatusInfo, statusInfo } from "../utils/documentMeta";
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
  const invalidId = !id || !Number.isInteger(docId) || docId <= 0;
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
  const [extractedText, setExtractedText] = useState("");
  const [showExtracted, setShowExtracted] = useState(false);
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState("");
  // Kết quả tóm tắt tài liệu bằng AI
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");


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
    if (!invalidId) load();
  }, [load, invalidId]);

  if (invalidId) {
    return (
      <div>
        <h1>Chi tiết tài liệu</h1>
        <div className="alert alert-error">ID tài liệu không hợp lệ</div>
        <Link to="/documents" className="primary-link">
          ← Quay lại tài liệu
        </Link>
      </div>
    );
  }

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

  // Tải hiển thị nội dung văn bản đã trích xuất (OCR/text)
  const toggleExtracted = async () => {
    if (showExtracted) {
      setShowExtracted(false);
      return;
    }
    setTextLoading(true);
    setTextError("");
    try {
      const { extracted_text } = await documentApi.text(docId);
      setExtractedText(extracted_text);
      setShowExtracted(true);
    } catch (err) {
      setTextError((err as Error).message);
    } finally {
      setTextLoading(false);
    }
  };
  
    // Gọi backend để Gemini tóm tắt toàn bộ tài liệu
  const handleSummary = async () => {
    setSummaryLoading(true);
    setSummaryError("");

    try {
      const result = await documentApi.summarize(docId);

      // Lưu kết quả để hiển thị trên trang
      setSummary(result.summary);
    } catch (err) {
      setSummaryError((err as Error).message);
    } finally {
      setSummaryLoading(false);
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

  const access = normalizeAccessLevel(document.access_level);
  const canManage = access === "manage";
  const canEdit = access === "edit" || canManage;
  const canDelete = canManage;
  const meta = fileTypeInfo(document.file_name, document.file_type);
  const status = statusInfo(document.status);
  const procStatus = processingStatusInfo(document.processing_status);
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
     <div className="doc-detail-header">
  <div className="doc-detail-heading">
    <Link to="/documents" className="doc-back-link">
      ← Tài liệu
    </Link>

    <h1>{document.title}</h1>

    <div className="doc-submeta">
      <span className={`doc-type-icon ${meta.cls}`}>
        <FileText size={17} strokeWidth={1.8} />
      </span>

      <span>{document.file_name}</span>

      <span className="doc-meta-dot">•</span>

      <span>
        {document.file_type?.toUpperCase() || "Tệp"}
      </span>

      <span className="doc-meta-dot">•</span>

      <span>v{document.current_version}</span>

      <span className={`status-badge ${status.cls}`}>
        {status.label}
      </span>

      <span className={`status-badge ${procStatus.cls}`}>
        {procStatus.label}
      </span>
    </div>
  </div>
</div>

      {error && <div className="alert alert-error">{error}</div>}
      <div className="doc-detail-body-grid">
  {/* Cột trái: preview + nội dung trích xuất */}
  <div className="doc-detail-column">
    <section className="panel doc-preview-panel">
      <h2 className="panel-title">
        Xem trước tài liệu

        {previewVersion != null && (
          <span className="version-preview-label">
            đang xem v{previewVersion}
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
          Loại file này chưa hỗ trợ xem trước.
        </div>
      )}

      {previewVersion != null && (
        <div className="version-preview-bar">
          <span className="muted">
            Bạn đang xem phiên bản cũ.
          </span>

          <Button
            variant="text"
            onClick={() => setPreviewVersion(null)}
          >
            Trở về bản mới nhất
          </Button>
        </div>
      )}
    </section>

    {procStatus.cls === "indexed" && (
      <section className="panel doc-extracted-panel">
        <div className="doc-section-header">
          <div>
            <h2 className="panel-title">
              Nội dung trích xuất
            </h2>

            <p className="doc-section-desc">
              Nội dung văn bản được lấy từ tài liệu.
            </p>
          </div>

          <Button
            variant="secondary"
            onClick={toggleExtracted}
            disabled={textLoading}
          >
            {textLoading
              ? "Đang tải..."
              : showExtracted
                ? "Thu gọn"
                : "Xem nội dung"}
          </Button>
        </div>

        {textError && (
          <div className="alert alert-error">
            {textError}
          </div>
        )}

        {showExtracted && extractedText ? (
          <pre className="extracted-text">
            {extractedText}
          </pre>
        ) : (
          <div className="doc-content-placeholder">
            Chọn “Xem nội dung” để hiển thị văn bản đã trích xuất.
          </div>
        )}
      </section>
    )}
  </div>

  {/* Cột phải: thông tin + tóm tắt + phiên bản */}
  <div className="doc-detail-column">
    <section className="panel doc-info-panel">
      <div className="doc-section-header">
        <h2 className="panel-title">
          Thông tin tài liệu
        </h2>

        {canEdit && !editing && (
          <Button
            variant="text"
            onClick={() => setEditing(true)}
          >
            Chỉnh sửa
          </Button>
        )}
      </div>

      {editing ? (
        <div>
          <div className="form-group">
            <label>Tiêu đề</label>

            <input
              value={title}
              onChange={(e) =>
                setTitle(e.target.value)
              }
            />
          </div>

          <div className="form-group">
            <label>Thư mục</label>

            <select
              value={folderId}
              onChange={(e) =>
                setFolderId(e.target.value)
              }
            >
              <option value="">— Gốc —</option>

              {folders.map((f) => (
                <option
                  key={f.id}
                  value={f.id}
                >
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div className="doc-edit-actions">
            <Button
              variant="primary"
              onClick={handleSave}
            >
              Lưu thay đổi
            </Button>

            <Button
              variant="text"
              onClick={() => setEditing(false)}
            >
              Hủy
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="doc-info-list">
            <div className="doc-info-row">
              <span>Tên file</span>
              <strong>{document.file_name}</strong>
            </div>

            <div className="doc-info-row">
              <span>Loại file</span>
              <strong>
                {document.file_type?.toUpperCase() || "—"}
              </strong>
            </div>

            <div className="doc-info-row">
              <span>Phiên bản</span>
              <strong>
                v{document.current_version}
              </strong>
            </div>

            <div className="doc-info-row">
              <span>Phân loại</span>
              <strong>
                {document.category || "Chưa phân loại"}
              </strong>
            </div>

            <div className="doc-info-row">
              <span>Ngày tạo</span>
              <strong>
                {formatDate(document.created_at)}
              </strong>
            </div>

            <div className="doc-info-row">
              <span>Cập nhật</span>
              <strong>
                {formatDate(document.updated_at)}
              </strong>
            </div>
          </div>

          <div className="doc-info-actions">
            <Button
              variant="primary"
              onClick={() =>
                documentApi.download(
                  document.id,
                  document.file_name,
                )
              }
            >
              ↓ Tải xuống
            </Button>

            {canEdit && (
              <>
                <Button
                  variant="secondary"
                  disabled={uploading}
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                >
                  {uploading
                    ? "Đang tải..."
                    : "↑ Tải phiên bản mới"}
                </Button>

                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  onChange={handleNewVersion}
                />
              </>
            )}

            {canDelete && (
              <Button
                variant="danger"
                onClick={handleDelete}
              >
                Xóa tài liệu
              </Button>
            )}
          </div>
        </>
      )}
    </section>

    {procStatus.cls === "indexed" && (
      <section className="panel doc-summary-panel">
        <div className="doc-section-header">
          <div>
            <h2 className="panel-title">
              Tóm tắt tài liệu
            </h2>

            <p className="doc-section-desc">
              Nắm nhanh các nội dung chính của tài liệu.
            </p>
          </div>

          <Button
            variant="primary"
            onClick={handleSummary}
            disabled={summaryLoading}
          >
            {summaryLoading
              ? "Đang tóm tắt..."
              : summary
                ? "Tóm tắt lại"
                : "Tóm tắt"}
          </Button>
        </div>

        {summaryError && (
          <div className="alert alert-error">
            {summaryError}
          </div>
        )}

        {summary ? (
          <div className="ai-summary">
            <ReactMarkdown>
              {summary}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="doc-content-placeholder">
            Chưa có bản tóm tắt cho tài liệu này.
          </div>
        )}
      </section>
    )}

    <section className="panel doc-version-panel">
      <h2 className="panel-title">
        Phiên bản tài liệu
      </h2>

      {versions.length === 0 ? (
        <div className="empty-state">
          Chưa có phiên bản nào.
        </div>
      ) : (
        <table className="data-table versions-table">
          <thead>
            <tr>
              <th>Phiên bản</th>
              <th>Tên file</th>
              <th>Thời điểm</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {versions.map((v) => (
              <tr key={v.id}>
                <td>
                  <span className="badge">
                    v{v.version}
                  </span>
                </td>

                <td className="file-col">
                  {v.file_name}
                </td>

                <td className="muted">
                  {formatDate(v.created_at)}
                </td>

                <td>
                  <div className="row-actions-compact">
                    <Button
                      variant="text"
                      onClick={() =>
                        setPreviewVersion(v.version)
                      }
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
                      Tải
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
</div>

{/* Hoạt động giữ lại nhưng làm thành một khối phụ */}
<section className="panel doc-activity-panel">
  <h2 className="panel-title">
    Hoạt động gần đây
  </h2>

  {auditLogs.length === 0 ? (
    <div className="empty-state">
      Chưa có hoạt động nào.
    </div>
  ) : (
    <div className="audit-list">
      {auditLogs.slice(0, 5).map((log) => (
        <div
          key={log.id}
          className="audit-item"
        >
          <div className="audit-item-head">
            <span className="badge">
              {actionLabel(log.action)}
            </span>

            <span className="muted">
              {formatDate(log.created_at)}
            </span>
          </div>

          {log.details && (
            <div className="muted small">
              {log.details}
            </div>
          )}
        </div>
      ))}
    </div>
  )}
</section>
        <div className="doc-management-grid">
          {canShare && (
            <section className="panel doc-access-panel">
              <h2 className="panel-title">  Quyền truy cập
              </h2>
            <div className="doc-access-form">
            <div className="doc-access-field">
              <label>Email người nhận</label>
              <input
                type="email"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>

            <div className="doc-access-field doc-access-level">
              <label>Quyền</label>
              <select
                value={shareLevel}
                onChange={(e) => setShareLevel(e.target.value)}
              >
                {LEVEL_OPTIONS.map((level) => (
                  <option key={level} value={level}>
                    {ACCESS_LABELS[level]}
                  </option>
                ))}
              </select>
            </div>

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
              <div className="doc-access-empty">
                Chưa chia sẻ tài liệu này cho người dùng khác.
              </div>
            )}
            </section>
          )}

          {canApprove && (
            <section className="panel doc-approval-panel">
              <h2 className="panel-title">Phê duyệt tài liệu</h2>
              {document.status === "approved" ? (
                <div className="empty-state">
                  <span className="empty-icon">✅</span>
                  Tài liệu đã được duyệt và chính thức sử dụng.
                </div>
              ) : document.status === "rejected" ? (
                <div className="empty-state">
                  <span className="empty-icon">⛔</span>
                  Tài liệu đã bị từ chối duyệt. Nhân viên có thể tải bản mới để
                  gửi lại duyệt.
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
          </div>
      </div>
    
  );
}