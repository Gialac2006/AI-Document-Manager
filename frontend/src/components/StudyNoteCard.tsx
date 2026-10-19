import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

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
            <p className="muted">Tài liệu nguồn đã bị xóa.</p>
          )}

          <div className="row-actions" style={{ marginTop: 16 }}>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={startEditing}
            >
              Sửa
            </Button>

            <Button
              type="button"
              variant="danger"
              disabled={busy}
              onClick={handleDelete}
            >
              {busy ? "Đang xóa..." : "Xóa"}
            </Button>
          </div>
        </>
      )}
    </article>
  );
}