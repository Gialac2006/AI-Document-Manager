import { useEffect, useState } from "react";

import { studyNoteApi } from "../api/studyNoteApi";
import type {
  StudyNote,
  StudyNoteComparison,
} from "../api/studyNoteApi";
import Button from "./ui/Button";

interface Props {
  noteId: number;
  onReviewed: (note: StudyNote) => void;
  onClose: () => void;
}

export default function StudyNoteReviewPanel({
  noteId,
  onReviewed,
  onClose,
}: Props) {
  const [comparison, setComparison] =
    useState<StudyNoteComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadComparison() {
      setLoading(true);
      setComparison(null);
      setChecked(false);
      setError("");

      try {
        const result = await studyNoteApi.compare(noteId);
        if (active) setComparison(result);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Không thể tải nội dung đối chiếu.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadComparison();

    return () => {
      active = false;
    };
  }, [noteId]);

  async function handleConfirm() {
    if (!comparison || !checked || saving) return;

    setSaving(true);
    setError("");

    try {
      const updated = await studyNoteApi.review(noteId, {
        expected_version: comparison.current_version,
        source_token: comparison.source_token,
      });

      onReviewed(updated);
    } catch (err) {
      setChecked(false);
      setError(
        err instanceof Error
          ? err.message
          : "Không thể xác nhận đã xem lại.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      aria-label="Đối chiếu tài liệu nguồn"
      style={{
        marginTop: 20,
        paddingTop: 16,
        borderTop: "1px solid #e5e7eb",
      }}
    >
      <h3>Đối chiếu tài liệu nguồn</h3>

      {loading && <p role="status">Đang tải nội dung...</p>}

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {comparison && (
        <>
          <p className="muted">
            So sánh nguồn ở lần kiểm tra gần nhất với nguồn hiện tại.
            Nội dung được hiển thị đầy đủ, chưa tô màu từng đoạn thay đổi.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
              gap: 16,
              marginTop: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <h4>
                Lần kiểm tra trước — v{comparison.before_version}
              </h4>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                  maxHeight: 400,
                  overflowY: "auto",
                  padding: 12,
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  background: "#f9fafb",
                  fontFamily: "inherit",
                  fontSize: 14,
                }}
              >
                {comparison.before_text}
              </pre>
            </div>

            <div style={{ minWidth: 0 }}>
              <h4>
                Nguồn hiện tại — v{comparison.current_version}
              </h4>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                  maxHeight: 400,
                  overflowY: "auto",
                  padding: 12,
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  background: "#f9fafb",
                  fontFamily: "inherit",
                  fontSize: 14,
                }}
              >
                {comparison.after_text}
              </pre>
            </div>
          </div>

          <p className="muted">
            Nếu cần chỉnh ghi chú, hãy đóng phần này, bấm Sửa và lưu
            nội dung trước khi mở lại để xác nhận.
          </p>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              margin: "16px 0",
            }}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={saving}
              onChange={(event) => setChecked(event.target.checked)}
              style={{ width: "auto", marginTop: 4 }}
            />
            <span>
              Tôi đã đối chiếu nguồn và kiểm tra rằng ghi chú vẫn
              phù hợp với v{comparison.current_version}.
            </span>
          </label>
        </>
      )}

      <div className="row-actions" style={{ marginTop: 16 }}>
        {comparison && (
          <Button
            type="button"
            disabled={loading || saving || !checked}
            onClick={handleConfirm}
          >
            {saving ? "Đang xác nhận..." : "Xác nhận đã xem lại"}
          </Button>
        )}

        <Button
          type="button"
          variant="secondary"
          disabled={saving}
          onClick={onClose}
        >
          Đóng
        </Button>
      </div>
    </section>
  );
}