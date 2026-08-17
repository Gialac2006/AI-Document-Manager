import { useRef, useState } from "react";
import type { DragEvent, FormEvent } from "react";

import { documentApi } from "../api/documentApi";
import type { Folder } from "../types";
import Button from "./ui/Button.tsx";

interface UploadDocumentProps {
  folderId: number | null;
  folders: Folder[];
  onUploaded: () => void;
}

// Component form tải tài liệu lên hệ thống
export default function UploadDocument({ folderId, folders, onUploaded }: UploadDocumentProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [targetFolder, setTargetFolder] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Gửi file và thông tin lên server
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) {
      setError("Vui lòng chọn file để tải lên");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (title.trim()) formData.append("title", title.trim());
      if (targetFolder) formData.append("folder_id", targetFolder);
      await documentApi.upload(formData);
      setFile(null);
      setTitle("");
      setTargetFolder("");
      if (onUploaded) onUploaded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  // Lấy file khi kéo thả vào vùng tải lên
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) setFile(e.dataTransfer.files[0] ?? null);
  };

  const effectiveFolder = targetFolder || folderId || "";

  return (
    <form className="upload-form" onSubmit={handleSubmit}>
      <h3>⬆️ Tải tài liệu lên</h3>
      <div
        className={`upload-dropzone ${dragging ? "dragging" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <span className="dz-icon">📤</span>
        {file ? (
          <>
            <strong>{file.name}</strong>
          </>
        ) : (
          <>
            Kéo thả file vào đây hoặc <strong>chọn file</strong>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          hidden
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>
      <div className="upload-hint">Kích thước tối đa 100 MB</div>
      <div className="form-group">
        <label>Tiêu đề (tuỳ chọn)</label>
        <input
          type="text"
          value={title}
          placeholder="Mặc định theo tên file"
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label>Thư mục (tuỳ chọn)</label>
        <select value={effectiveFolder} onChange={(e) => setTargetFolder(e.target.value)}>
          <option value="">— Gốc —</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <Button type="submit" variant="primary" disabled={uploading}>
        {uploading ? "Đang tải lên..." : "Tải lên"}
      </Button>
    </form>
  );
}
