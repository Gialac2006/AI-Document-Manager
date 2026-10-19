import { useEffect, useMemo, useState } from "react";
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

type DiffLine = {
  text: string;
  changed: boolean;
};

function compareLines(before: string, after: string): {
  beforeLines: DiffLine[];
  afterLines: DiffLine[];
  limited: boolean;
} {
  const beforeLines = before.split(/\r\n|\n|\r/);
  const afterLines = after.split(/\r\n|\n|\r/);

  // Giới hạn khối lượng tính toán cho tài liệu dài.
  if (
    beforeLines.length * afterLines.length > 1_000_000 ||
    beforeLines.length + afterLines.length > 10_000
  ) {
    return {
      beforeLines: beforeLines.map((text) => ({
        text,
        changed: false,
      })),
      afterLines: afterLines.map((text) => ({
        text,
        changed: false,
      })),
      limited: true,
    };
  }

  const normalize = (text: string) =>
    text.normalize("NFC").trim().replace(/\s+/g, " ");

  const oldKeys = beforeLines.map(normalize);
  const newKeys = afterLines.map(normalize);

  // Tìm các dòng chung theo đúng thứ tự xuất hiện.
  const table = Array.from(
    { length: beforeLines.length + 1 },
    () => new Uint32Array(afterLines.length + 1),
  );

  for (let i = beforeLines.length - 1; i >= 0; i--) {
    for (let j = afterLines.length - 1; j >= 0; j--) {
      table[i][j] =
        oldKeys[i] === newKeys[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const oldResult = beforeLines.map((text) => ({
    text,
    changed: true,
  }));
  const newResult = afterLines.map((text) => ({
    text,
    changed: true,
  }));

  let i = 0;
  let j = 0;

  while (i < beforeLines.length && j < afterLines.length) {
    if (oldKeys[i] === newKeys[j]) {
      oldResult[i].changed = false;
      newResult[j].changed = false;
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }

  return {
    beforeLines: oldResult,
    afterLines: newResult,
    limited: false,
  };
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
  const diff = useMemo(() => {
    if (!comparison) return null;

    return compareLines(
      comparison.before_text,
      comparison.after_text,
    );
  }, [comparison]);

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
            Dòng được sửa sẽ xuất hiện dưới dạng xóa ở bên trái và
            thêm ở bên phải.
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              margin: "12px 0",
            }}
          >
            <span
              style={{
                background: "#fee2e2",
                color: "#991b1b",
                padding: "4px 8px",
                borderRadius: 4,
              }}
            >
              − Nội dung bị xóa hoặc thay thế
            </span>

            <span
              style={{
                background: "#dcfce7",
                color: "#166534",
                padding: "4px 8px",
                borderRadius: 4,
              }}
            >
              + Nội dung được thêm hoặc thay thế
            </span>
          </div>

          {diff?.limited && (
            <p role="status" className="muted">
              Tài liệu có quá nhiều dòng để tô màu trong bản hiện tại.
              Hai cột bên dưới vẫn hiển thị đầy đủ nội dung để đối chiếu.
            </p>
          )}

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

              <div
                tabIndex={0}
                aria-label="Nội dung nguồn lần kiểm tra trước"
                style={{
                  maxHeight: 400,
                  overflowY: "auto",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  background: "#f9fafb",
                  fontSize: 14,
                }}
              >
                {diff?.beforeLines.map((line, index) => (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      padding: "3px 8px",
                      background: line.changed
                        ? "#fee2e2"
                        : "transparent",
                      color: line.changed ? "#991b1b" : "inherit",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 20,
                        flexShrink: 0,
                        fontWeight: 700,
                      }}
                    >
                      {line.changed ? "−" : ""}
                    </span>
                    <span
                      style={{
                        minWidth: 0,
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {line.text || "\u00a0"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ minWidth: 0 }}>
              <h4>
                Nguồn hiện tại — v{comparison.current_version}
              </h4>

              <div
                tabIndex={0}
                aria-label="Nội dung nguồn hiện tại"
                style={{
                  maxHeight: 400,
                  overflowY: "auto",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  background: "#f9fafb",
                  fontSize: 14,
                }}
              >
                {diff?.afterLines.map((line, index) => (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      padding: "3px 8px",
                      background: line.changed
                        ? "#dcfce7"
                        : "transparent",
                      color: line.changed ? "#166534" : "inherit",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 20,
                        flexShrink: 0,
                        fontWeight: 700,
                      }}
                    >
                      {line.changed ? "+" : ""}
                    </span>
                    <span
                      style={{
                        minWidth: 0,
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {line.text || "\u00a0"}
                    </span>
                  </div>
                ))}
              </div>
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