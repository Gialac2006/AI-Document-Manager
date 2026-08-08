import { useState } from "react";
import type { FormEvent } from "react";

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [messages] = useState<{ role: string; content: string }[]>([]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage("");
  };

  return (
    <div className="chat-layout">
      <div className="chat-header">
        <div>
          <h1>Chat với tài liệu</h1>
          <p className="page-header-desc">
            Đặt câu hỏi, AI sẽ trả lời dựa trên tài liệu bạn đã lưu (RAG).
          </p>
        </div>
      </div>

      <div className="chat-window">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <span className="empty-icon">💬</span>
            <p>
              Chào bạn! Hãy đặt câu hỏi về tài liệu của bạn, ví dụ:{" "}
              <em>"Tóm tắt Q3 Financial Report"</em>.
            </p>
            <p className="muted" style={{ fontSize: "12.5px" }}>
              Trò chuyện với tài liệu sẽ hoàn thiện ở Giai đoạn 4 (RAG).
            </p>
          </div>
        ) : (
          messages.map((m, index) => (
            <div key={index} className={`chat-bubble ${m.role}`}>
              {m.content}
            </div>
          ))
        )}
      </div>

      <form className="chat-input-row" onSubmit={handleSubmit}>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Hỏi AI về tài liệu của bạn..."
        />
        <button type="submit" className="secondary-button" disabled title="Sắp ra mắt">
          Gửi
        </button>
      </form>
    </div>
  );
}