import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { studyNoteApi } from "../api/studyNoteApi";
import type { StudyNote } from "../api/studyNoteApi";
import Button from "../components/ui/Button";
import StudyNoteCard from "../components/StudyNoteCard";

export default function StudyNotesPage() {
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  // Tải lại danh sách khi người dùng đổi trang.
  useEffect(() => {
    // Bỏ qua kết quả cũ nếu đã rời trang hoặc đổi trang khác.
    let active = true;

    async function loadNotes() {
      setLoading(true);
      setError("");

      try {
        const data = await studyNoteApi.list(page);
        if (active) setNotes(data);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Không thể tải ghi chú.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadNotes();

    return () => {
      active = false;
    };
  }, [page, reload]);

  return (
    <section>
      <h1>Ghi chú học tập</h1>
      <p className="muted">
        Kiến thức bạn đã lưu từ các tài liệu để ôn lại.
      </p>

      <Link to="/documents" className="primary-link">
        Mở tài liệu để tạo ghi chú →
      </Link>

      {loading ? (
        <p role="status">Đang tải ghi chú...</p>
      ) : error ? (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      ) : (
        <>
          {notes.length === 0 && (
            <div className="panel" style={{ marginTop: 20 }}>
              {page === 1
                ? "Bạn chưa có ghi chú. Mở một tài liệu để viết ghi chú đầu tiên."
                : "Không còn ghi chú ở trang này."}
            </div>
          )}

          {notes.map((note) => (
  <StudyNoteCard
    key={note.id}
    note={note}
    onUpdated={(updated) => {
      // Chỉ thay ghi chú vừa sửa, giữ các ghi chú còn lại.
      setNotes((current) =>
        current.map((item) =>
          item.id === updated.id ? updated : item,
        ),
      );
    }}
    onDeleted={() => {
      // Nếu xóa mục cuối của trang sau, quay về trang trước.
      if (notes.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        // Tải lại để lấy đủ dữ liệu đúng theo phân trang.
        setReload((current) => current + 1);
      }
    }}
  />
))}
        </>
      )}

      <div className="row-actions" style={{ marginTop: 20 }}>
        <Button
          variant="secondary"
          disabled={loading || page === 1}
          onClick={() => setPage((value) => value - 1)}
        >
          Trang trước
        </Button>

        <span>Trang {page}</span>

        <Button
          variant="secondary"
          disabled={loading || Boolean(error) || notes.length < 20}
          onClick={() => setPage((value) => value + 1)}
        >
          Trang sau
        </Button>
      </div>
    </section>
  );
}