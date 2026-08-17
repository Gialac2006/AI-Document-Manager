import { useCallback, useEffect, useMemo, useState } from "react";

import { documentApi } from "../api/documentApi";
import { folderApi } from "../api/folderApi";
import DocumentCard from "../components/DocumentCard.tsx";
import FolderTree from "../components/FolderTree.tsx";
import UploadDocument from "../components/UploadDocument.tsx";
import Spinner from "../components/ui/Spinner.tsx";
import type { Document, Folder } from "../types";

// Trang quản lý tài liệu: duyệt thư mục, tải lên, tìm kiếm và xoá tài liệu
export default function DocumentsPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async (folderId: number | null) => {
    try {
      const [folderList, docList] = await Promise.all([
        folderApi.list(),
        documentApi.list(folderId),
      ]);
      setFolders(folderList);
      setDocuments(docList);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Tự làm mới danh sách khi quay lại tab/đổi folder và mỗi 10 giây
  useEffect(() => {
    loadData(selectedFolder);
  }, [selectedFolder, loadData]);

  useEffect(() => {
    const onFocus = () => loadData(selectedFolder);
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") loadData(selectedFolder);
    }, 10000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [selectedFolder, loadData]);

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
    if (!query) return documents;
    return documents.filter((doc) => {
      return (
        doc.title.toLowerCase().includes(query) ||
        (doc.file_name || "").toLowerCase().includes(query)
      );
    });
  }, [documents, search]);

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
            <span className="muted">{filteredDocuments.length} tài liệu</span>
            <div className="toolbar-spacer"></div>
            <div className="toolbar-search">
              <span>🔍</span>
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
              {showUpload ? "✕ Đóng" : "⬆️ Tải lên"}
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
              <span className="empty-icon">🗂️</span>
              {search ? (
                <>Không tìm thấy tài liệu phù hợp với "{search}".</>
              ) : (
                <>Chưa có tài liệu nào trong thư mục này.</>
              )}
            </div>
          ) : (
            <div className="document-grid">
              {filteredDocuments.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
