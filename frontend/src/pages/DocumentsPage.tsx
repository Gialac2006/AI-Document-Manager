import { useCallback, useEffect, useMemo, useState } from "react";

import {
  FileText,
  Search,
  Upload,
  X,
} from "lucide-react";

import { documentApi } from "../api/documentApi";
import { folderApi } from "../api/folderApi";
import DocumentCard from "../components/DocumentCard.tsx";
import FolderTree from "../components/FolderTree.tsx";
import UploadDocument from "../components/UploadDocument.tsx";
import Button from "../components/ui/Button.tsx";
import Spinner from "../components/ui/Spinner.tsx";
import type { Document, Folder } from "../types";

const PAGE_SIZE = 20;

// Trang quản lý tài liệu: duyệt thư mục, tải lên, tìm kiếm và xoá tài liệu
export default function DocumentsPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState("");

  const loadData = useCallback(
    async (folderId: number | null, targetPage = 1, append = false) => {
      try {
        const [folderList, docResult] = await Promise.all([
          folderApi.list(),
          documentApi.list(folderId, targetPage, PAGE_SIZE),
        ]);
        setFolders(folderList);
        setDocuments((prev) => (append ? [...prev, ...docResult.items] : docResult.items));
        setTotal(docResult.total);
        setPage(targetPage);
        setError("");
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  const loadMore = useCallback(() => {
    if (page * PAGE_SIZE < total && !loadingMore) {
      setLoadingMore(true);
      loadData(selectedFolder, page + 1, true);
    }
  }, [page, total, selectedFolder, loadingMore, loadData]);

  // Tự làm mới danh sách khi quay lại tab/đổi folder và mỗi 10 giây
  useEffect(() => {
    loadData(selectedFolder);
  }, [selectedFolder, loadData]);

  useEffect(() => {
    const onFocus = () => loadData(selectedFolder, page);
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") loadData(selectedFolder, page);
    }, 10000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [selectedFolder, loadData, page]);

  // Xoá tài liệu sau khi xác nhận và cập nhật lại danh sách
  const handleDelete = async (id: number) => {
    if (!window.confirm("Xoá tài liệu này?")) return;
    try {
      await documentApi.delete(id);
      setDocuments((docs) => docs.filter((d) => d.id !== id));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Làm mới danh sách thư mục sau khi có thay đổi (thêm/xoá thư mục)
  const handleFolderChanged = async () => {
    try {
      const folderList = await folderApi.list();
      setFolders(folderList);
      if (selectedFolder && !folderList.some((f) => f.id === selectedFolder)) {
        setSelectedFolder(null);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return documents.filter((doc) => {
      const matchesSearch =
        !query ||
        doc.title.toLowerCase().includes(query) ||
        (doc.file_name || "").toLowerCase().includes(query);
      const matchesCategory =
        !categoryFilter || (doc.category || "") === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [documents, search, categoryFilter]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    documents.forEach((doc) => {
      if (doc.category) set.add(doc.category);
    });
    return [...set].sort();
  }, [documents]);

  const folderName = selectedFolder
    ? folders.find((f) => f.id === selectedFolder)?.name || ""
    : "Tất cả tài liệu";

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Quản lý tài liệu</h1>
          <p className="page-header-desc">
            Tạo thư mục, tải tài liệu lên và quản lý theo từng thư mục.
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="documents-layout">
        <aside className="documents-sidebar">
          <FolderTree
            folders={folders}
            selectedId={selectedFolder}
            onSelect={setSelectedFolder}
            onChanged={handleFolderChanged}
          />
        </aside>

        <section className="documents-main">
          <div className="documents-toolbar">
            <span className="badge">{folderName}</span>
            <span className="muted">{search || categoryFilter ? filteredDocuments.length : total} tài liệu</span>
            <div className="toolbar-spacer"></div>
            {categoryOptions.length > 0 && (
              <select
                className="toolbar-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">🏷️ Tất cả loại</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
            <div className="toolbar-search">
            <Search size={16} strokeWidth={1.8} />

            <input
                placeholder="Tìm theo tên tài liệu..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setShowUpload((s) => !s)}
            >
              {showUpload ? (
                <>
                  <X size={16} strokeWidth={1.8} />
                  <span>Đóng</span>
                </>
              ) : (
                <>
                  <Upload size={16} strokeWidth={1.8} />
                  <span>Tải lên</span>
                </>
              )}
            </button>
          </div>

          {showUpload && (
            <UploadDocument
              folderId={selectedFolder}
              folders={folders}
              onUploaded={() => {
                loadData(selectedFolder);
                setShowUpload(false);
              }}
            />
          )}

          {filteredDocuments.length === 0 ? (
            <div className="empty-state">
              <FileText
                className="empty-state-icon"
                size={24}
                strokeWidth={1.6}
              />
              {search ? (
                <>Không tìm thấy tài liệu phù hợp với "{search}".</>
              ) : (
                <>Chưa có tài liệu nào trong thư mục này.</>
              )}
            </div>
          ) : (
            <>
              <div className="document-grid">
                {filteredDocuments.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
              {documents.length < total && (
                <div className="load-more-wrap">
                  <Button variant="secondary" disabled={loadingMore} onClick={loadMore}>
                    {loadingMore ? "Đang tải..." : "Xem thêm tài liệu"}
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
