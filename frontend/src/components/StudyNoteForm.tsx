import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import { studyNoteApi } from "../api/studyNoteApi";
import type { Document } from "../types";
import Button from "./ui/Button";

interface Props {
  document: Document;
}

export default function StudyNoteForm({ document }: Props) {
  // Giá trị người dùng nhập.
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  // Trạng thái lưu và thông báo.
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // Chỉ cho lưu khi tài liệu đã trích xuất văn bản.
  // Backend vẫn kiểm tra lại điều kiện này.
  // Nếu API chưa trả trạng thái, dùng chuỗi rỗng.
// Khi đó ready = false, nút lưu sẽ bị vô hiệu hóa.
    const ready = ["text_extracted", "indexed"].includes(
    document.processing_status ?? "",
    );
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Ngăn form tải lại toàn bộ trang.
    event.preventDefault();

    if (saving || !ready) return;

    // Không chấp nhận nội dung chỉ chứa khoảng trắng.
    if (!title.trim() || !content.trim()) {
      setError("Vui lòng nhập tiêu đề và nội dung ghi chú.");
      return;
    }

    setSaving(true);
    setError("");
    setSaved(false);

    try {
      await studyNoteApi.create({
        document_id: document.id,
        source_version: document.current_version,
        title: title.trim(),
        content: content.trim(),
      });

      // Chỉ xóa nội dung form khi backend đã lưu thành công.
      setTitle("");
      setContent("");
      setSaved(true);
    } catch (err) {
      // Giữ nguyên nội dung đã nhập khi có lỗi.
      setError(
        err instanceof Error ? err.message : "Không thể lưu ghi chú.",
      );
    } finally {
      // Luôn bật lại nút sau khi yêu cầu kết thúc.
      setSaving(false);
    }
  }

  return (
    <section className="panel">
      <h2 className="panel-title">Ghi chú học tập</h2>

      <p className="muted">
        Ghi chú gắn với phiên bản v{document.current_version} của tài liệu.
      </p>

      {!ready && (
        <p role="status">
          Tài liệu cần xử lý xong trước khi bạn lưu ghi chú.
        </p>
      )}

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {saved && (
        <p role="status">
          Đã lưu ghi chú.{" "}
          <Link to="/study-notes" className="primary-link">
            Xem ghi chú của tôi →
          </Link>
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="study-note-title">Tiêu đề</label>
          <input
            id="study-note-title"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setSaved(false);
            }}
            placeholder="Ví dụ: Phân biệt khóa chính và khóa ngoại"
            maxLength={255}
            disabled={saving}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="study-note-content">Nội dung cần ghi nhớ</label>
          <textarea
            id="study-note-content"
            value={content}
            onChange={(event) => {
              setContent(event.target.value);
              setSaved(false);
            }}
            placeholder="Viết kiến thức bạn muốn lưu để ôn lại..."
            rows={6}
            maxLength={50000}
            disabled={saving}
            required
          />
        </div>

        <Button type="submit" disabled={saving || !ready}>
          {saving ? "Đang lưu..." : "Lưu ghi chú"}
        </Button>
      </form>
    </section>
  );
}