import time

from google import genai
from google.genai.errors import ServerError

from app.core.config import settings
from app.core.exceptions import BadRequestError, ServiceUnavailableError
from app.models.document import Document


def summarize_document(document: Document, *, max_chars: int = 8000) -> str:
    """
    Dùng Gemini tóm tắt nội dung đã trích xuất của tài liệu.
    """
    if not settings.llm_api_key:
        raise RuntimeError("Chưa cấu hình LLM_API_KEY")

    text = (document.extracted_text or "").strip()
    if not text:
        raise BadRequestError(
            "Tài liệu chưa có văn bản trích xuất, không thể tóm tắt."
        )

    # Chỉ gửi phần đầu tài liệu để tránh vượt giới hạn token
    text = text[:max_chars]

    prompt = (
        "Bạn là trợ lý tóm tắt tài liệu.\n"
        "Đọc nội dung tài liệu bên dưới và viết phần tóm tắt bằng tiếng Việt.\n"
        "Yêu cầu:\n"
        "- 5-8 dòng ngắn gọn nêu các ý chính của tài liệu.\n"
        "- Cuối phần tóm tắt ghi 'Từ khóa: ' kèm 3-5 từ khóa ngăn cách bằng dấu phẩy.\n"
        "- Không bịa thêm thông tin không có trong tài liệu.\n"
        "- Không nhắc lại nội dung trong prompt này.\n\n"
        f"NỘI DUNG TÀI LIỆU:\n{text}\n"
    )

    client = genai.Client(api_key=settings.llm_api_key)

    # Thử gọi Gemini tối đa 3 lần nếu server đang bận
    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=settings.llm_model,
                contents=prompt,
            )
            return (response.text or "Gemini không trả về nội dung.").strip()
        except ServerError:
            if attempt == 2:
                raise ServiceUnavailableError(
                    "Gemini đang bận, vui lòng thử lại sau."
                )
            time.sleep(2)

    raise ServiceUnavailableError("Gemini đang bận, vui lòng thử lại sau.")