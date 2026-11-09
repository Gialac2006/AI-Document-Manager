import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, FileText, Search, SearchX } from "lucide-react";
import { searchApi } from "../api/searchApi";
import type { SearchResult } from "../api/searchApi";
import Button from "../components/ui/Button";
import "../search-page.css";

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const [text, setText] = useState(query);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => { setText(query); }, [query]);

  useEffect(() => {
    let active = true;
    setError("");
    setResults([]);
    if (!query.trim()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    async function loadResults() {
      try {
        const data = await searchApi.search(query, 5);
        if (active) setResults(data);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Không thể tìm kiếm tài liệu.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadResults();
    return () => { active = false; };
  }, [query, reload]);

  function handleSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    if (value === query) setReload((value) => value + 1);
    else navigate(`/search?q=${encodeURIComponent(value)}`);
  }

  return (
    <div className="semantic-search-page">
      <p className="semantic-search-description">Tìm tài liệu theo nội dung bạn cần, bằng từ khoá hoặc một câu hỏi.</p>
      <form className="semantic-search-form" onSubmit={handleSearch} role="search">
        <div className="semantic-search-input">
          <Search size={20} aria-hidden="true" />
          <input aria-label="Nội dung cần tìm" value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Nhập câu hỏi hoặc nội dung cần tìm..." />
        </div>
        <Button type="submit" disabled={!text.trim()}>Tìm kiếm</Button>
      </form>

      {loading ? (
        <div className="panel semantic-search-empty" role="status">Đang tìm kiếm tài liệu...</div>
      ) : error ? (
        <div className="panel semantic-search-empty" role="alert">
          <h2>Chưa thể tải kết quả</h2>
          <p>{error}</p>
          <Button type="button" variant="secondary" onClick={() => setReload((value) => value + 1)}>Thử lại</Button>
        </div>
      ) : !query.trim() ? (
        <div className="panel semantic-search-empty">
          <Search size={28} aria-hidden="true" />
          <h2>Bạn muốn tìm nội dung gì?</h2>
          <p>Nhập câu hỏi để tìm các đoạn nội dung liên quan trong tài liệu bạn có quyền truy cập.</p>
        </div>
      ) : results.length === 0 ? (
        <div className="panel semantic-search-empty">
          <SearchX size={28} aria-hidden="true" />
          <h2>Chưa tìm thấy nội dung phù hợp</h2>
          <p>Không có kết quả cho “{query}”. Hãy thử câu hỏi ngắn hơn hoặc từ khoá khác.</p>
        </div>
      ) : (
        <section className="semantic-search-results" aria-label="Kết quả tìm kiếm">
          <p className="semantic-search-count" role="status">{results.length} đoạn nội dung phù hợp với “{query}”</p>
          {results.map((result, index) => (
            <article className="panel semantic-search-result" key={`${result.document_id}-${result.chunk_index}-${index}`}>
              <div className="semantic-search-result-heading">
                <span className="semantic-search-file-icon"><FileText size={22} aria-hidden="true" /></span>
                <h2><Link to={`/documents/${result.document_id}`}>{result.document_title}</Link></h2>
                <span className="semantic-search-version">v{result.document_version}</span>
              </div>
              <p className="semantic-search-excerpt">{result.text}</p>
              <div className="semantic-search-result-footer">
                <span>Độ liên quan: {(result.score * 100).toFixed(1)}%</span>
                <Link to={`/documents/${result.document_id}`}>Mở tài liệu <ArrowRight size={16} aria-hidden="true" /></Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
