import { request } from "./httpClient";

// Cấu trúc ghi chú mà backend trả về.
export interface StudyNote {
  id: number;
  document_id: number | null;
  title: string;
  content: string;
  source_version: number;
  reviewed_version: number;
  created_at: string;
  updated_at: string;
  current_version: number | null;
  source_status:
    | "up_to_date"
    | "needs_review"
    | "source_processing"
    | "source_unavailable";
}

// Dữ liệu frontend cần gửi khi tạo ghi chú.
// Không gửi user_id: backend tự lấy từ tài khoản đăng nhập.
interface CreateStudyNote {
  document_id: number;
  source_version: number;
  title: string;
  content: string;
}


export interface StudyNoteComparison {
  before_version: number;
  current_version: number;
  before_text: string;
  after_text: string;
  source_token: string;
}


export const studyNoteApi = {
  // Lấy từng trang, mỗi trang 20 ghi chú.
  list(page = 1): Promise<StudyNote[]> {
    return request<StudyNote[]>(
      `/study-notes?page=${page}&page_size=20`,
    );
  },

  // Lưu ghi chú vào database thông qua backend.
  create(data: CreateStudyNote): Promise<StudyNote> {
    return request<StudyNote>("/study-notes", {
      method: "POST",
      body: data,
    });
  },
    // Chỉ sửa nội dung ghi chú, không thay phiên bản nguồn đã lưu.
  update(
    id: number,
    data: { title: string; content: string },
  ): Promise<StudyNote> {
    return request<StudyNote>(`/study-notes/${id}`, {
      method: "PATCH",
      body: data,
    });
  },

  // Backend kiểm tra chủ sở hữu trước khi xóa.
  delete(id: number): Promise<unknown> {
    return request(`/study-notes/${id}`, {
      method: "DELETE",
    });
  },
  
    compare(id: number): Promise<StudyNoteComparison> {
    return request<StudyNoteComparison>(
      `/study-notes/${id}/comparison`,
    );
  },

  review(
    id: number,
    data: {
      expected_version: number;
      source_token: string;
    },
  ): Promise<StudyNote> {
    return request<StudyNote>(`/study-notes/${id}/review`, {
      method: "POST",
      body: data,
    });
  },
};
