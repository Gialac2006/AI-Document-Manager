import time
import re
import time

from google import genai
from google.genai.errors import ServerError

from app.core.config import settings
from app.models.user import User
from app.services.search_service import semantic_search
from app.core.exceptions import ServiceUnavailableError

def build_context(
    db,
    *,
    question: str,
    current_user: User,
    limit: int = 5,
    conversation_history: str = "",
) -> tuple[str, list[str]]:
    """
    Tìm các đoạn tài liệu liên quan đến câu hỏi
    rồi ghép lại thành context cho LLM ở bước sau.
    """

    # dùng Semantic Search để lấy các chunk gần nghĩa nhất
        # Nếu có lịch sử chat, ghép với câu hỏi mới để Semantic Search
    # hiểu các câu nối tiếp như "nó", "cái đó", "vậy còn..."
    search_query = question

    if conversation_history.strip():
        search_query = (
            f"{conversation_history}\n"
            f"Câu hỏi mới: {question}"
        )
    
    results = semantic_search(
        db,
        query_text=search_query,
        current_user=current_user,
        limit=limit,
    )

    # Không tìm thấy tài liệu liên quan
    if not results:
        return "", []

    context_parts = []
    sources = []

    # ghép từng chunk thành context
    for index, result in enumerate(results, start=1):
        title = result.get("document_title", "Không rõ tài liệu")
        text = result.get("text", "")
        page_number = result.get("page_number")

        # Nếu có số trang thì ghi thêm để sau này AI có thể dẫn nguồn
        source = f"Tài liệu: {title}"

        if page_number is not None:
            source += f" - Trang {page_number}"

        context_parts.append(
            f"[Nguồn {index}] {source}\n{text}"
        )
        # Nội dung nguồn dùng để hiển thị cho user
        source_display = f"Nguồn {index}: {title}"

        if page_number is not None:
            source_display += f" — Trang {page_number}"

        sources.append(source_display)
    # nối các chunk lại thành một chuỗi lớn
    return "\n\n".join(context_parts), sources


def answer(
    db,
    *,
    question: str,
    current_user: User,
    limit: int = 5,
    conversation_history: str = "",
) -> tuple[str, list[str]]:
    """
    Trả lời câu hỏi dựa trên nội dung tài liệu mà user có quyền xem.
    """

    # Chưa cấu hình API key thì không thể gọi Gemini
    if not settings.llm_api_key:
        raise RuntimeError("Chưa cấu hình LLM_API_KEY")

    # Bước 1: tìm và ghép các đoạn tài liệu liên quan
    context, sources = build_context(
        db,
        question=question,
        current_user=current_user,
        limit=limit,
        conversation_history=conversation_history,
    )

    # Không có tài liệu liên quan thì không gọi LLM
    if not context:
        return "Không tìm thấy thông tin phù hợp trong tài liệu."

    # Bước 2: tạo câu lệnh cho Gemini
    prompt = f"""
Bạn là trợ lý hỏi đáp tài liệu.

Chỉ trả lời dựa trên phần CONTEXT bên dưới.
Không tự thêm thông tin nếu tài liệu không cung cấp.
Nếu context không đủ để trả lời, hãy nói rõ là không đủ thông tin.
Khi phù hợp, hãy ghi nguồn theo dạng [Nguồn 1], [Nguồn 2].

LỊCH SỬ HỘI THOẠI:
{conversation_history or "Chưa có lịch sử hội thoại."}

CONTEXT TÀI LIỆU:
{context}

CÂU HỎI MỚI:
{question}
"""

    # Bước 3: gửi context + câu hỏi cho Gemini
    client = genai.Client(api_key=settings.llm_api_key)

    # Thử gọi Gemini tối đa 3 lần nếu server đang bận
    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=settings.llm_model,
                contents=prompt,
            )

            answer_text = response.text or "Gemini không trả về nội dung."

            # Tìm các số nguồn mà Gemini thật sự đã dẫn trong câu trả lời
            # Hỗ trợ cả [Nguồn 1] và [Nguồn 1, Nguồn 3]
            citation_groups = re.findall(
                r"\[Nguồn ([^\]]+)\]",
                answer_text,
            )

            used_source_numbers = set()

            for group in citation_groups:
                numbers = re.findall(r"\d+", group)

                for number in numbers:
                    used_source_numbers.add(int(number))

            # Chỉ lấy những nguồn Gemini thật sự đã dùng
            used_sources = [
                source
                for index, source in enumerate(sources, start=1)
                if index in used_source_numbers
            ]

            # Nếu Gemini quên ghi [Nguồn ...] thì vẫn hiển thị các nguồn RAG đã tìm được
            if not used_sources:
                used_sources = sources

            sources_text = "\n".join(
                f"- {source}"
                for source in used_sources
            )

            return (
                f"{answer_text}\n\n"
                f"### Chi tiết nguồn\n"
                f"{sources_text}"
            )

        except ServerError:
            # Đã thử đủ 3 lần nhưng Gemini vẫn lỗi
            if attempt == 2:
                raise ServiceUnavailableError(
                    "Gemini đang bận, vui lòng thử lại sau."
                )

            # Chờ 2 giây rồi thử lại
            time.sleep(2)        