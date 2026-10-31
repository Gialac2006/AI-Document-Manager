import { useCallback, useEffect, useState } from "react";

import { notificationApi } from "../api/notificationApi";
import type { DocumentNotification } from "../api/notificationApi";
import NotificationReviewPanel from "../components/NotificationReviewPanel";
import Button from "../components/ui/Button";

export default function NotificationsPage() {
  const [items, setItems] = useState<DocumentNotification[]>([]);
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [reload, setReload] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    setLoading(true);
    setReload((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const data = await notificationApi.list(page, unreadOnly);
        if (!active) return;

        if (data.length === 0 && page > 1) {
          setPage((value) => value - 1);
          return;
        }

        setItems(data);
        setLoading(false);
      } catch (err) {
        if (!active) return;

        setItems([]);
        setError(
          err instanceof Error
            ? err.message
            : "Không thể tải thông báo.",
        );
        setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [page, unreadOnly, reload]);

  function changeFilter(value: boolean) {
    if (value === unreadOnly) return;
    setLoading(true);
    setPage(1);
    setUnreadOnly(value);
  }

  const controlsDisabled = loading || selectedId !== null;

  return (
    <section>
      <h1>Thông báo</h1>
      <p className="muted">
        Theo dõi phiên bản mới của tài liệu được chia sẻ với bạn.
      </p>

      <div
        className="row-actions"
        style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
      >
        <Button
          type="button"
          variant="secondary"
          disabled={controlsDisabled}
          aria-pressed={!unreadOnly}
          onClick={() => changeFilter(false)}
        >
          {!unreadOnly ? "✓ Tất cả" : "Tất cả"}
        </Button>

        <Button
          type="button"
          variant="secondary"
          disabled={controlsDisabled}
          aria-pressed={unreadOnly}
          onClick={() => changeFilter(true)}
        >
          {unreadOnly ? "✓ Chưa đọc" : "Chưa đọc"}
        </Button>

        <Button
          type="button"
          variant="secondary"
          disabled={controlsDisabled}
          onClick={refresh}
        >
          Tải lại
        </Button>
      </div>

      {loading ? (
        <p role="status">Đang tải thông báo...</p>
      ) : error ? (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      ) : (
        <>
          {items.length === 0 && (
            <p>
              {unreadOnly
                ? "Bạn không có thông báo chưa đọc."
                : "Bạn chưa có thông báo."}
            </p>
          )}

          {items.map((item) => (
            <article
              key={item.id}
              className="panel"
              style={{
                padding: 16,
                marginTop: 16,
                borderLeft: `4px solid ${
                  item.read_at ? "#d1d5db" : "#2563eb"
                }`,
              }}
            >
              <h3>{item.document_title}</h3>

              <p>
                Có phiên bản mới: v{item.before_version} → v
                {item.after_version}
              </p>

              <p className="muted">
                {item.read_at ? "Đã đọc" : "Chưa đọc"}
                {" · "}
                {item.reviewed_at ? "Đã đối chiếu" : "Chưa đối chiếu"}
              </p>

              <Button
                type="button"
                variant="secondary"
                disabled={selectedId !== null}
                onClick={() => setSelectedId(item.id)}
              >
                {item.reviewed_at ? "Xem lại đối chiếu" : "Đối chiếu"}
              </Button>
            </article>
          ))}
        </>
      )}

      {selectedId !== null && (
        <NotificationReviewPanel
          key={selectedId}
          notificationId={selectedId}
          onChanged={refresh}
          onClose={() => setSelectedId(null)}
        />
      )}

      <div
        className="row-actions"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginTop: 20,
        }}
      >
        <Button
          type="button"
          variant="secondary"
          disabled={controlsDisabled || page === 1}
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
          disabled={controlsDisabled || Boolean(error) || items.length < 20}
          onClick={() => {
            setLoading(true);
            setPage((value) => value + 1);
          }}
        >
          Trang sau
        </Button>
      </div>
    </section>
  );
}