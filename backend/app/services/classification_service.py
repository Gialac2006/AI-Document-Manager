import time

from google import genai
from google.genai.errors import ServerError

from app.core.config import settings
from app.core.exceptions import BadRequestError, ServiceUnavailableError
from app.models.document import Document

# Danh sách nhãn phân loại mà AI được phép chọn
CATEGORIES = (
    "hợp đồng",
    "quyết định",
    "báo cáo",
    "quy chế / quy định",
    "hướng dẫn / quy trình",
    "hóa đơn / chứng từ",
    "văn bản pháp lý",
    "khác",
)


def _normalize_category(raw: str) -> str:
    """
    Làm sạch kết quả LLM: cắt label trước dấu ':'/'(' và loại ký tự thừa.
    Nếu không khớp danh sách thì trả về 'khác'.
    """
    value = (raw or "").strip().lower()

    # Gemini có thể trả "Quyết định:", "hợp đồng (HD01)" ...
    for label in CATEGORIES:
        if value.startswith(label) or label in value:
            return label

    # Cắt trước ký tự đặc biệt rồi so khớp lại một lần nữa
    for sep in (":", "(", "[", "\n", ";"):
        head = value.split(sep, 1)[0].strip()
        if head in CATEGORIES:
            return head

    return "khác"


def classify_document(document: Document, *, max_chars: int = 6000) -> str:
    """
    Dùng Gemini xác định loại tài liệu từ nội dung đã trích xuất.
    """
    if not settings.llm_api_key:
        raise RuntimeError("Chưa cấu hình LLM_API_KEY")

    text = (document.extracted_text or "").strip()
    if not text:
        raise BadRequestError(
            "Tài liệu chưa có văn bản trích xuất, không thể phân loại."
        )

    text = text[:max_chars]

    prompt = (
        "Bạn là trợ lý phân loại tài liệu.\n"
        "Đọc nội dung tài liệu bên dưới và xác định loại tài liệu.\n"
        "Chỉ trả về ĐÚNG MỘT trong các nhãn sau, không thêm lời giải thích:\n"
        f"{', '.join(CATEGORIES)}\n\n"
        f"NỘI DUNG TÀI LIỆU:\n{text}\n"
    )

    client = genai.Client(api_key=settings.llm_api_key)

    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=settings.llm_model,
                contents=prompt,
            )
            return _normalize_category(response.text or "")
        except ServerError:
            if attempt == 2:
                raise ServiceUnavailableError(
                    "Gemini đang bận, vui lòng thử lại sau."
                )
            time.sleep(2)

    raise ServiceUnavailableError("Gemini đang bận, vui lòng thử lại sau.")