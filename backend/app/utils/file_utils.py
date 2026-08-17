import re
import uuid
from pathlib import Path

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".txt",
    ".md",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".csv",
    ".json",
}


# Lấy phần mở rộng của tên file
def get_file_extension(filename: str) -> str:
    return Path(filename or "").suffix.lower()


# Tạo tên file an toàn, duy nhất để lưu trữ
def safe_filename(filename: str) -> str:
    stem = Path(filename or "").stem
    stem = re.sub(r"[^\w.\- ]+", "", stem).strip()
    stem = re.sub(r"\s+", "_", stem)
    stem = stem[:80] or "file"
    return f"{uuid.uuid4().hex}_{stem}"


# Kiểm tra phần mở rộng có được phép tải lên
def is_allowed_extension(ext: str) -> bool:
    return ext in ALLOWED_EXTENSIONS


# So khớp magic byte đầu file với định dạng khai báo
def _matches_magic(ext: str, header: bytes) -> bool:
    if ext == ".pdf":
        return header.startswith(b"%PDF-")
    if ext == ".png":
        return header.startswith(b"\x89PNG\r\n\x1a\n")
    if ext in (".jpg", ".jpeg"):
        return header.startswith(b"\xff\xd8\xff")
    if ext == ".gif":
        return header.startswith(b"GIF87a") or header.startswith(b"GIF89a")
    if ext in (".doc", ".xls", ".ppt"):
        return header.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1")
    if ext in (".docx", ".xlsx", ".pptx"):
        return header.startswith(b"PK\x03\x04")
    return True


# Kiểm tra header file hợp lệ với phần mở rộng
def validate_file_header(ext: str, header: bytes) -> bool:
    """Kiểm tra magic byte thay vì chỉ dựa vào đuôi file."""
    if ext not in ALLOWED_EXTENSIONS:
        return False
    return _matches_magic(ext, header)