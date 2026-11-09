import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import { documentApi } from "../api/documentApi";
import { folderApi } from "../api/folderApi";
import { useAuth } from "../hooks/useAuth";
import type { Document, Folder } from "../types";
import { Folder as FolderIcon, FolderOpen, Files, FileText, Pencil, Trash2, Plus, X } from "lucide-react";
import Button from "./ui/Button.tsx";
import "../folder-actions.css";

interface FolderNode {
  id: number;
  name: string;
  parent_id: number | null;
  children: FolderNode[];
}

// Xây dựng cây thư mục từ danh sách phẳng
function buildTree(folders: Folder[]): FolderNode[] {
  const nodes = new Map<number, FolderNode>(
    folders.map((f) => [f.id, { ...f, children: [] }])
  );
  const roots: FolderNode[] = [];
  for (const node of nodes.values()) {
    if (node.parent_id && nodes.has(node.parent_id)) {
      nodes.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

interface FolderNodeProps {
  folder: FolderNode;
  depth: number;
  expandedIds: Set<number>;
  onToggleExpand: (id: number) => void;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
  canWrite: boolean;
  pinnedId: number | null;
  onToggleFiles: (id: number) => void;
}

// Component đệ quy hiển thị 1 thư mục (kèm thư mục con)
function FolderNode({
  folder,
  depth,
  expandedIds,
  onToggleExpand,
  selectedId,
  onSelect,
  onRename,
  onDelete,
  canWrite,
  pinnedId,
  onToggleFiles,
}: FolderNodeProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const hasChildren = folder.children.length > 0;
  const expanded = expandedIds.has(folder.id);

  // Lưu tên thư mục đã sửa
  const handleRename = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === folder.name) {
      setEditing(false);
      setName(folder.name);
      return;
    }
    await onRename(folder.id, trimmed);
    setEditing(false);
  };

  return (
    <div>
      <div
        className={`folder-tree-row ${folder.id === selectedId ? "active" : ""} ${folder.id === pinnedId ? "pinned" : ""}`}
        style={{ paddingLeft: `${depth * 18 + 10}px` }}
        onClick={() => onSelect(folder.id)}
      >
        <span
          className={`folder-tree-caret${hasChildren ? "" : " placeholder"}`}
          role="button"
          aria-expanded={expanded}
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggleExpand(folder.id);
          }}
        >
          {hasChildren ? (expanded ? "▾" : "▸") : ""}
        </span>
        <span className="folder-tree-icon">{expanded ? <FolderOpen size={17} /> : <FolderIcon size={17} />}</span>
        {editing ? (
          <input
            className="folder-tree-edit"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") setEditing(false);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="folder-tree-name">{folder.name}</span>
        )}
        {!editing && (
          <span className="folder-tree-actions" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={`icon-button ${folder.id === pinnedId ? "active" : ""}`}
              title={folder.id === pinnedId ? "Đóng danh sách file" : "Xem file trong thư mục"}
              onClick={() => onToggleFiles(folder.id)}
            >
              <FileText size={16} />
            </button>
            {canWrite && (
              <span className="folder-tree-row-actions">
                <Button
                  variant="text"
                  onClick={() => setEditing(true)}
                  title="Đổi tên"
                >
                  <Pencil size={16} />
                </Button>
                <Button
                  variant="text"
                  onClick={() => onDelete(folder.id)}
                  title="Xoá"
                >
                  <Trash2 size={16} />
                </Button>
              </span>
            )}
          </span>
        )}
      </div>
      {expanded &&
        folder.children.map((child) => (
          <FolderNode
            key={child.id}
            folder={child}
            depth={depth + 1}
            expandedIds={expandedIds}
            onToggleExpand={onToggleExpand}
            selectedId={selectedId}
            onSelect={onSelect}
            onRename={onRename}
            onDelete={onDelete}
            canWrite={canWrite}
            pinnedId={pinnedId}
            onToggleFiles={onToggleFiles}
          />
        ))}
    </div>
  );
}

interface FolderTreeProps {
  folders: Folder[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onChanged: () => void;
}

// Component cây thư mục với các thao tác tạo, đổi tên, xoá, xem file
export default function FolderTree({ folders, selectedId, onSelect, onChanged }: FolderTreeProps) {
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const [createParent, setCreateParent] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const actionLock = useRef(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [pinnedId, setPinnedId] = useState<number | null>(null);
  const [pinnedDocs, setPinnedDocs] = useState<Document[] | null>(null);
  const [pinnedLoading, setPinnedLoading] = useState(false);
  const [pinnedError, setPinnedError] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const canWrite = user?.role === "manager" || user?.role === "individual" || user?.role === "super_admin";

  const openCreate = () => {
    if (actionLock.current) return;
    setDeleteId(null);
    setCreateParent(selectedId);
    setNewName("");
    setError("");
    setCreating(true);
  };

  const closeCreate = () => {
    if (actionLock.current) return;
    setCreating(false);
    setNewName("");
    setError("");
  };

  // Tạo thư mục mới trong thư mục đang chọn
  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    try {
      await folderApi.create({ name, parent_id: createParent });
      if (createParent != null) expandPath(createParent);
      setNewName("");
      setError("");
      setCreating(false);
      if (onChanged) onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally { actionLock.current = false; setBusy(false); }
  };

  // Đổi tên thư mục
  const handleRename = async (id: number, name: string) => {
    try {
      await folderApi.rename(id, name);
      setError("");
      if (onChanged) onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Xoá thư mục sau khi xác nhận
  const requestDelete = (id: number) => {
    if (actionLock.current) return;
    setCreating(false);
    setError("");
    setDeleteId(id);
  };

  const handleDelete = async () => {
    if (deleteId === null || actionLock.current) return;
    const id = deleteId;
    actionLock.current = true;
    setBusy(true);
    setError("");
    try {
      await folderApi.delete(id);
      closeFiles();
      onSelect(null);
      setDeleteId(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xóa thư mục.");
    } finally { actionLock.current = false; setBusy(false); }
  };

  const closeFiles = () => {
    setPinnedId(null);
    setPinnedDocs(null);
    setPinnedError("");
  };

  // Bật/tắt bảng danh sách file của thư mục được ghim
  const handleToggleFiles = async (id: number) => {
    if (pinnedId === id) {
      closeFiles();
      return;
    }
    setPinnedId(id);
    setPinnedDocs(null);
    setPinnedError("");
    setPinnedLoading(true);
    try {
      const docs = await documentApi.list(id);
      setPinnedDocs(docs.items);
    } catch (err) {
      setPinnedError((err as Error).message);
    } finally {
      setPinnedLoading(false);
    }
  };

  const tree = buildTree(folders);
  const pinnedFolder = pinnedId ? folders.find((f) => f.id === pinnedId) : null;

  // Mở rộng toàn bộ đường dẫn tới thư mục đã cho
  const expandPath = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      let current: Folder | undefined = folders.find((f) => f.id === id);
      while (current && !next.has(current.id)) {
        next.add(current.id);
        const parentId = current.parent_id;
        current = parentId != null
          ? folders.find((f) => f.id === parentId)
          : undefined;
      }
      return next;
    });
  };

  const toggleExpanded = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  useEffect(() => {
    if (selectedId != null) expandPath(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, folders]);

  return (
    <div className="folder-tree">
      <div className="folder-tree-header">
        <h3>Thư mục</h3>
        {canWrite && !creating && (
          <button type="button" className="folder-add-button" onClick={openCreate} title="Tạo thư mục">
            <Plus size={18} />
          </button>
        )}
      </div>
      <div
        className={`folder-tree-row ${selectedId == null ? "active" : ""}`}
        onClick={() => onSelect(null)}
      >
        <span className="folder-tree-caret placeholder" role="button"></span>
        <span className="folder-tree-icon"><Files size={17} /></span>
        <span className="folder-tree-name">Tất cả tài liệu</span>
      </div>
      {tree.map((folder) => (
        <FolderNode
          key={folder.id}
          folder={folder}
          depth={0}
          expandedIds={expandedIds}
          onToggleExpand={toggleExpanded}
          selectedId={selectedId}
          onSelect={(id) => {
            onSelect(id);
          }}
          onRename={handleRename}
          onDelete={requestDelete}
          canWrite={canWrite}
          pinnedId={pinnedId}
          onToggleFiles={handleToggleFiles}
        />
      ))}
      {canWrite && creating && (
        <form className="folder-tree-create folder-action-box" onSubmit={handleCreate} aria-busy={busy}>
          <h4>Tạo thư mục</h4>
          <p className="folder-action-location">Vị trí: <strong>{createParent === null ? "Thư mục gốc" : folders.find((folder) => folder.id === createParent)?.name}</strong></p>
          <label htmlFor="new-folder-name">Tên thư mục</label>
          <input
            id="new-folder-name"
            required
            disabled={busy}
            autoFocus
            value={newName}
            placeholder="Nhập tên thư mục"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") closeCreate();
            }}
          />
          <div className="folder-create-actions">
            <button type="submit" className="primary-button btn-sm" disabled={busy || !newName.trim()}>
              {busy ? "Đang tạo..." : "Tạo thư mục"}
            </button>
            <button type="button" className="secondary-button" disabled={busy} onClick={closeCreate}>
              Huỷ
            </button>
          </div>
        </form>
      )}
      {deleteId !== null && (
        <section className="folder-action-box folder-delete-box" aria-label="Xác nhận xóa thư mục" aria-busy={busy}>
          <h4><Trash2 size={17} aria-hidden="true" /> Xóa thư mục?</h4>
          <p>Bạn sắp xóa thư mục <strong>{folders.find((folder) => folder.id === deleteId)?.name}</strong> và toàn bộ thư mục con.</p>
          <div className="folder-create-actions">
            <Button type="button" variant="secondary" disabled={busy} onClick={() => { setDeleteId(null); setError(""); }}>Hủy</Button>
            <Button type="button" variant="danger" disabled={busy} onClick={() => void handleDelete()}>{busy ? "Đang xóa..." : "Xóa thư mục"}</Button>
          </div>
        </section>
      )}
      {selectedId && canWrite && !creating && deleteId === null && (
        <div className="folder-parent-hint">
          Thư mục mới sẽ tạo bên trong: <strong>{folders.find((f) => f.id === selectedId)?.name}</strong>
        </div>
      )}

      {pinnedFolder && (
        <div className="folder-files-panel">
          <div className="folder-files-header">
            <span className="folder-files-title">
              <FolderIcon size={16} /> {pinnedFolder.name}
              {pinnedDocs && (
                <span className="folder-files-count">{pinnedDocs.length} file</span>
              )}
            </span>
            <button type="button" className="icon-button" onClick={closeFiles} title="Đóng">
              <X size={16} />
            </button>
          </div>
          {pinnedLoading ? (
            <div className="popover-note">Đang tải tài liệu...</div>
          ) : pinnedError ? (
            <div className="popover-note">{pinnedError}</div>
          ) : !pinnedDocs || pinnedDocs.length === 0 ? (
            <div className="popover-note">Chưa có tài liệu trong thư mục này</div>
          ) : (
            <ul className="popover-list">
              {pinnedDocs.map((doc) => (
                <li key={doc.id}>
                  <span className="popover-file-icon"><FileText size={16} /></span>
                  <Link to={`/documents/${doc.id}`} className="popover-file-name" title={doc.file_name}>
                    {doc.title}
                  </Link>
                  <span className="badge">v{doc.current_version}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && <div className="alert alert-error" role="alert">{error}</div>}
    </div>
  );
}

