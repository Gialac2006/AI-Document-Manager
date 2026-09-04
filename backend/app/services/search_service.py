from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.user import User
from app.services import document_service
from app.services.embedding_service import embed_text
from app.services.vector_service import query


def semantic_search(
    db,
    *,
    query_text: str,
    current_user: User,
    limit: int = 5,
) -> list[dict]:
    """
    Tìm các đoạn tài liệu gần nghĩa với câu người dùng nhập.
    Chỉ trả về tài liệu mà người dùng có quyền xem.
    """

    # Không tìm nếu người dùng nhập chuỗi rỗng
    if not query_text or not query_text.strip():
        return []

    # Bước 1: biến câu tìm kiếm thành vector 384 chiều
    vector = embed_text(query_text)

    # Lấy nhiều hơn số cần trả về vì có thể
    # một số kết quả thuộc tài liệu user không có quyền xem
    candidate_limit = max(limit * 5, 20)

    # Bước 2: tìm các vector gần nghĩa nhất trong Qdrant
    candidates = query(vector, top_k=candidate_limit)

    results = []

    for point in candidates:
        # vector_service.query() bây giờ trả về dict
        # nên đọc dữ liệu bằng point.get(...)
        document_id = point.get("document_id")

        if document_id is None:
            continue

        try:
            # Kiểm tra user có quyền xem document không
            document = document_service.get_document(
                db,
                document_id=document_id,
                current_user=current_user,
            )
        except (ForbiddenError, NotFoundError):
            # Không có quyền hoặc document đã bị xóa → bỏ qua
            continue

        # Tạo kết quả trả về cho frontend
        results.append(
            {
                "document_id": document.id,
                "document_title": document.title,
                "document_version": point.get("document_version"),
                "chunk_index": point.get("chunk_index"),
                "text": point.get("text", ""),
                "score": float(point.get("score", 0)),
                "page_number": point.get("page_number"),
            }
        )

        # Đã đủ số kết quả user yêu cầu thì dừng
        if len(results) >= limit:
            break

    return results

