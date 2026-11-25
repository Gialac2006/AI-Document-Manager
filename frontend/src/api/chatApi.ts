import { request, requestBlob } from "./httpClient";

export interface ChatAttachment {
  id: number;
  filename: string;
  content_type: string;
  byte_size: number;
  url: string;
}

export interface ChatMessage {
  id: number;
  role: string;
  content: string;
  created_at: string;
  attachments: ChatAttachment[];
}

export interface ChatRequest {
  question: string;
  chat_id?: number;
  images?: File[];
}

export interface ChatResponse {
  chat_id: number;
  question: string;
  answer: string;
  user_message: ChatMessage;
  assistant_message: ChatMessage;
}

export interface ChatSummary {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatHistory {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  messages: ChatMessage[];
}

export const chatApi = {
  ask(data: ChatRequest): Promise<ChatResponse> {
    if (data.images?.length) {
      const body = new FormData();
      body.append("question", data.question);

      if (data.chat_id !== undefined) {
        body.append("chat_id", String(data.chat_id));
      }

      for (const image of data.images) {
        body.append("images", image);
      }

      return request<ChatResponse>("/chat/with-images", {
        method: "POST",
        body,
      });
    }

    return request<ChatResponse>("/chat", {
      method: "POST",
      body: {
        question: data.question,
        chat_id: data.chat_id,
      },
    });
  },

  list(): Promise<ChatSummary[]> {
    return request<ChatSummary[]>("/chat");
  },

  history(chatId: number): Promise<ChatHistory> {
    return request<ChatHistory>(`/chat/${chatId}`);
  },

  remove(chatId: number): Promise<void> {
    return request<void>(`/chat/${chatId}`, {
      method: "DELETE",
    });
  },

  image(url: string): Promise<Blob> {
    return requestBlob(url);
  },
};