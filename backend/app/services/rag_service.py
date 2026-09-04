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
