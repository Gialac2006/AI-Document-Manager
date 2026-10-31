import { useCallback, useEffect, useState } from "react";

import { notificationApi } from "../api/notificationApi";
import type {
  DocumentChangeSummary,
  DocumentNotification,
} from "../api/notificationApi";
import NotificationReviewPanel from "./NotificationReviewPanel";
import Button from "./ui/Button";

interface Props {
  documentId: number;
}

export default function DocumentChangesPanel({ documentId }: Props) {
  const [summary, setSummary] =
    useState<DocumentChangeSummary | null>(null);
  const [items, setItems] = useState<DocumentNotification[]>([]);
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    setReload((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    let fetching = false;

    async function load() {
      if (fetching) return;
      fetching = true;

      try {
        const [summaries, notifications] = await Promise.all([
          notificationApi.documentChanges(),
          notificationApi.list(page, false, documentId, true),
        ]);

        if (!active) return;

        setSummary(
          summaries.find((item) => item.document_id === documentId) ??
            null,
        );
        setError("");

        if (notifications.length === 0 && page > 1) {
          setPage((value) => value - 1);
          return;
        }

        setItems(notifications);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Không thể tải thay đổi tài liệu.",
          );
        }
      } finally {
        fetching = false;
        if (active) setLoading(false);
      }
    }

    void load();

    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 10000);

    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [documentId, page, reload]);

  if (loading) {
    return <p role="status">Đang kiểm tra thay đổi tài liệu...</p>;
  }

  const pendingCount = summary?.pending_count ?? 0;

  // Ẩn khi không còn cập nhật cần đối chiếu.
  // Giữ bảng đối chiếu đang mở và thông báo lỗi nếu có.
  if (
    pendingCount === 0 &&
    items.length === 0 &&
    !error &&
    selectedId === null
  ) {
    return null;
  }

  return (
    <section
      className="panel"
      aria-label="Thay đổi tài liệu"
      style={{
        padding: 20,
        marginBottom: 20,
        borderLeft: `4px solid ${
          error ? "#d97706" : pendingCount > 0 ? "#dc2626" : "#16a34a"
        }`,
      }}
    >
      {error ? (
        <div role="alert">
          <p>Chưa cập nhật được trạng thái thay đổi: {error}</p>
          <Button
            type="button"
            variant="secondary"
            onClick={refresh}
          >
            Thử lại
          </Button>
        </div>
      ) : (
        <>
          <h2
            style={{
              marginBottom: 8,
              color: pendingCount > 0 ? "#b91c1c" : "#166534",
            }}
          >
            {pendingCount > 0
              ? `● Tài liệu có ${pendingCount} lần cập nhật chưa đối chiếu`
              : "✓ Bạn đã đối chiếu các cập nhật được thông báo"}
          </h2>

          {pendingCount > 0 && (
            <p className="muted">
              Chọn một lần cập nhật để xem nội dung thay đổi và xác nhận.
            </p>
          )}

          {items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
                marginTop: 12,
              }}
            >
              <span>
                Thay đổi từ v{item.before_version} → v{item.after_version}
              </span>

              <Button
                type="button"
                variant="secondary"
                disabled={selectedId !== null}
                onClick={() => setSelectedId(item.id)}
              >
                Đối chiếu thay đổi
              </Button>
            </div>
          ))}

          {(page > 1 || pendingCount > 20) && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginTop: 16,
              }}
            >
              <Button
                type="button"
                variant="secondary"
                disabled={page === 1 || selectedId !== null}
                onClick={() => {
                  setLoading(true);
                  setPage((value) => value - 1);
                }}
              >
                Trang trước
              </Button>

              <span>Trang {page}</span>

              <Button
                type="button"
                variant="secondary"
                disabled={
                  page * 20 >= pendingCount || selectedId !== null
                }
                onClick={() => {
                  setLoading(true);
                  setPage((value) => value + 1);
                }}
              >
                Trang sau
              </Button>
            </div>
          )}
        </>
      )}

      {selectedId !== null && (
        <NotificationReviewPanel
          key={selectedId}
          notificationId={selectedId}
          onChanged={refresh}
          onClose={() => {
            setSelectedId(null);
            refresh();
          }}
        />
      )}
    </section>
  );
}