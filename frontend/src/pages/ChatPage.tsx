import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import {
  MessageSquare,
  Plus,
  Send,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { chatApi } from "../api/chatApi";
import type {
  ChatAttachment,
  ChatMessage,
  ChatSummary,
} from "../api/chatApi";

import Button from "../components/ui/Button";
import ChatImageInput from "../components/ChatImageInput";
import ChatMessageImages from "../components/ChatMessageImages";
import "../chat-page.css";

interface Message {
  id?: number;
  role: "user" | "assistant";
  content: string;
  attachments: ChatAttachment[];
  localImages?: File[];
}

function toMessage(item: ChatMessage): Message {
  return {
    id: item.id,
    role: item.role === "user" ? "user" : "assistant",
    content: item.content,
    attachments: item.attachments ?? [],
  };
}

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatId, setChatId] = useState<number | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [chatImages, setChatImages] = useState<File[]>([]);

  const [busy, setBusy] = useState<
    "opening" | "sending" | "deleting" | null
  >(null);

  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const [reload, setReload] = useState(0);

  const locked = useRef(false);
  const windowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    setListLoading(true);
    setListError("");

    chatApi
      .list()
      .then((data) => {
        if (active) setChats(data);
      })
      .catch(() => {
        if (active) {
          setListError("Không thể tải lịch sử trò chuyện.");
        }
      })
      .finally(() => {
        if (active) setListLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reload]);

  useEffect(() => {
    const element = windowRef.current;

    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages, busy]);

  function resetChat() {
    setChatId(null);
    setMessages([]);
    setMessage("");
    setChatImages([]);
    setError("");
  }

  async function handleOpenChat(id: number) {
    if (locked.current) return;

    locked.current = true;
    setBusy("opening");
    setError("");

    try {
      const history = await chatApi.history(id);

      setChatId(history.id);
      setMessages(history.messages.map(toMessage));
      setMessage("");
      setChatImages([]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể mở cuộc trò chuyện.",
      );
    } finally {
      locked.current = false;
      setBusy(null);
    }
  }

  async function handleDeleteChat(chat: ChatSummary) {
    if (locked.current) return;

    const confirmed = window.confirm(
      `Xóa cuộc trò chuyện “${chat.title}” cùng lịch sử ` +
      "và ảnh đính kèm? Thao tác này không thể hoàn tác.",
    );

    if (!confirmed) return;

    locked.current = true;
    setBusy("deleting");
    setError("");

    try {
      await chatApi.remove(chat.id);

      setChats((previous) =>
        previous.filter((item) => item.id !== chat.id),
      );

      if (chatId === chat.id) {
        resetChat();
      }

      setReload((value) => value + 1);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể xóa cuộc trò chuyện.",
      );
    } finally {
      locked.current = false;
      setBusy(null);
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const typed = message.trim();

    if (
      (!typed && chatImages.length === 0) ||
      locked.current
    ) {
      return;
    }

    const question =
      typed ||
      "Hãy mô tả và giải thích nội dung các ảnh đính kèm.";

    const files = [...chatImages];
    const draft = message;

    locked.current = true;
    setBusy("sending");
    setError("");

    setMessages((previous) => [
      ...previous,
      {
        role: "user",
        content: question,
        attachments: [],
        localImages: files,
      },
    ]);

    setMessage("");

    try {
      const result = await chatApi.ask({
        question,
        images: files,
        ...(chatId !== null ? { chat_id: chatId } : {}),
      });

      setChatId(result.chat_id);

      setMessages((previous) => [
        ...previous.slice(0, -1),
        toMessage(result.user_message),
        toMessage(result.assistant_message),
      ]);

      setChatImages([]);
      setReload((value) => value + 1);
    } catch (err) {
      setMessages((previous) => previous.slice(0, -1));
      setMessage(draft);

      setError(
        err instanceof Error
          ? err.message
          : "Không thể gửi câu hỏi. Vui lòng thử lại.",
      );
    } finally {
      locked.current = false;
      setBusy(null);
    }
  }

  return (
    <div className="document-chat-page">
      <p className="document-chat-description">
        Đặt câu hỏi về tài liệu hoặc gửi ảnh để trao đổi.
      </p>

      <div className="document-chat-grid">
        <aside
          className="panel document-chat-sidebar"
          aria-label="Lịch sử trò chuyện"
        >
          <Button
            type="button"
            disabled={busy !== null}
            onClick={resetChat}
          >
            <Plus size={18} aria-hidden="true" />
            Cuộc trò chuyện mới
          </Button>

          <h2>Lịch sử trò chuyện</h2>

          {listLoading && (
            <p className="document-chat-muted" role="status">
              Đang tải lịch sử...
            </p>
          )}

          {listError && (
            <div role="alert">
              <p>{listError}</p>

              <Button
                type="button"
                variant="secondary"
                onClick={() => setReload((value) => value + 1)}
              >
                <RefreshCw size={16} aria-hidden="true" />
                Thử lại
              </Button>
            </div>
          )}

          {!listLoading &&
            !listError &&
            chats.length === 0 && (
              <p className="document-chat-muted">
                Chưa có cuộc trò chuyện nào.
              </p>
            )}

          <div className="document-chat-history">
            {chats.map((chat) => (
              <div key={chat.id} className="chat-history-row">
                <button
                  type="button"
                  disabled={busy !== null}
                  className={
                    "chat-history-open " +
                    (chatId === chat.id ? "is-active" : "")
                  }
                  aria-pressed={chatId === chat.id}
                  title={chat.title}
                  onClick={() => void handleOpenChat(chat.id)}
                >
                  <MessageSquare
                    size={17}
                    aria-hidden="true"
                  />
                  <span>
                    {chat.title || "Cuộc trò chuyện"}
                  </span>
                </button>

                <button
                  type="button"
                  className="chat-history-delete"
                  disabled={busy !== null}
                  aria-label={
                    `Xóa cuộc trò chuyện ${chat.title}`
                  }
                  title="Xóa cuộc trò chuyện"
                  onClick={() => void handleDeleteChat(chat)}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </aside>

        <section
          className="panel document-chat-main"
          aria-label="Hội thoại"
        >
          <div
            className="document-chat-window"
            ref={windowRef}
          >
            {messages.length === 0 &&
              busy !== "opening" && (
                <div className="document-chat-empty">
                  <MessageSquare
                    size={30}
                    aria-hidden="true"
                  />
                  <h2>Bạn muốn hỏi gì về tài liệu?</h2>
                  <p>
                    Nhập câu hỏi hoặc dán ảnh bên dưới
                    để bắt đầu.
                  </p>
                </div>
              )}

            {messages.map((item, index) => (
              <article
                key={item.id ?? `pending-${index}`}
                className={
                  `document-chat-message is-${item.role}`
                }
              >
                <span className="document-chat-speaker">
                  {item.role === "user" ? "Bạn" : "Trợ lý"}
                </span>

                <div className="document-chat-content">
                  <ChatMessageImages
                    attachments={item.attachments}
                    files={item.localImages}
                  />

                  {item.role === "assistant" ? (
                    <ReactMarkdown>
                      {item.content}
                    </ReactMarkdown>
                  ) : (
                    <p>{item.content}</p>
                  )}
                </div>
              </article>
            ))}

            {busy && (
              <p
                className="document-chat-muted"
                role="status"
              >
                {busy === "opening"
                  ? "Đang mở cuộc trò chuyện..."
                  : busy === "deleting"
                    ? "Đang xóa cuộc trò chuyện..."
                    : "Đang soạn câu trả lời..."}
              </p>
            )}
          </div>

          {error && (
            <div
              className="document-chat-error"
              role="alert"
            >
              {error}
            </div>
          )}

          <form
            className="document-chat-composer"
            onSubmit={handleSubmit}
          >
            <label
              className="document-chat-input-label"
              htmlFor="document-chat-question"
            >
              Câu hỏi của bạn
            </label>

            <div className="document-chat-input-row">
              <ChatImageInput
                key={chatId ?? "new"}
                images={chatImages}
                onChange={setChatImages}
                disabled={busy !== null}
              >
                <textarea
                  id="document-chat-question"
                  rows={2}
                  value={message}
                  disabled={busy !== null}
                  onChange={(event) =>
                    setMessage(event.target.value)
                  }
                  placeholder={
                    "Nhập câu hỏi hoặc dán ảnh bằng Ctrl+V..."
                  }
                />
              </ChatImageInput>

              <Button
                type="submit"
                disabled={
                  busy !== null ||
                  (!message.trim() && chatImages.length === 0)
                }
              >
                <Send size={18} aria-hidden="true" />
                Gửi
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}