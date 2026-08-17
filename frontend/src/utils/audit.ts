// Nhãn tiếng Việt cho các loại hành động trong nhật ký
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  create: "Tạo mới",
  edit: "Chỉnh sửa",
  view: "Xem",
  delete: "Xoá",
  upload_version: "Cập nhật phiên bản",
  share_grant: "Chia sẻ",
  share_revoke: "Thu hồi chia sẻ",
  approve: "Phê duyệt",
  reject: "Từ chối",
};

// Trả về nhãn tiếng Việt của hành động (hoặc chính action nếu không có)
export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

// Danh sách lựa chọn hành động dùng cho bộ lọc
export const AUDIT_ACTION_OPTIONS = Object.entries(AUDIT_ACTION_LABELS).map(
  ([value, label]) => ({ value, label }),
);
