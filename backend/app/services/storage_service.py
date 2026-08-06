from pathlib import Path

from fastapi import UploadFile

from app.core.config import settings
from app.core.exceptions import BadRequestError
from app.utils.file_utils import get_file_extension, safe_filename


def save_file(file: UploadFile, *, owner_id: int) -> str:
    original_name = file.filename or "untitled"
    ext = get_file_extension(original_name)
    stored_name = f"{safe_filename(original_name)}{ext}"

    directory = Path(settings.storage_path) / str(owner_id)
    directory.mkdir(parents=True, exist_ok=True)

    target = directory / stored_name
    size = 0
    with target.open("wb") as buffer:
        while chunk := file.file.read(1024 * 1024):
            size += len(chunk)
            if size > settings.max_upload_size:
                buffer.close()
                target.unlink(missing_ok=True)
                raise BadRequestError("File vượt quá kích thước cho phép")
            buffer.write(chunk)

    return f"{owner_id}/{stored_name}"


def get_full_path(rel_path: str) -> Path:
    return Path(settings.storage_path) / rel_path


def delete_file(rel_path: str) -> None:
    path = get_full_path(rel_path)
    path.unlink(missing_ok=True)