export interface FileTypeMeta {
  icon: string;
  cls: string;
}

export interface StatusMeta {
  label: string;
  cls: string;
}

const FILE_META: Record<string, FileTypeMeta> = {
  pdf: { icon: "📕", cls: "pdf" },
  doc: { icon: "📘", cls: "doc" },
  docx: { icon: "📘", cls: "doc" },
  xls: { icon: "📊", cls: "xls" },
  xlsx: { icon: "📊", cls: "xls" },
  csv: { icon: "📊", cls: "xls" },
  ppt: { icon: "📽️", cls: "doc" },
  pptx: { icon: "📽️", cls: "doc" },
  txt: { icon: "📝", cls: "text" },
  md: { icon: "📝", cls: "text" },
  png: { icon: "🖼️", cls: "img" },
  jpg: { icon: "🖼️", cls: "img" },
  jpeg: { icon: "🖼️", cls: "img" },
  gif: { icon: "🖼️", cls: "img" },
  webp: { icon: "🖼️", cls: "img" },
};

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp"]);

const PREVIEWABLE_EXTENSIONS = new Set(["pdf", "txt", "md", "docx", ...IMAGE_EXTENSIONS]);

export function isDocxFile(fileName: string, fileType: string | null): boolean {
  return normalizeExt(fileName, fileType) === "docx";
}

function normalizeExt(fileName: string, fileType: string | null): string {
  return (fileType || fileName.split(".").pop() || "").toLowerCase().replace(/^\./, "");
}

export function fileTypeInfo(
  fileName: string,
  fileType: string | null
): FileTypeMeta {
  const ext = normalizeExt(fileName, fileType);
  const meta = FILE_META[ext];
  if (meta) return meta;
  if (IMAGE_EXTENSIONS.has(ext)) return { icon: "🖼️", cls: "img" };
  return { icon: "📄", cls: "generic" };
}

export function isPreviewable(fileName: string, fileType: string | null): boolean {
  const ext = normalizeExt(fileName, fileType);
  return PREVIEWABLE_EXTENSIONS.has(ext);
}

export function isImageFile(fileName: string, fileType: string | null): boolean {
  const ext = normalizeExt(fileName, fileType);
  return IMAGE_EXTENSIONS.has(ext) || ["img"].includes(ext);
}

export function statusInfo(status: string): StatusMeta {
  const s = (status || "").toLowerCase();
  if (s === "completed" || s === "indexed") {
    return { label: "Đã index", cls: "indexed" };
  }
  if (s === "processing") {
    return { label: "Đang xử lý AI", cls: "processing" };
  }
  return { label: "Chờ OCR", cls: "neutral" };
}