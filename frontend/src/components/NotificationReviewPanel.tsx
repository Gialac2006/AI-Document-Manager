import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { notificationApi } from "../api/notificationApi";
import type { NotificationComparison } from "../api/notificationApi";
import { compareLines } from "./StudyNoteReviewPanel";
import Button from "./ui/Button";

interface Props {
  notificationId: number;
  onChanged: () => void;
  onClose: () => void;
}

export default function NotificationReviewPanel({
  notificationId,
  onChanged,
  onClose,
}: Props) {
  const [comparison, setComparison] =
    useState<NotificationComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");

  const diff = useMemo(
    () =>
      comparison
        ? compareLines(comparison.before_text, comparison.after_text)
        : null,
    [comparison],
  );

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setComparison(null);
      setChecked(false);
      setError("");

      try {
        const data = await notificationApi.compare(notificationId);
        if (!active) return;

        const state = await notificationApi.markRead(notificationId);
        if (!active) return;

        setComparison({
          ...data,
          read_at: state.read_at,
          reviewed_at: state.reviewed_at,
        });
        onChanged();
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Không thể mở đối chiếu.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [notificationId, onChanged]);

  async function confirmReview() {
    if (!comparison || !checked || saving) return;

    setSaving(true);
    setError("");

    try {
      const state = await notificationApi.review(
        notificationId,
        comparison,
      );

      setComparison({ ...comparison, ...state });
      setChecked(false);
      onChanged();
    } catch (err) {
      // Không tiếp tục xác nhận bằng dữ liệu cũ khi có lỗi.
      setComparison(null);
      setChecked(false);
      setError(
        (err instanceof Error ? err.message : "Không thể xác nhận.") +
          " Hãy đóng và mở lại phần đối chiếu.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="panel"
      aria-label="Đối chiếu phiên bản tài liệu"
      style={{ marginTop: 20, padding: 20 }}
    >
      <h2>Đối chiếu phiên bản tài liệu</h2>

      {loading && <p role="status">Đang tải nội dung...</p>}

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {comparison && diff && (
        <>
          <h3>{comparison.document_title}</h3>

          <p>
            Phiên bản {comparison.before_version} →{" "}
            {comparison.after_version}
          </p>

          {comparison.current_version > comparison.after_version && (
            <p role="status" style={{ color: "#92400e" }}>
              Tài liệu hiện có v{comparison.current_version}. Phần này
              chỉ xác nhận thay đổi từ v{comparison.before_version} đến
              v{comparison.after_version}.
            </p>
          )}

          <Link to={`/documents/${comparison.document_id}`}>
            Mở tài liệu
          </Link>

          <p>
            <span style={{ color: "#991b1b" }}>
              − Đỏ: dòng bị xóa hoặc thay thế.
            </span>{" "}
            <span style={{ color: "#166534" }}>
              + Xanh: dòng được thêm hoặc thay thế.
            </span>
          </p>

          {diff.limited && (
            <p className="muted" role="status">
              Tài liệu quá nhiều dòng để tô màu. Hai cột vẫn hiển thị
              đầy đủ nội dung để đối chiếu.
            </p>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
              gap: 16,
            }}
          >
            {[
              {
                label: `Bản trước — v${comparison.before_version}`,
                lines: diff.beforeLines,
                background: "#fee2e2",
                color: "#991b1b",
                sign: "−",
              },
              {
                label: `Bản cập nhật — v${comparison.after_version}`,
                lines: diff.afterLines,
                background: "#dcfce7",
                color: "#166534",
                sign: "+",
              },
            ].map((column) => (
              <div key={column.label} style={{ minWidth: 0 }}>
                <h4>{column.label}</h4>

                <div
                  tabIndex={0}
                  aria-label={column.label}
                  style={{
                    maxHeight: 420,
                    overflowY: "auto",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                  }}
                >
                  {column.lines.map((line, index) => (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        padding: "4px 8px",
                        background: line.changed
                          ? column.background
                          : "transparent",
                        color: line.changed ? column.color : "inherit",
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{ width: 20, flexShrink: 0 }}
                      >
                        {line.changed ? column.sign : ""}
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
            ))}
          </div>

          {comparison.reviewed_at ? (
            <p role="status" style={{ color: "#166534", marginTop: 16 }}>
              ✓ Bạn đã xác nhận đối chiếu thay đổi này.
            </p>
          ) : (
            <>
              <label
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
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
                  Tôi đã đối chiếu thay đổi từ
                  {" "}v{comparison.before_version} đến
                  {" "}v{comparison.after_version}.
                </span>
              </label>

              <Button
                type="button"
                disabled={!checked || saving}
                onClick={confirmReview}
              >
                {saving ? "Đang xác nhận..." : "Xác nhận đã đối chiếu"}
              </Button>
            </>
          )}
        </>
      )}

      <div style={{ marginTop: 16 }}>
        <Button
          type="button"
          variant="secondary"
          disabled={saving}
          onClick={onClose}
        >
          Đóng đối chiếu
        </Button>
      </div>
    </section>
  );
}