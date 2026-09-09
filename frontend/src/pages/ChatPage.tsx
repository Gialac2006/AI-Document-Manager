import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import ReactMarkdown from "react-markdown";

import { chatApi } from "../api/chatApi";
import type { ChatSummary } from "../api/chatApi";


interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatId, setChatId] = useState<number | null>(null);
  // Danh sách các cuộc chat cũ của user
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(false);

  // Khi mở trang chat, lấy danh sách các cuộc chat đã lưu
  useEffect(() => {
    const loadChats = async () => {
      try {
        const result = await chatApi.list();
        setChats(result);
      } catch (error) {
        console.error("Không thể tải danh sách chat:", error);
      }
    };

    loadChats();
  }, []);


    // Mở lại một cuộc chat cũ
  const handleOpenChat = async (id: number) => {
    try {
      setLoading(true);

      const history = await chatApi.history(id);

      // Ghi nhớ chat đang mở
      setChatId(history.id);

      // Hiển thị lại toàn bộ tin nhắn cũ
      setMessages(
        history.messages.map((item) => ({
          role: item.role === "user" ? "user" : "assistant",
          content: item.content,
        }))
      );
    } catch (error) {
      console.error("Không thể mở lịch sử chat:", error);
    } finally {
      setLoading(false);
    }
  };


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

<div className="chat-history">
  <h3>Lịch sử chat</h3>

  <div className="chat-history-list">
    {chats.length === 0 ? (
      <p>Chưa có cuộc chat nào.</p>
    ) : (
      chats.map((chat) => (
        <button
          key={chat.id}
          type="button"
          className={`chat-history-item ${
            chatId === chat.id ? "active" : ""
          }`}
          onClick={() => handleOpenChat(chat.id)}
        >
          {chat.title}
        </button>
      ))
    )}
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
              {item.role === "assistant" ? (
                // Câu trả lời AI có thể chứa Markdown
                <ReactMarkdown>{item.content}</ReactMarkdown>
              ) : (
                // Tin nhắn của user hiển thị bình thường
                item.content
              )}
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
