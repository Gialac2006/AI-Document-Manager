import { useEffect, useState } from "react";

import { documentApi } from "../api/documentApi";
import { isDocxFile, isImageFile } from "../utils/documentMeta";
import Spinner from "./ui/Spinner.tsx";

interface DocumentPreviewProps {
  documentId: number;
  fileName: string;
  fileType: string | null;
  version?: number;
}

// Component xem trước nội dung tài liệu (ảnh, docx, pdf...)
export default function DocumentPreview({
  documentId,
  fileName,
  fileType,
  version,
}: DocumentPreviewProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [error, setError] = useState("");

  const isDocx = isDocxFile(fileName, fileType);
  // PDF dùng trình xem gốc của trình duyệt (không chạy script), không cần sandbox
  const isPdf =
    (fileType || fileName.split(".").pop() || "").toLowerCase().replace(/^\./, "") === "pdf";

  // Tải file xem trước theo documentId/version, chuyển DOCX sang HTML
  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setError("");
    setObjectUrl(null);
    setDocxHtml(null);

    documentApi
      .preview(documentId, version)
      .then(async (created) => {
        if (cancelled) {
          URL.revokeObjectURL(created);
          return;
        }
        if (isDocx) {
          try {
            const mammoth = await import("mammoth");
            const resp = await fetch(created);
            const buffer = await resp.arrayBuffer();
            const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
            const style = `body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#1f2937;padding:32px;max-width:820px;margin:0 auto;word-wrap:break-word;}
              p{margin:0 0 12px} h1,h2,h3,h4{line-height:1.35} table{border-collapse:collapse;width:100%}
              td,th{border:1px solid #d1d5db;padding:6px 10px} img{max-width:100%}`;
            if (!cancelled) {
              setDocxHtml(`<style>${style}</style>${result.value}`);
            }
          } catch {
            if (!cancelled) setError("Không thể đọc nội dung DOCX");
          } finally {
            URL.revokeObjectURL(created);
          }
          return;
        }
        url = created;
        setObjectUrl(created);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      });

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [documentId, isDocx, version]);

  if (error) {
    return (
      <div className="empty-state">
        <span className="empty-icon">⚠️</span>
        Không thể hiển thị file: {error}
      </div>
    );
  }

  if (isDocx) {
    if (!docxHtml) {
      return (
        <div className="preview-loading">
          <Spinner />
        </div>
      );
    }
    return (
      <iframe
        title={fileName}
        className="preview-frame"
        sandbox=""
        srcDoc={`<!doctype html><html><head><meta charset="utf-8"></head><body>${docxHtml}</body></html>`}
      />
    );
  }

  if (!objectUrl) {
    return (
      <div className="preview-loading">
        <Spinner />
      </div>
    );
  }

  if (isImageFile(fileName, fileType)) {
    return (
      <div className="preview-image-wrap">
        <img src={objectUrl} alt={fileName} className="preview-image" />
      </div>
    );
  }

  return (
    <iframe
      src={objectUrl}
      title={fileName}
      className="preview-frame"
      sandbox={isPdf ? undefined : ""}
      referrerPolicy="no-referrer"
    />
  );
}