import { useId, useRef, useState } from "react";
import type { DragEvent, FormEvent } from "react";

import { FileText, Upload, X } from "lucide-react";
import "../upload-document.css";

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
  const [targetFolder, setTargetFolder] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fieldId = useId();
  const submitting = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Thư mục hiệu lực: ưu tiên lựa chọn trong form ("" = Gốc), nếu chưa chọn thì
  // mới dùng folder đang chọn trong cây
  const effectiveFolder = targetFolder !== null ? targetFolder : (folderId ? String(folderId) : "");

  // Gửi file và thông tin lên server
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting.current) return;
    if (!file) {
      setError("Vui lòng chọn file để tải lên");
      return;
    }
    submitting.current = true;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (title.trim()) formData.append("title", title.trim());
      if (effectiveFolder) formData.append("folder_id", effectiveFolder);
      await documentApi.upload(formData);
      setFile(null);
      setTitle("");
      setTargetFolder(null);
      if (inputRef.current) inputRef.current.value = "";
      if (onUploaded) onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải tài liệu. Vui lòng thử lại.");
    } finally {
      submitting.current = false;
      setUploading(false);
    }
  };

  // Lấy file khi kéo thả vào vùng tải lên
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (submitting.current) return;
    if (e.dataTransfer.files?.length) {
      setFile(e.dataTransfer.files[0] ?? null);
      setError("");
    }
  };

  return (
    <form className="upload-form upload-document" onSubmit={handleSubmit} aria-busy={uploading}>
      <h3>Tải tài liệu lên</h3>
      <div
        className={`upload-document-dropzone ${dragging ? "is-dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading) setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={handleDrop}
      >
        {file ? <FileText size={28} aria-hidden="true" /> : <Upload size={28} aria-hidden="true" />}
        <strong>{file ? file.name : "Kéo thả tài liệu vào đây"}</strong>
        <span className="upload-document-hint">
          {file
            ? `${file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}`
            : "Chọn một tệp từ máy tính · Tối đa 100 MB"}
        </span>
        <div className="upload-document-file-actions">
          <Button type="button" variant="secondary" disabled={uploading} onClick={() => inputRef.current?.click()}>
            {file ? "Chọn tệp khác" : "Chọn tệp"}
          </Button>
          {file && (
            <Button type="button" variant="text" disabled={uploading} onClick={() => {
              setFile(null);
              setError("");
              if (inputRef.current) inputRef.current.value = "";
            }}>
              <X size={16} aria-hidden="true" /> Bỏ chọn
            </Button>
          )}
        </div>
        <input ref={inputRef} type="file" hidden disabled={uploading} onChange={(e) => {
          const selected = e.target.files?.[0];
          if (selected) { setFile(selected); setError(""); }
        }} />
      </div>
      <div className="upload-document-fields">
        <div className="form-group">
          <label htmlFor={`${fieldId}-title`}>Tiêu đề (tuỳ chọn)</label>
          <input id={`${fieldId}-title`} type="text" value={title} disabled={uploading}
            placeholder="Mặc định theo tên tệp" onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor={`${fieldId}-folder`}>Thư mục lưu</label>
          <select id={`${fieldId}-folder`} value={effectiveFolder} disabled={uploading}
            onChange={(e) => setTargetFolder(e.target.value)}>
            <option value="">Thư mục gốc</option>
            {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      </div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="upload-document-footer">
        {uploading && <span role="status">Đang tải tài liệu, vui lòng chờ...</span>}
        <Button type="submit" variant="primary" disabled={uploading || !file}>
          <Upload size={17} aria-hidden="true" />
          {uploading ? "Đang tải lên..." : "Tải tài liệu lên"}
        </Button>
      </div>
    </form>
  );
}
