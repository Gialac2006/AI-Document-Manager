import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const [text, setText] = useState(query);

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    navigate(`/search?q=${encodeURIComponent(text.trim())}`);
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

        <div className="empty-state search-empty">
          <span className="empty-icon">🧠</span>
          {query ? (
            <>
              Chưa có kết quả cho "<strong>{query}</strong>".
            </>
          ) : (
            <>Nhập câu hỏi ở trên để tìm kiếm ngữ nghĩa theo nội dung tài liệu.</>
          )}
          <br />
          <span className="muted" style={{ fontSize: "12.5px" }}>
            Tính năng tìm kiếm ngữ nghĩa sẽ hoàn thiện ở Giai đoạn 4 (RAG).
          </span>
        </div>
      </section>
    </div>
  );
}