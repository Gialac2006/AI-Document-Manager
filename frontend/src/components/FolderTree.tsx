import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import { documentApi } from "../api/documentApi";
import { folderApi } from "../api/folderApi";
import { useAuth } from "../hooks/useAuth";
import type { Document, Folder } from "../types";
import Button from "./ui/Button.tsx";

interface FolderNode {
  id: number;
  name: string;
  parent_id: number | null;
  children: FolderNode[];
}

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

function fileIcon(fileType: string | null): string {
  if (fileType === ".pdf") return "📕";
  if (fileType === ".txt" || fileType === ".md") return "📝";
  if (fileType === ".doc" || fileType === ".docx") return "📘";
  if (fileType === ".xls" || fileType === ".xlsx" || fileType === ".csv") return "📊";
  if (fileType === ".png" || fileType === ".jpg" || fileType === ".jpeg") return "🖼️";
  return "📄";
}

interface FolderNodeProps {
  folder: FolderNode;
  depth: number;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
  canWrite: boolean;
  pinnedId: number | null;
  onToggleFiles: (id: number) => void;
}

function FolderNode({
  folder,
  depth,
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
        <span className="folder-tree-icon">📁</span>
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
              📄
            </button>
            {canWrite && (
              <span className="folder-tree-row-actions">
                <Button
                  variant="text"
                  onClick={() => setEditing(true)}
                  title="Đổi tên"
                >
                  ✏️
                </Button>
                <Button
                  variant="text"
                  onClick={() => onDelete(folder.id)}
                  title="Xoá"
                >
                  🗑️
                </Button>
              </span>
            )}
          </span>
        )}
      </div>
      {folder.children.map((child) => (
        <FolderNode
          key={child.id}
          folder={child}
          depth={depth + 1}
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

export default function FolderTree({ folders, selectedId, onSelect, onChanged }: FolderTreeProps) {
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [pinnedId, setPinnedId] = useState<number | null>(null);
  const [pinnedDocs, setPinnedDocs] = useState<Document[] | null>(null);
  const [pinnedLoading, setPinnedLoading] = useState(false);
  const [pinnedError, setPinnedError] = useState("");

  const canWrite = user?.role === "manager" || user?.role === "individual" || user?.role === "super_admin";

  const openCreate = () => {
    setNewName("");
    setError("");
    setCreating(true);
  };

  const closeCreate = () => {
    setCreating(false);
    setNewName("");
    setError("");
  };

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    try {
      await folderApi.create({ name, parent_id: selectedId || null });
      setNewName("");
      setError("");
      setCreating(false);
      if (onChanged) onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleRename = async (id: number, name: string) => {
    try {
      await folderApi.rename(id, name);
      setError("");
      if (onChanged) onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Xoá thư mục này và toàn bộ thư mục con?")) return;
    try {
      await folderApi.delete(id);
      if (pinnedId === id) closeFiles();
      setError("");
      if (onChanged) onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const closeFiles = () => {
    setPinnedId(null);
    setPinnedDocs(null);
    setPinnedError("");
  };

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
      setPinnedDocs(docs);
    } catch (err) {
      setPinnedError((err as Error).message);
    } finally {
      setPinnedLoading(false);
    }
  };

  const tree = buildTree(folders);
  const pinnedFolder = pinnedId ? folders.find((f) => f.id === pinnedId) : null;

  return (
    <div className="folder-tree">
      <div className="folder-tree-header">
        <h3>Thư mục</h3>
        {canWrite && !creating && (
          <button type="button" className="folder-add-button" onClick={openCreate} title="Tạo thư mục">
            ＋
          </button>
        )}
      </div>
      <div
        className={`folder-tree-row ${selectedId == null ? "active" : ""}`}
        onClick={() => onSelect(null)}
      >
        <span className="folder-tree-icon">🗂️</span>
        <span className="folder-tree-name">Tất cả tài liệu</span>
      </div>
      {tree.map((folder) => (
        <FolderNode
          key={folder.id}
          folder={folder}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
          onRename={handleRename}
          onDelete={handleDelete}
          canWrite={canWrite}
          pinnedId={pinnedId}
          onToggleFiles={handleToggleFiles}
        />
      ))}
      {canWrite && creating && (
        <form className="folder-tree-create" onSubmit={handleCreate}>
          <input
            autoFocus
            value={newName}
            placeholder="Nhập tên thư mục"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") closeCreate();
            }}
          />
          <div className="folder-create-actions">
            <button type="submit" className="secondary-button btn-sm">
              Tạo
            </button>
            <button type="button" className="text-button" onClick={closeCreate}>
              Huỷ
            </button>
          </div>
        </form>
      )}
      {selectedId && canWrite && !creating && (
        <div className="folder-parent-hint">
          Thư mục mới sẽ tạo bên trong: <strong>{folders.find((f) => f.id === selectedId)?.name}</strong>
        </div>
      )}

      {pinnedFolder && (
        <div className="folder-files-panel">
          <div className="folder-files-header">
            <span className="folder-files-title">
              📁 {pinnedFolder.name}
              {pinnedDocs && (
                <span className="folder-files-count">{pinnedDocs.length} file</span>
              )}
            </span>
            <button type="button" className="icon-button" onClick={closeFiles} title="Đóng">
              ✕
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
                  <span className="popover-file-icon">{fileIcon(doc.file_type)}</span>
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

      {error && <div className="alert alert-error">{error}</div>}
    </div>
  );
}
