import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import { MessageSquare, Plus, Send, RefreshCw } from "lucide-react";
import { chatApi } from "../api/chatApi";
import type { ChatSummary } from "../api/chatApi";
import Button from "../components/ui/Button";
import "../chat-page.css";

interface Message { role: "user" | "assistant"; content: string; }

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatId, setChatId] = useState<number | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [busy, setBusy] = useState<"opening" | "sending" | null>(null);
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
    chatApi.list().then((data) => { if (active) setChats(data); })
      .catch(() => { if (active) setListError("Không thể tải lịch sử trò chuyện."); })
      .finally(() => { if (active) setListLoading(false); });
    return () => { active = false; };
  }, [reload]);

  useEffect(() => {
    const element = windowRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, busy]);

  async function handleOpenChat(id: number) {
    if (locked.current) return;
    locked.current = true;
    setBusy("opening");
    setError("");
    try {
      const history = await chatApi.history(id);
      setChatId(history.id);
      setMessages(history.messages.map((item) => ({
        role: item.role === "user" ? "user" : "assistant", content: item.content,
      })));
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể mở cuộc trò chuyện.");
    } finally { locked.current = false; setBusy(null); }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const question = message.trim();
    if (!question || locked.current) return;
    locked.current = true;
    setBusy("sending");
    setError("");
    setMessages((previous) => [...previous, { role: "user", content: question }]);
    setMessage("");
    try {
      const result = await chatApi.ask({ question, ...(chatId !== null ? { chat_id: chatId } : {}) });
      setChatId(result.chat_id);
      setMessages((previous) => [...previous, { role: "assistant", content: result.answer }]);
      setReload((value) => value + 1);
    } catch (err) {
      setMessages((previous) => previous.slice(0, -1));
      setMessage(question);
      setError(err instanceof Error ? err.message : "Không thể gửi câu hỏi. Vui lòng thử lại.");
    } finally { locked.current = false; setBusy(null); }
  }

  return (
    <div className="document-chat-page">
      <p className="document-chat-description">Đặt câu hỏi và trao đổi về nội dung tài liệu của bạn.</p>
      <div className="document-chat-grid">
        <aside className="panel document-chat-sidebar" aria-label="Lịch sử trò chuyện">
          <Button type="button" disabled={busy !== null} onClick={() => {
            setChatId(null); setMessages([]); setMessage(""); setError("");
          }}><Plus size={18} aria-hidden="true" /> Cuộc trò chuyện mới</Button>
          <h2>Lịch sử trò chuyện</h2>
          {listLoading && <p className="document-chat-muted" role="status">Đang tải lịch sử...</p>}
          {listError && <div role="alert"><p>{listError}</p><Button type="button" variant="secondary" onClick={() => setReload((value) => value + 1)}><RefreshCw size={16} aria-hidden="true" /> Thử lại</Button></div>}
          {!listLoading && !listError && chats.length === 0 && <p className="document-chat-muted">Chưa có cuộc trò chuyện nào.</p>}
          <div className="document-chat-history">
            {chats.map((chat) => <button key={chat.id} type="button" disabled={busy !== null}
              className={chatId === chat.id ? "is-active" : ""} aria-pressed={chatId === chat.id}
              title={chat.title} onClick={() => void handleOpenChat(chat.id)}>
              <MessageSquare size={17} aria-hidden="true" /><span>{chat.title || "Cuộc trò chuyện"}</span>
            </button>)}
          </div>
        </aside>
        <section className="panel document-chat-main" aria-label="Hội thoại">
          <div className="document-chat-window" ref={windowRef}>
            {messages.length === 0 && busy !== "opening" && <div className="document-chat-empty">
              <MessageSquare size={30} aria-hidden="true" />
              <h2>Bạn muốn hỏi gì về tài liệu?</h2>
              <p>Nhập câu hỏi bên dưới để bắt đầu cuộc trò chuyện.</p>
            </div>}
            {messages.map((item, index) => <article key={index} className={`document-chat-message is-${item.role}`}>
              <span className="document-chat-speaker">{item.role === "user" ? "Bạn" : "Trợ lý"}</span>
              <div className="document-chat-content">{item.role === "assistant" ? <ReactMarkdown>{item.content}</ReactMarkdown> : <p>{item.content}</p>}</div>
            </article>)}
            {busy && <p className="document-chat-muted" role="status">{busy === "opening" ? "Đang mở cuộc trò chuyện..." : "Đang soạn câu trả lời..."}</p>}
          </div>
          {error && <div className="document-chat-error" role="alert">{error}</div>}
          <form className="document-chat-composer" onSubmit={handleSubmit}>
            <label className="document-chat-input-label" htmlFor="document-chat-question">Câu hỏi của bạn</label>
            <div className="document-chat-input-row">
              <textarea id="document-chat-question" rows={2} value={message} disabled={busy !== null}
                onChange={(e) => setMessage(e.target.value)} placeholder="Nhập câu hỏi về tài liệu..." />
              <Button type="submit" disabled={busy !== null || !message.trim()}><Send size={18} aria-hidden="true" /> Gửi</Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
