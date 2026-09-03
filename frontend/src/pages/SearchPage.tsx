import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { searchApi } from "../api/searchApi";
import type { SearchResult } from "../api/searchApi";


export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Lấy câu tìm kiếm từ URL, ví dụ: /search?q=IaaS
  const query = searchParams.get("q") || "";

  const [text, setText] = useState(query);

  // Danh sách kết quả backend trả về
  const [results, setResults] = useState<SearchResult[]>([]);

  // Trạng thái loading và lỗi
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");


  // Khi query trên URL thay đổi thì tự động gọi Semantic Search API
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    async function loadResults() {
      setLoading(true);
      setError("");

      try {
        const data = await searchApi.search(query, 5);
        setResults(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Không thể tìm kiếm tài liệu"
        );
      } finally {
        setLoading(false);
      }
    }

    loadResults();
  }, [query]);


  // Khi user bấm nút Tìm kiếm
  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const value = text.trim();

    if (!value) {
      return;
    }

    // Đưa câu tìm kiếm lên URL
    // useEffect phía trên sẽ tự gọi API
    navigate(`/search?q=${encodeURIComponent(value)}`);
  };


  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Tìm kiếm ngữ nghĩa</h1>
          <p className="page-header-desc">
            Tìm tài liệu theo ý nghĩa câu hỏi, không chỉ theo từ khoá.
          </p>
        </div>
      </div>

      <section className="panel search-panel">
        <form className="search-hero" onSubmit={handleSearch}>
          <span className="search-hero-icon">🔍</span>

          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Nhập câu hỏi hoặc nội dung cần tìm..."
            className="search-hero-input"
          />

          <button type="submit" className="secondary-button">
            Tìm kiếm
          </button>
        </form>

        {/* Đang tìm kiếm */}
        {loading && (
          <div className="empty-state search-empty">
            Đang tìm kiếm...
          </div>
        )}

        {/* Có lỗi */}
        {!loading && error && (
          <div className="empty-state search-empty">
            {error}
          </div>
        )}

        {/* Chưa nhập câu tìm kiếm */}
        {!loading && !error && !query && (
          <div className="empty-state search-empty">
            <span className="empty-icon">🧠</span>
            Nhập câu hỏi ở trên để tìm kiếm theo nội dung tài liệu.
          </div>
        )}

        {/* Có query nhưng không tìm thấy */}
        {!loading && !error && query && results.length === 0 && (
          <div className="empty-state search-empty">
            Không tìm thấy kết quả phù hợp với "{query}".
          </div>
        )}

        {/* Danh sách kết quả Semantic Search */}
        {!loading && !error && results.length > 0 && (
          <div style={{ marginTop: "20px" }}>
            {results.map((result, index) => (
              <div
                key={`${result.document_id}-${result.chunk_index}-${index}`}
                className="panel"
                style={{ marginBottom: "12px", cursor: "pointer" }}
                onClick={() =>
                  navigate(`/documents/${result.document_id}`)
                }
              >
                <h3>{result.document_title}</h3>

                <p>{result.text}</p>

                <span className="muted">
                  Độ liên quan: {(result.score * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
