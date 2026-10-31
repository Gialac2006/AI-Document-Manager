import { request } from "./httpClient";

export interface DocumentChangeSummary {
  document_id: number;
  total_count: number;
  pending_count: number;
}

export interface DocumentNotification {
  id: number;
  document_id: number;
  document_title: string;
  before_version: number;
  after_version: number;
  created_at: string;
  read_at: string | null;
  reviewed_at: string | null;
}

export interface NotificationComparison {
  notification_id: number;
  document_id: number;
  document_title: string;
  before_version: number;
  after_version: number;
  current_version: number;
  before_text: string;
  after_text: string;
  comparison_token: string;
  read_at: string | null;
  reviewed_at: string | null;
}

interface NotificationState {
  id: number;
  read_at: string | null;
  reviewed_at: string | null;
}

export const notificationApi = {
    list(
    page = 1,
    unreadOnly = false,
    documentId?: number,
    unreviewedOnly = false,
  ) {
    const params = new URLSearchParams({
      page: String(page),
      page_size: "20",
      unread_only: String(unreadOnly),
      unreviewed_only: String(unreviewedOnly),
    });

    if (documentId !== undefined) {
      params.set("document_id", String(documentId));
    }

    return request<DocumentNotification[]>(`/notifications?${params}`);
  },

  documentChanges() {
    return request<DocumentChangeSummary[]>(
      "/notifications/document-changes",
    );
  },

  markRead(id: number) {
    return request<NotificationState>(`/notifications/${id}/read`, {
      method: "PATCH",
    });
  },

  compare(id: number) {
    return request<NotificationComparison>(
      `/notifications/${id}/comparison`,
    );
  },

  review(id: number, comparison: NotificationComparison) {
    return request<NotificationState>(`/notifications/${id}/review`, {
      method: "POST",
      body: {
        expected_after_version: comparison.after_version,
        comparison_token: comparison.comparison_token,
      },
    });
  },
};