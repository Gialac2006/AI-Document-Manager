from google import genai

from app.core.config import settings
from app.models.user import User
from app.services.search_service import semantic_search


def build_context(
    db,
    *,
    question: str,
    current_user: User,
    limit: int = 5,
) -> str:
    """
    Tìm các đoạn tài liệu liên quan đến câu hỏi
    rồi ghép lại thành context cho LLM ở bước sau.
    """

    # dùng Semantic Search để lấy các chunk gần nghĩa nhất
    results = semantic_search(
        db,
        query_text=question,
        current_user=current_user,
        limit=limit,
    )

    # Không tìm thấy tài liệu liên quan
    if not results:
        return ""

    context_parts = []

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

    # nối các chunk lại thành một chuỗi lớn
    return "\n\n".join(context_parts)


def answer(
    db,
    *,
    question: str,
    current_user: User,
    limit: int = 5,
) -> str:
    """
    Trả lời câu hỏi dựa trên nội dung tài liệu mà user có quyền xem.
    """

    # Chưa cấu hình API key thì không thể gọi Gemini
    if not settings.llm_api_key:
        raise RuntimeError("Chưa cấu hình LLM_API_KEY")

    # Bước 1: tìm và ghép các đoạn tài liệu liên quan
    context = build_context(
        db,
        question=question,
        current_user=current_user,
        limit=limit,
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

CONTEXT:
{context}

CÂU HỎI:
{question}
"""

    # Bước 3: gửi context + câu hỏi cho Gemini
    client = genai.Client(api_key=settings.llm_api_key)

    response = client.models.generate_content(
        model=settings.llm_model,
        contents=prompt,
    )

    # Bước 4: lấy câu trả lời dạng text
    return response.text or "Gemini không trả về nội dung."
