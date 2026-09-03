import { request } from "./httpClient";


// Kiểu dữ liệu một kết quả Semantic Search
export interface SearchResult {
  document_id: number;
  document_title: string;
  document_version: number;
  chunk_index: number;
  text: string;
  score: number;
}


export const searchApi = {
  // Gửi câu tìm kiếm lên backend và nhận các đoạn gần nghĩa nhất
  search(query: string, limit = 5): Promise<SearchResult[]> {
    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
    });

    return request<SearchResult[]>(`/search?${params.toString()}`);
  },
};
