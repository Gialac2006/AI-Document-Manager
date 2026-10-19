import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { studyNoteApi } from "../api/studyNoteApi";
import type {
  StudyNote,
  StudyNoteFilter,
} from "../api/studyNoteApi";
import Button from "../components/ui/Button";
import StudyNoteCard from "../components/StudyNoteCard";

export default function StudyNotesPage() {
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<StudyNoteFilter>("all");
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadNotes() {
      setLoading(true);
      setError("");

      try {
        const data = await studyNoteApi.list(page, filter);

        if (!active) return;

        // Sau khi xóa hoặc xác nhận, trang cuối có thể bị trống.
        // Quay lại trang trước để lấy danh sách còn lại.
        if (data.length === 0 && page > 1) {
          setPage((current) => current - 1);
          return;
        }

        setNotes(data);
        setLoading(false);
      } catch (err) {
        if (!active) return;

        setError(
          err instanceof Error
            ? err.message
            : "Không thể tải ghi chú.",
        );
        setLoading(false);
      }
    }

    void loadNotes();

    return () => {
      active = false;
    };
  }, [page, filter, reload]);

  function changeFilter(nextFilter: StudyNoteFilter) {
    if (loading || nextFilter === filter) return;

    setLoading(true);
    setError("");
    setPage(1);
    setFilter(nextFilter);
  }

  function reloadNotes() {
    setLoading(true);
    setError("");
    setReload((current) => current + 1);
  }

  function handleUpdated(updated: StudyNote) {
    if (filter === "needs_review") {
      // Trạng thái có thể đã đổi sau khi xác nhận.
      // Lấy lại danh sách từ backend để lọc và phân trang đúng.
      reloadNotes();
      return;
    }

    setNotes((current) =>
      current.map((item) =>
        item.id === updated.id ? updated : item,
      ),
    );
  }

  function changePage(nextPage: number) {
    setLoading(true);
    setPage(nextPage);
  }

  return (
    <section>
      <h1>Ghi chú học tập</h1>

      <p className="muted">
        Kiến thức bạn đã lưu từ các tài liệu để ôn lại.
      </p>

      <Link to="/documents" className="primary-link">
        Mở tài liệu để tạo ghi chú →
      </Link>

      <div
        role="group"
        aria-label="Lọc ghi chú"
        className="row-actions"
        style={{
          marginTop: 20,
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <Button
          type="button"
          variant="secondary"
          disabled={loading}
          aria-pressed={filter === "all"}
          onClick={() => changeFilter("all")}
        >
          {filter === "all" ? "✓ Tất cả" : "Tất cả"}
        </Button>

        <Button
          type="button"
          variant="secondary"
          disabled={loading}
          aria-pressed={filter === "needs_review"}
          onClick={() => changeFilter("needs_review")}
        >
          {filter === "needs_review"
            ? "✓ Cần xem lại"
            : "Cần xem lại"}
        </Button>

        <Button
          type="button"
          variant="secondary"
          disabled={loading}
          onClick={reloadNotes}
        >
          Tải lại
        </Button>
      </div>

      <p className="muted">
        {filter === "needs_review"
          ? "Chỉ hiển thị ghi chú có nội dung nguồn thay đổi so với lần kiểm tra gần nhất."
          : "Hiển thị tất cả ghi chú của bạn."}
      </p>

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
              {filter === "needs_review"
                ? "Hiện không có ghi chú nào cần xem lại."
                : "Bạn chưa có ghi chú. Mở một tài liệu để viết ghi chú đầu tiên."}
            </div>
          )}

          {notes.map((note) => (
            <StudyNoteCard
              key={note.id}
              note={note}
              onUpdated={handleUpdated}
              onDeleted={reloadNotes}
            />
          ))}
        </>
      )}

      <div
        className="row-actions"
        style={{
          marginTop: 20,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Button
          type="button"
          variant="secondary"
          disabled={loading || page === 1}
          onClick={() => changePage(page - 1)}
        >
          Trang trước
        </Button>

        <span>Trang {page}</span>

        <Button
          type="button"
          variant="secondary"
          disabled={loading || Boolean(error) || notes.length < 20}
          onClick={() => changePage(page + 1)}
        >
          Trang sau
        </Button>
      </div>
    </section>
  );
}