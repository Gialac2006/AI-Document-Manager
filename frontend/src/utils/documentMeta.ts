// Thông tin hiển thị của một loại file (icon + class CSS)
export interface FileTypeMeta {
  icon: string;
  cls: string;
}

// Thông tin hiển thị của trạng thái tài liệu (nhãn + class CSS)
export interface StatusMeta {
  label: string;
  cls: string;
}

// Bảng ánh xạ icon và class theo đuôi file
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

// Tập hợp các đuôi file ảnh
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp"]);

// Tập hợp các đuôi file có thể xem trước trên trình duyệt
const PREVIEWABLE_EXTENSIONS = new Set(["pdf", "txt", "md", "docx", ...IMAGE_EXTENSIONS]);

// Kiểm tra file có phải là docx hay không
export function isDocxFile(fileName: string, fileType: string | null): boolean {
  return normalizeExt(fileName, fileType) === "docx";
}

// Chuẩn hoá đuôi file về chữ thường không dấu chấm
function normalizeExt(fileName: string, fileType: string | null): string {
  return (fileType || fileName.split(".").pop() || "").toLowerCase().replace(/^\./, "");
}

// Lấy icon và class hiển thị theo loại file
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

// Kiểm tra file có thể xem trước được không
export function isPreviewable(fileName: string, fileType: string | null): boolean {
  const ext = normalizeExt(fileName, fileType);
  return PREVIEWABLE_EXTENSIONS.has(ext);
}

// Kiểm tra file có phải là ảnh hay không
export function isImageFile(fileName: string, fileType: string | null): boolean {
  const ext = normalizeExt(fileName, fileType);
  return IMAGE_EXTENSIONS.has(ext) || ["img"].includes(ext);
}

// Lấy nhãn và class hiển thị theo trạng thái tài liệu
export function statusInfo(status: string): StatusMeta {
  const s = (status || "").toLowerCase();
  if (s === "pending") {
    return { label: "Chờ duyệt", cls: "pending" };
  }
  if (s === "approved" || s === "uploaded") {
    return { label: "Đã duyệt", cls: "approved" };
  }
  if (s === "rejected") {
    return { label: "Bị từ chối", cls: "rejected" };
  }
  if (s === "completed" || s === "indexed") {
    return { label: "Đã index", cls: "indexed" };
  }
  if (s === "processing") {
    return { label: "Đang xử lý AI", cls: "processing" };
  }
  return { label: "Chờ OCR", cls: "neutral" };
}