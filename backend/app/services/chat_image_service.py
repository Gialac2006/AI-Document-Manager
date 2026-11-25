from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
import re
import uuid
import warnings

from fastapi import UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import settings
from app.core.exceptions import BadRequestError, NotFoundError
from app.models.chat_attachment import ChatAttachment


MAX_IMAGES = 3
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_PIXELS = 20_000_000

FORMATS = {
    "PNG": ("image/png", ".png"),
    "JPEG": ("image/jpeg", ".jpg"),
    "WEBP": ("image/webp", ".webp"),
}


@dataclass(frozen=True)
class ChatImage:
    data: bytes
    content_type: str
    filename: str
    from_history: bool = False


def prepare_images(files: list[UploadFile]) -> list[ChatImage]:
    if len(files) > MAX_IMAGES:
        raise BadRequestError("Mỗi lượt gửi tối đa 3 ảnh.")

    prepared = []

    for file in files:
        raw = file.file.read(MAX_IMAGE_BYTES + 1)

        if not raw or len(raw) > MAX_IMAGE_BYTES:
            raise BadRequestError(
                "Mỗi ảnh phải có dung lượng lớn hơn 0 và không quá 5 MB."
            )

        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)

                with Image.open(BytesIO(raw)) as original:
                    fmt = original.format

                    if fmt not in FORMATS:
                        raise BadRequestError(
                            "Chỉ hỗ trợ ảnh PNG, JPG và WebP."
                        )

                    if original.width * original.height > MAX_PIXELS:
                        raise BadRequestError(
                            "Ảnh quá lớn. Vui lòng dùng ảnh tối đa "
                            "20 triệu điểm ảnh."
                        )

                    if getattr(original, "is_animated", False):
                        raise BadRequestError(
                            "Vui lòng dùng ảnh tĩnh PNG, JPG hoặc WebP."
                        )

                    original.load()
                    image = ImageOps.exif_transpose(original)

                    mode = (
                        "RGBA"
                        if "A" in image.getbands() and fmt != "JPEG"
                        else "RGB"
                    )
                    image = image.convert(mode)

                    # Tạo ảnh sạch, không giữ metadata của ảnh gốc.
                    clean = Image.new(image.mode, image.size)
                    clean.paste(image)

                    buffer = BytesIO()
                    options = (
                        {"quality": 92}
                        if fmt in ("JPEG", "WEBP")
                        else {}
                    )
                    clean.save(buffer, format=fmt, **options)
                    data = buffer.getvalue()

        except (
            UnidentifiedImageError,
            OSError,
            ValueError,
            Image.DecompressionBombError,
            Image.DecompressionBombWarning,
        ):
            raise BadRequestError(
                "Không đọc được ảnh. Vui lòng chọn ảnh PNG, JPG "
                "hoặc WebP hợp lệ."
            ) from None

        if len(data) > MAX_IMAGE_BYTES:
            raise BadRequestError(
                "Ảnh sau khi xử lý vượt quá 5 MB. "
                "Vui lòng giảm kích thước ảnh."
            )

        name = (
            (file.filename or "anh")
            .replace("\\", "/")
            .rsplit("/", 1)[-1]
        )
        name = re.sub(r"[\x00-\x1f\x7f]", "", name)[:160] or "anh"
        name = (Path(name).stem.strip(". ") or "anh") + FORMATS[fmt][1]

        prepared.append(
            ChatImage(
                data=data,
                content_type=FORMATS[fmt][0],
                filename=name,
            )
        )

    return prepared


def image_path(storage_key: str) -> Path:
    if not re.fullmatch(
        r"[0-9a-f]{32}\.(png|jpg|webp)",
        storage_key,
    ):
        raise NotFoundError("Không tìm thấy ảnh.")

    return (
        Path(settings.storage_path).resolve()
        / "chat_images"
        / storage_key
    )


def store_images(
    db,
    message,
    images: list[ChatImage],
    written: list[Path],
):
    extensions = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/webp": ".webp",
    }

    for image in images:
        key = uuid.uuid4().hex + extensions[image.content_type]
        path = image_path(key)
        path.parent.mkdir(parents=True, exist_ok=True)

        with path.open("xb") as stream:
            written.append(path)
            stream.write(image.data)

        db.add(
            ChatAttachment(
                message_id=message.id,
                storage_key=key,
                filename=image.filename,
                content_type=image.content_type,
                byte_size=len(image.data),
            )
        )


def recent_images(messages) -> list[ChatImage]:
    # Lấy ảnh của lượt gửi có ảnh gần nhất trong lịch sử được cung cấp.
    for message in reversed(messages):
        if message.role == "user" and message.attachments:
            images = []

            for attachment in message.attachments[:MAX_IMAGES]:
                path = image_path(attachment.storage_key)

                if not path.is_file():
                    raise NotFoundError(
                        "Ảnh trong lịch sử không còn khả dụng. "
                        "Vui lòng đính kèm lại ảnh."
                    )

                images.append(
                    ChatImage(
                        data=path.read_bytes(),
                        content_type=attachment.content_type,
                        filename=attachment.filename,
                        from_history=True,
                    )
                )

            return images

    return []