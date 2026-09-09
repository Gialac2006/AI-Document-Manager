import { useState } from "react";
import type { FormEvent } from "react";
import { chatApi } from "../api/chatApi";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatId, setChatId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const question = message.trim();

    if (!question || loading) {
      return;
    }

    // Hiển thị câu hỏi của user ngay trên màn hình
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: question,
      },
    ]);

    setMessage("");
    setLoading(true);

    try {
      // Gửi câu hỏi sang backend
      const result = await chatApi.ask({
        question,
        ...(chatId !== null ? { chat_id: chatId } : {}),
      });

      // Lưu chat_id để câu tiếp theo tiếp tục đúng cuộc chat
      setChatId(result.chat_id);

      // Hiển thị câu trả lời của AI
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.answer,
        },
      ]);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Không thể gửi câu hỏi";

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Lỗi: ${errorMessage}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
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
            <p>Hãy đặt câu hỏi về tài liệu của bạn.</p>
          </div>
        ) : (
          messages.map((item, index) => (
            <div key={index} className={`chat-bubble ${item.role}`}>
              {item.content}
            </div>
          ))
        )}

        {loading && (
          <div className="chat-bubble assistant">
            AI đang trả lời...
          </div>
        )}
      </div>

      <form className="chat-input-row" onSubmit={handleSubmit}>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Hỏi AI về tài liệu của bạn..."
          disabled={loading}
        />

        <button
          type="submit"
          className="secondary-button"
          disabled={loading || !message.trim()}
        >
          {loading ? "Đang gửi..." : "Gửi"}
        </button>
      </form>
    </div>
  );
}
