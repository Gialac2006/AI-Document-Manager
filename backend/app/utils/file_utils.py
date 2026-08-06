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


def get_file_extension(filename: str) -> str:
    return Path(filename or "").suffix.lower()


def safe_filename(filename: str) -> str:
    stem = Path(filename or "").stem
    stem = re.sub(r"[^\w.\- ]+", "", stem).strip()
    stem = re.sub(r"\s+", "_", stem)
    stem = stem[:80] or "file"
    return f"{uuid.uuid4().hex}_{stem}"


def is_allowed_extension(ext: str) -> bool:
    return ext in ALLOWED_EXTENSIONS