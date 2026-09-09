import { request } from "./httpClient";

// Dữ liệu gửi lên backend khi hỏi AI
export interface ChatRequest {
  question: string;
  chat_id?: number;
}

// Dữ liệu backend trả về sau khi AI trả lời
export interface ChatResponse {
  chat_id: number;
  question: string;
  answer: string;
}

// Một tin nhắn trong lịch sử chat
export interface ChatMessage {
  id: number;
  role: string;
  content: string;
  created_at: string;
}

// Chi tiết một cuộc chat
export interface ChatHistory {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  messages: ChatMessage[];
}

export const chatApi = {
  // Gửi câu hỏi cho AI
  ask(data: ChatRequest): Promise<ChatResponse> {
    return request<ChatResponse>("/chat", {
      method: "POST",
      body: data,
    });
  },

  // Lấy danh sách các cuộc chat của user
list(): Promise<ChatSummary[]> {
  return request<ChatSummary[]>("/chat");
},

  // Lấy lịch sử của một cuộc chat
  history(chatId: number): Promise<ChatHistory> {
    return request<ChatHistory>(`/chat/${chatId}`);
  },
};


  // Thông tin ngắn gọn của một cuộc chat
export interface ChatSummary {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}
