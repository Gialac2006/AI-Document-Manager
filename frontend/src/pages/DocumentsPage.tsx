import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  FileText,
  Search,
  Upload,
  X,
} from "lucide-react";

import { notificationApi } from "../api/notificationApi";
import { documentApi } from "../api/documentApi";
import { folderApi } from "../api/folderApi";
import DocumentCard from "../components/DocumentCard.tsx";
import FolderTree from "../components/FolderTree.tsx";
import UploadDocument from "../components/UploadDocument.tsx";
import Button from "../components/ui/Button.tsx";
import Spinner from "../components/ui/Spinner.tsx";
import type { Document, Folder } from "../types";

import "../documents.css";

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
    const [pendingChanges, setPendingChanges] =
    useState<Record<number, number>>({});
  const [changesError, setChangesError] = useState("");

  useEffect(() => {
    let active = true;
    let fetching = false;

    async function loadChanges() {
      if (fetching) return;
      fetching = true;

      try {
        const data = await notificationApi.documentChanges();
        if (!active) return;

        setPendingChanges(
          Object.fromEntries(
            data.map((item) => [item.document_id, item.pending_count]),
          ),
        );
        setChangesError("");
      } catch (err) {
        if (active) {
          setChangesError(
            err instanceof Error
              ? err.message
              : "Không thể kiểm tra thay đổi tài liệu.",
          );
        }
      } finally {
        fetching = false;
      }
    }

    void loadChanges();

    const onFocus = () => void loadChanges();
    window.addEventListener("focus", onFocus);

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadChanges();
      }
    }, 10000);

    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, []);

  const requestId = useRef(0);
  const inFlight = useRef(false);

  const loadData = useCallback(
    async (folderId: number | null, targetPage = 1, background = false) => {
      if (background && inFlight.current) return;
      const id = ++requestId.current;
      inFlight.current = true;
      try {
        const [folderList, results] = await Promise.all([
          folderApi.list(),
          Promise.all(Array.from({ length: targetPage }, (_, index) =>
            documentApi.list(folderId, index + 1, PAGE_SIZE))),
        ]);
        if (id !== requestId.current) return;
        setFolders(folderList);
        setDocuments([...new Map(results.flatMap(result => result.items).map(doc => [doc.id, doc])).values()]);
        setTotal(results[0].total);
        setPage(targetPage);
        setError("");
      } catch (err) {
        if (id === requestId.current) setError((err as Error).message);
      } finally {
        if (id === requestId.current) {
          inFlight.current = false;
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [],
  );

  const loadMore = useCallback(() => {
    if (page * PAGE_SIZE < total && !loadingMore && !inFlight.current) {
      setLoadingMore(true);
      loadData(selectedFolder, page + 1);
    }
  }, [page, total, selectedFolder, loadingMore, loadData]);

  // Tự làm mới danh sách khi quay lại tab/đổi folder và mỗi 10 giây
  useEffect(() => {
    setLoading(true);
    setPage(1);
    void loadData(selectedFolder);
    return () => { requestId.current += 1; inFlight.current = false; };
  }, [selectedFolder, loadData]);

  useEffect(() => {
    const onFocus = () => loadData(selectedFolder, page, true);
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") loadData(selectedFolder, page, true);
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
      await loadData(selectedFolder, page);
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
    <div className="documents-page">

      {error && <div className="alert alert-error">{error}</div>}
            {changesError && (
        <p role="alert" style={{ color: "#92400e" }}>
          Chưa cập nhật được dấu báo thay đổi: {changesError}
        </p>
      )}

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
          <div className="documents-heading">
            <div><h2>{folderName}</h2><p className="muted">{total} tài liệu</p></div>
            <Button type="button" onClick={() => setShowUpload(value => !value)}>
              {showUpload ? <X size={17} /> : <Upload size={17} />}
              {showUpload ? "Đóng tải lên" : "Tải tài liệu lên"}
            </Button>
          </div>
          <div className="documents-toolbar">
            <label className="toolbar-search">
              <Search size={18} aria-hidden="true" />
              <input aria-label="Tìm theo tên tài liệu" placeholder="Tìm theo tên tài liệu..."
                value={search} onChange={event => setSearch(event.target.value)} />
            </label>
            <select className="toolbar-select" aria-label="Lọc phân loại" value={categoryFilter}
              onChange={event => setCategoryFilter(event.target.value)}>
              <option value="">Tất cả phân loại</option>
              {categoryOptions.map(category => <option key={category} value={category}>{category}</option>)}
            </select>
          </div>
          {(search || categoryFilter) && <p className="muted documents-filter-note">
            {filteredDocuments.length} kết quả trong {documents.length} tài liệu đã tải.
            <button type="button" className="text-button" onClick={() => { setSearch(""); setCategoryFilter(""); }}>Xóa bộ lọc</button>
          </p>}

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
              {search || categoryFilter ? (
                <>Không có kết quả phù hợp trong các tài liệu đã tải.</>
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
                    pendingChanges={pendingChanges[doc.id] ?? 0}
                  />
                ))}
              </div>
            </>
          )}
          <div className="documents-footer">
            <span className="muted">Đã tải {documents.length} / {total} tài liệu</span>
            {documents.length < total && <Button variant="secondary" disabled={loadingMore} onClick={loadMore}>
              {loadingMore ? "Đang tải..." : "Xem thêm tài liệu"}
            </Button>}
          </div>
        </section>
      </div>
    </div>
  );
}
