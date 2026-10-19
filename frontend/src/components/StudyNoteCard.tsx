import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import StudyNoteReviewPanel from "./StudyNoteReviewPanel";
import { studyNoteApi } from "../api/studyNoteApi";
import type { StudyNote } from "../api/studyNoteApi";
import { formatDate } from "../utils/format";
import Button from "./ui/Button";

interface Props {
  note: StudyNote;
  onUpdated: (note: StudyNote) => void;
  onDeleted: () => void;
}

export default function StudyNoteCard({
  note,
  onUpdated,
  onDeleted,
}: Props) {
  // editing quyết định hiển thị nội dung hay form sửa.
  const [editing, setEditing] = useState(false);

  // Bản nháp riêng, chưa ảnh hưởng dữ liệu đã lưu.
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [reviewing, setReviewing] = useState(false);
  // Chặn bấm nhiều lần trong lúc gọi API.
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function startEditing() {
    // Mỗi lần mở form, lấy nội dung đã lưu mới nhất.
    setTitle(note.title);
    setContent(note.content);
    setError("");
    setEditing(true);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    if (!title.trim() || !content.trim()) {
      setError("Vui lòng nhập tiêu đề và nội dung.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const updated = await studyNoteApi.update(note.id, {
        title: title.trim(),
        content: content.trim(),
      });

      // Báo trang cha cập nhật thẻ bằng dữ liệu backend trả về.
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      // Giữ form và nội dung đang sửa nếu lưu thất bại.
      setError(
        err instanceof Error ? err.message : "Không thể sửa ghi chú.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (busy) return;

    // Dùng hộp xác nhận có sẵn của trình duyệt cho bản đầu.
    if (!window.confirm(`Xóa ghi chú "${note.title}"?`)) return;

    setBusy(true);
    setError("");

    try {
      await studyNoteApi.delete(note.id);

      // Chỉ tải lại danh sách sau khi backend xóa thành công.
      onDeleted();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không thể xóa ghi chú.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="panel" style={{ marginTop: 20 }}>
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {editing ? (
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label htmlFor={`note-title-${note.id}`}>Tiêu đề</label>
            <input
              id={`note-title-${note.id}`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={255}
              disabled={busy}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor={`note-content-${note.id}`}>Nội dung</label>
            <textarea
              id={`note-content-${note.id}`}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={6}
              maxLength={50000}
              disabled={busy}
              required
            />
          </div>

          <div className="row-actions">
            <Button type="submit" disabled={busy}>
              {busy ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>

            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setError("");
              }}
            >
              Hủy
            </Button>
          </div>
        </form>
      ) : (
        <>
          <h2 className="panel-title">{note.title}</h2>
                    {note.source_status === "needs_review" && (
            <div
              role="status"
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 8,
                backgroundColor: "#fffbeb",
                color: "#92400e",
                border: "1px solid #fde68a",
              }}
            >
              <strong>Cần xem lại ghi chú</strong>
              <p style={{ margin: "6px 0 0" }}>
                Nội dung nguồn hiện tại ở v{note.current_version} khác
                với bản v{note.reviewed_version} bạn đã kiểm tra.
                Hãy mở tài liệu nguồn để xem lại kiến thức đã ghi.
              </p>
            </div>
          )}

          {note.source_status === "up_to_date" && (
            <p role="status" style={{ color: "#166534" }}>
              Nội dung nguồn không thay đổi so với lần kiểm tra gần nhất.
            </p>
          )}

          {note.source_status === "source_processing" && (
            <p role="status" className="muted">
              Nguồn chưa sẵn sàng để đối chiếu. Hãy kiểm tra trạng thái
              xử lý của tài liệu rồi tải lại trang.
            </p>
          )}

          <p className="muted">
            Nguồn lúc tạo: v{note.source_version}
            {" · "}
            Cập nhật: {formatDate(note.updated_at)}
          </p>

          <p
            style={{
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
            }}
          >
            {note.content}
          </p>

          {note.document_id !== null ? (
            <Link
              to={`/documents/${note.document_id}`}
              className="primary-link"
            >
              Mở tài liệu nguồn →
            </Link>
          ) : (
                        <p className="muted">
              Không thể truy cập tài liệu nguồn: tài liệu có thể đã
              bị xóa hoặc bạn không còn quyền xem. Ghi chú vẫn được giữ lại.
            </p>
          )}

                    <div className="row-actions" style={{ marginTop: 16 }}>
            <Button
              type="button"
              variant="secondary"
              disabled={busy || reviewing}
              onClick={startEditing}
            >
              Sửa
            </Button>

            <Button
              type="button"
              variant="danger"
              disabled={busy || reviewing}
              onClick={handleDelete}
            >
              {busy ? "Đang xóa..." : "Xóa"}
            </Button>

            {note.source_status === "needs_review" && (
              <Button
                type="button"
                variant="secondary"
                disabled={busy || reviewing}
                onClick={() => setReviewing(true)}
              >
                Đối chiếu nguồn
              </Button>
            )}
          </div>

          {reviewing && (
            <StudyNoteReviewPanel
              noteId={note.id}
              onClose={() => setReviewing(false)}
              onReviewed={(updated) => {
                onUpdated(updated);
                setReviewing(false);
              }}
            />
          )}
        </>
      )}
    </article>
  );
}