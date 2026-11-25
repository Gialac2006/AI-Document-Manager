import { useEffect, useState } from "react";
import { chatApi } from "../api/chatApi";
import type { ChatAttachment } from "../api/chatApi";

function ChatImage({
  attachment,
  file,
}: {
  attachment?: ChatAttachment;
  file?: File;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  const name =
    attachment?.filename ?? file?.name ?? "Ảnh đính kèm";

  useEffect(() => {
    let active = true;
    let objectUrl = "";

    setUrl("");
    setError("");

    const load = file
      ? Promise.resolve(file)
      : attachment
        ? chatApi.image(attachment.url)
        : null;

    if (load) {
      load
        .then((blob) => {
          if (!active) return;

          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        })
        .catch(() => {
          if (active) setError("Không thể tải ảnh.");
        });
    }

    return () => {
      active = false;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [attachment, file, retry]);

  return (
    <figure className="chat-saved-image">
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title="Mở ảnh đầy đủ"
        >
          <img
            src={url}
            alt={name}
            onLoad={() => {
              const element = document.querySelector(
                ".document-chat-window",
              );

              if (element) {
                element.scrollTop = element.scrollHeight;
              }
            }}
          />
        </a>
      ) : error ? (
        <div role="alert">
          <span>{error}</span>

          <button
            type="button"
            onClick={() => setRetry((value) => value + 1)}
          >
            Thử tải lại
          </button>
        </div>
      ) : (
        <span role="status">Đang tải ảnh...</span>
      )}

      <figcaption title={name}>{name}</figcaption>
    </figure>
  );
}

export default function ChatMessageImages({
  attachments = [],
  files = [],
}: {
  attachments?: ChatAttachment[];
  files?: File[];
}) {
  if (!attachments.length && !files.length) return null;

  return (
    <div className="chat-saved-images">
      {attachments.map((attachment) => (
        <ChatImage
          key={attachment.id}
          attachment={attachment}
        />
      ))}

      {files.map((file, index) => (
        <ChatImage key={`local-${index}`} file={file} />
      ))}
    </div>
  );
}