import time

from google import genai
from google.genai.errors import ServerError

from app.core.config import settings
from app.core.exceptions import BadRequestError, ServiceUnavailableError
from app.models.document import Document


# Số ký tự tối đa cho mỗi phần khi tài liệu dài.
# Chia lớn vừa đủ để giảm số lần gọi Gemini.
CHUNK_SIZE = 40000


def _call_gemini(prompt: str) -> str:
    """
    Gọi Gemini và thử lại tối đa 3 lần nếu server tạm thời bị lỗi.
    """

    if not settings.llm_api_key:
        raise RuntimeError("Chưa cấu hình LLM_API_KEY")

    client = genai.Client(
        api_key=settings.llm_api_key
    )

    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=settings.llm_model,
                contents=prompt,
            )

            return (
                response.text
                or "Gemini không trả về nội dung."
            ).strip()

        except ServerError:
            # Nếu đã thử đủ 3 lần thì báo lỗi cho frontend
            if attempt == 2:
                raise ServiceUnavailableError(
                    "Gemini đang bận, vui lòng thử lại sau."
                )

            time.sleep(2)


def _split_text(
    text: str,
    chunk_size: int = CHUNK_SIZE,
) -> list[str]:
    """
    Chia tài liệu dài thành nhiều phần.

    Ưu tiên cắt ở cuối đoạn văn để hạn chế
    làm đứt nội dung giữa chừng.
    """

    text = text.strip()

    if not text:
        return []

    if len(text) <= chunk_size:
        return [text]

    chunks = []
    start = 0

    while start < len(text):
        end = min(
            start + chunk_size,
            len(text),
        )

        # Nếu chưa tới cuối tài liệu,
        # thử tìm vị trí xuống dòng gần cuối chunk.
        if end < len(text):
            paragraph_end = text.rfind(
                "\n",
                start,
                end,
            )

            # Chỉ dùng vị trí xuống dòng nếu
            # nó không quá xa cuối chunk.
            if paragraph_end > start + chunk_size // 2:
                end = paragraph_end

        chunk = text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        start = end

    return chunks


def _summarize_part(
    text: str,
    part_number: int,
    total_parts: int,
) -> str:
    """
    Tóm tắt một phần của tài liệu dài.
    """

    prompt = f"""
Bạn đang tóm tắt phần {part_number}/{total_parts} của một tài liệu.

Chỉ sử dụng nội dung được cung cấp bên dưới.
Không thêm thông tin không có trong tài liệu.

Hãy tóm tắt ngắn gọn nhưng giữ lại:
- nội dung chính
- nhân vật, đối tượng hoặc tổ chức quan trọng
- sự kiện hoặc ý chính quan trọng
- số liệu, mốc thời gian nếu có
- kết luận quan trọng nếu có

NỘI DUNG:
{text}
"""

    return _call_gemini(prompt)


def summarize(document: Document) -> str:
    """
    Tóm tắt toàn bộ tài liệu.

    - Tài liệu ngắn: Gemini tóm tắt trực tiếp.
    - Tài liệu dài: tóm tắt từng phần rồi tổng hợp lại.
    """

    text = (
        document.extracted_text
        or ""
    ).strip()

    if not text:
        raise BadRequestError(
            "Tài liệu chưa có nội dung để tóm tắt."
        )

    parts = _split_text(text)

    # Tài liệu đủ ngắn thì chỉ cần gọi Gemini 1 lần.
    if len(parts) == 1:
        prompt = f"""
Bạn là trợ lý tóm tắt tài liệu.

Chỉ sử dụng nội dung của tài liệu bên dưới.
Không tự thêm thông tin bên ngoài.

Hãy tạo bản tóm tắt dễ đọc gồm:
1. Tổng quan ngắn về tài liệu.
2. Các nội dung hoặc ý chính.
3. Những thông tin quan trọng cần ghi nhớ.
4. Kết luận của tài liệu nếu có.

TÊN TÀI LIỆU:
{document.title}

NỘI DUNG:
{text}
"""

        return _call_gemini(prompt)

    # Tài liệu dài:
    # Bước 1 - tóm tắt từng phần.
    partial_summaries = []

    for index, part in enumerate(
        parts,
        start=1,
    ):
        summary = _summarize_part(
            part,
            part_number=index,
            total_parts=len(parts),
        )

        partial_summaries.append(
            f"PHẦN {index}:\n{summary}"
        )

    combined_summaries = "\n\n".join(
        partial_summaries
    )

    # Bước 2 - tổng hợp các bản tóm tắt nhỏ
    # thành bản tóm tắt cuối cùng.
    final_prompt = f"""
Bạn là trợ lý tổng hợp tài liệu.

Dưới đây là các bản tóm tắt từng phần
của cùng một tài liệu.

Hãy tổng hợp thành MỘT bản tóm tắt hoàn chỉnh.

Yêu cầu:
- Không thêm thông tin ngoài nội dung đã cung cấp.
- Không lặp lại các ý giống nhau.
- Giữ đúng trình tự và nội dung quan trọng.
- Trình bày rõ ràng, dễ đọc.
- Có phần tổng quan, ý chính và kết luận nếu có.

TÊN TÀI LIỆU:
{document.title}

CÁC BẢN TÓM TẮT:
{combined_summaries}
"""

    return _call_gemini(final_prompt)
