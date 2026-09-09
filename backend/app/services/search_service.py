import math
import re
import unicodedata

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.user import User
from app.services import document_service
from app.services.embedding_service import embed_text
from app.services.vector_service import (
    COLLECTION_NAME,
    get_client,
    query,
)


# Những từ quá phổ biến, ít giúp xác định nội dung
STOP_WORDS = {
    "la", "va", "cua", "co", "cho", "duoc", "trong", "voi",
    "mot", "nhung", "cac", "nay", "do", "thi", "vi", "sao",
    "ai", "gi", "o", "ve", "nhu", "den",
    "cau", "hoi", "truoc", "moi",
}

#------------------------------------------------

def _normalize_text(text: str) -> str:
    """
    Chuẩn hóa text để tìm keyword dễ hơn.

    Ví dụ:
    "Tuyết" -> "tuyet"
    "gả"    -> "ga"
    """

    text = text.lower()

    # Chuẩn hóa chữ đ
    text = text.replace("đ", "d").replace("ð", "d")

    # Tách dấu tiếng Việt
    text = unicodedata.normalize("NFD", text)

    # Bỏ dấu
    text = "".join(
        character
        for character in text
        if unicodedata.category(character) != "Mn"
    )

    return text

#------------------------------------------------

def _tokenize(text: str) -> list[str]:
    """
    Chuyển text thành danh sách từ đã chuẩn hóa.
    """

    text = _normalize_text(text)

    return re.findall(r"\b\w+\b", text)

#------------------------------------------------

def _query_words(query_text: str) -> set[str]:
    """
    Lấy những từ có ý nghĩa từ câu hỏi.
    """

    return {
        word
        for word in _tokenize(query_text)
        if len(word) > 1 and word not in STOP_WORDS
    }

#------------------------------------------------

def _keyword_candidates(
    query_text: str,
    *,
    top_k: int = 50,
) -> list[dict]:
    """
    Keyword Search có trọng số.

    Từ hiếm trong tài liệu sẽ quan trọng hơn từ xuất hiện nhiều.
    Ví dụ "ga" có thể quan trọng hơn một từ xuất hiện ở rất nhiều chunk.
    """

    client = get_client()

    if client is None:
        return []

    query_words = _query_words(query_text)

    if not query_words:
        return []

    all_chunks = []
    offset = None

    # Đọc tất cả chunk hiện có trong Qdrant
    while True:
        points, offset = client.scroll(
            collection_name=COLLECTION_NAME,
            limit=100,
            offset=offset,
            with_payload=True,
            with_vectors=False,
        )

        for point in points:
            payload = point.payload or {}
            text = payload.get("text", "")

            all_chunks.append(
                {
                    **payload,
                    "_words": set(_tokenize(text)),
                }
            )

        if offset is None:
            break

    if not all_chunks:
        return []

    total_chunks = len(all_chunks)

    # Đếm mỗi keyword xuất hiện trong bao nhiêu chunk
    document_frequency = {}

    for word in query_words:
        count = sum(
            1
            for chunk in all_chunks
            if word in chunk["_words"]
        )

        document_frequency[word] = count

    # Tính trọng số IDF.
    # Từ càng hiếm thì điểm càng cao.
    word_weights = {}

    for word in query_words:
        frequency = document_frequency[word]

        word_weights[word] = math.log(
            (total_chunks + 1) / (frequency + 1)
        ) + 1

    max_score = sum(word_weights.values())

    candidates = []

    for chunk in all_chunks:
        words = chunk["_words"]

        matched_words = query_words & words

        if not matched_words:
            continue

        # Cộng trọng số của những keyword tìm thấy
        raw_score = sum(
            word_weights[word]
            for word in matched_words
        )

        # Chuẩn hóa về khoảng 0 → 1
        keyword_score = raw_score / max_score

        # Không cần field tạm nữa
        chunk.pop("_words", None)

        candidates.append(
            {
                **chunk,
                "keyword_score": keyword_score,
            }
        )

    # Keyword tốt nhất đứng trước
    candidates.sort(
        key=lambda item: item["keyword_score"],
        reverse=True,
    )

    return candidates[:top_k]

#------------------------------------------------

def _candidate_key(point: dict) -> tuple:
    """
    Khóa duy nhất để nhận biết một chunk.
    """

    return (
        point.get("document_id"),
        point.get("document_version"),
        point.get("chunk_index"),
    )

#------------------------------------------------

def _rrf_merge(
    vector_candidates: list[dict],
    keyword_candidates: list[dict],
) -> list[dict]:
    """
    Gộp Vector Search và Keyword Search bằng RRF.
    """

    rrf_k = 60
    candidate_map = {}

    # ===== Vector Search =====
    for rank, point in enumerate(vector_candidates, start=1):
        key = _candidate_key(point)

        if key not in candidate_map:
            candidate_map[key] = {
                **point,
                "vector_score": float(
                    point.get("score", 0)
                ),
                "keyword_score": 0.0,
                "rrf_score": 0.0,
            }

        candidate_map[key]["rrf_score"] += (
            1 / (rrf_k + rank)
        )

    # ===== Keyword Search =====
    for rank, point in enumerate(keyword_candidates, start=1):
        key = _candidate_key(point)

        if key not in candidate_map:
            candidate_map[key] = {
                **point,
                "vector_score": 0.0,
                "keyword_score": float(
                    point.get("keyword_score", 0)
                ),
                "rrf_score": 0.0,
            }
        else:
            candidate_map[key]["keyword_score"] = float(
                point.get("keyword_score", 0)
            )

        candidate_map[key]["rrf_score"] += (
            1 / (rrf_k + rank)
        )

    candidates = list(candidate_map.values())

    candidates.sort(
        key=lambda item: item["rrf_score"],
        reverse=True,
    )

    return candidates

#------------------------------------------------

def _select_hybrid_candidates(
    rrf_candidates: list[dict],
    keyword_candidates: list[dict],
    *,
    limit: int,
) -> list[dict]:
    """
    Chọn candidate cuối cùng cho RAG.

    - Giữ các kết quả keyword mạnh để không bỏ sót đáp án chính xác.
    - Sau đó dùng RRF để bổ sung các đoạn gần nghĩa.
    """

    selected = []
    selected_keys = set()

    # Dùng bản đã merge để giữ đầy đủ vector_score,
    # keyword_score và rrf_score.
    merged_map = {
        _candidate_key(point): point
        for point in rrf_candidates
    }

    # 1. Ưu tiên tối đa 6 kết quả keyword mạnh
    for point in keyword_candidates[:6]:
        keyword_score = float(
            point.get("keyword_score", 0)
        )

        # Keyword quá yếu thì không ép vào context
        if keyword_score < 0.55:
            continue

        key = _candidate_key(point)

        if key in selected_keys:
            continue

        selected.append(
            merged_map.get(key, point)
        )
        selected_keys.add(key)

    # 2. Bổ sung các kết quả RRF tốt nhất
    for point in rrf_candidates:
        key = _candidate_key(point)

        if key in selected_keys:
            continue

        selected.append(point)
        selected_keys.add(key)

        if len(selected) >= limit:
            break

    return selected[:limit]

#------------------------------------------------

def _detect_position_hint(query_text: str) -> str | None:
    """
    Nhận diện câu hỏi đang hỏi về phần đầu hoặc phần cuối tài liệu.
    Dùng chung cho truyện, báo cáo, giáo trình, hợp đồng...
    """

    text = _normalize_text(query_text)

    end_keywords = (
        "cuoi tai lieu",
        "phan cuoi",
        "doan cuoi",
        "trang cuoi",
        "chuong cuoi",
        "cuoi truyen",
        "ket thuc",
        "ket luan",
        "conclusion",
        "ending",
        "final section",
    )

    start_keywords = (
        "dau tai lieu",
        "phan dau",
        "doan dau",
        "trang dau",
        "chuong dau",
        "dau truyen",
        "mo dau",
        "introduction",
        "beginning",
    )

    if any(keyword in text for keyword in end_keywords):
        return "end"

    if any(keyword in text for keyword in start_keywords):
        return "start"

    return None

#------------------------------------------------

def _position_candidates(
    document_ids: set[int],
    *,
    position: str,
    query_text: str,
    top_k: int = 6,
) -> list[dict]:
    """
    Lấy các chunk đại diện cho vùng đầu/cuối của từng tài liệu.

    Mỗi tài liệu tự tính trang đầu/cuối riêng,
    tránh trường hợp tài liệu dài làm lấn tài liệu ngắn.
    """

    client = get_client()

    if client is None or not document_ids:
        return []

    all_candidates = []
    offset = None

    while True:
        points, offset = client.scroll(
            collection_name=COLLECTION_NAME,
            limit=100,
            offset=offset,
            with_payload=True,
            with_vectors=False,
        )

        for point in points:
            payload = point.payload or {}

            document_id = payload.get("document_id")
            page_number = payload.get("page_number")

            if document_id not in document_ids:
                continue

            if page_number is None:
                continue

            all_candidates.append(payload)

        if offset is None:
            break

    if not all_candidates:
        return []

    query_words = _query_words(query_text)
    selected = []

    # Xử lý từng tài liệu riêng
    for document_id in document_ids:
        document_chunks = [
            item
            for item in all_candidates
            if item.get("document_id") == document_id
        ]

        if not document_chunks:
            continue

        pages = sorted(
            {
                item["page_number"]
                for item in document_chunks
            }
        )

        # Lấy vùng đầu hoặc cuối của chính tài liệu này
        if position == "end":
            target_pages = pages[-top_k:]
        else:
            target_pages = pages[:top_k]

        # Mỗi trang chọn 1 chunk phù hợp nhất
        for page in target_pages:
            page_chunks = [
                item
                for item in document_chunks
                if item["page_number"] == page
            ]

            if not page_chunks:
                continue

            def chunk_score(item: dict) -> int:
                text_words = set(
                    _tokenize(item.get("text", ""))
                )

                return len(query_words & text_words)

            best_chunk = max(
                page_chunks,
                key=chunk_score,
            )

            selected.append(best_chunk)

    # Giới hạn context cuối cùng
    return selected[:top_k]

#------------------------------------------------

def semantic_search(
    db,
    *,
    query_text: str,
    current_user: User,
    limit: int = 8,
) -> list[dict]:
    """
    Hybrid Search:

    Vector Search
    +
    Keyword Search có trọng số
    ↓
    RRF
    ↓
    Top chunk cho Gemini
    """

    if not query_text or not query_text.strip():
        return []

    # Tạo embedding của câu hỏi
    vector = embed_text(query_text)

    # Lấy nhiều candidate để không bỏ sót đáp án
    candidate_limit = max(limit * 10, 50)

    # Semantic Search
    vector_candidates = query(
        vector,
        top_k=candidate_limit,
    )

    # Keyword Search
    keyword_candidates = _keyword_candidates(
        query_text,
        top_k=candidate_limit,
    )

    # Gộp Vector + Keyword bằng RRF
    rrf_candidates = _rrf_merge(
        vector_candidates,
        keyword_candidates,
    )

    # Giữ cả kết quả keyword mạnh và semantic tốt
    candidates = _select_hybrid_candidates(
        rrf_candidates,
        keyword_candidates,
        limit=limit,
    )
        # Kiểm tra câu hỏi có hỏi về đầu/cuối tài liệu không
    position_hint = _detect_position_hint(query_text)

    if position_hint:
        # Những tài liệu đang liên quan nhất đến câu hỏi
        document_ids = {
            point.get("document_id")
            for point in candidates
            if point.get("document_id") is not None
        }

        position_results = _position_candidates(
            document_ids,
            position=position_hint,
            query_text=query_text,
            top_k=6,
        )

        # Đưa các chunk đầu/cuối tài liệu lên trước
        combined = []
        seen_keys = set()

        for point in position_results + candidates:
            key = _candidate_key(point)

            if key in seen_keys:
                continue

            combined.append(point)
            seen_keys.add(key)

            if len(combined) >= limit:
                break

        candidates = combined


    results = []

    # Kiểm tra quyền tài liệu
    for point in candidates:
        document_id = point.get("document_id")

        if document_id is None:
            continue

        try:
            document = document_service.get_document(
                db,
                document_id=document_id,
                current_user=current_user,
            )
        except (ForbiddenError, NotFoundError):
            continue

        results.append(
            {
                "document_id": document.id,
                "document_title": document.title,
                "document_version": point.get(
                    "document_version"
                ),
                "chunk_index": point.get(
                    "chunk_index"
                ),
                "text": point.get("text", ""),
                "score": float(
                    point.get("vector_score", 0)
                ),
                "keyword_score": float(
                    point.get("keyword_score", 0)
                ),
                "rrf_score": float(
                    point.get("rrf_score", 0)
                ),
                "page_number": point.get(
                    "page_number"
                ),
            }
        )

        if len(results) >= limit:
            break

    return results