from typing import TypedDict

from app.models.document import Document
from app.services.text_processing_service import clean_text, split_text


class DocumentChunk(TypedDict):
    document_id: int
    document_version: int
    chunk_index: int
    text: str
    page_number: int | None


def chunk_text(
    text: str,
    *,
    chunk_size: int = 1000,
    overlap: int = 200,
) -> list[str]:
    """
    Chia văn bản thành các đoạn nhỏ để chuẩn bị cho embedding.
    """
    return split_text(
        text,
        chunk_size=chunk_size,
        overlap=overlap,
    )


def chunk_document(
    document: Document,
    *,
    chunk_size: int = 1000,
    overlap: int = 200,
    page_texts: list[str] | None = None,
) -> list[DocumentChunk]:
    """
    Chia extracted_text của một document và gắn metadata
    cần thiết cho bước embedding/vector database.

    Khi có page_texts (danh sách văn bản theo từng trang của PDF/ảnh OCR),
    mỗi chunk được xác định số trang bằng cách tìm vị trí của nó
    trong chuỗi văn bản đã ghép theo trang.
    """
    if page_texts:
        # Làm sạch từng trang rồi ghép lại, đồng thời ghi nhớ vùng ký tự
        # thuộc về trang nào để tra cứu số trang cho từng chunk phía dưới
        cleaned_pages = [clean_text(page) for page in page_texts]
        page_spans: list[tuple[int, int, int]] = []
        cursor = 0
        for page_number, page in enumerate(cleaned_pages, start=1):
            if not page:
                continue
            page_spans.append((cursor, cursor + len(page), page_number))
            cursor += len(page) + 2  # +2 cho dấu "\n\n" ngăn cách hai trang
        text = "\n\n".join(cleaned_pages).strip()
    else:
        page_spans = []
        text = document.extracted_text or ""

    if not text:
        return []

    pieces = chunk_text(
        text,
        chunk_size=chunk_size,
        overlap=overlap,
    )

    chunks: list[DocumentChunk] = []
    search_from = 0

    for index, piece in enumerate(pieces):
        # Các chunk giữ nguyên thứ tự trong văn bản nên tìm tuần tự
        # từ vị trí chunk trước là đủ và tránh khớp nhầm đoạn trùng lặp
        position = text.find(piece, search_from)
        if position != -1:
            search_from = position + 1

        page_number = None
        if position != -1:
            page_number = _page_for_position(page_spans, position)

        chunks.append(
            {
                "document_id": document.id,
                "document_version": document.current_version,
                "chunk_index": index,
                "text": piece,
                "page_number": page_number,
            }
        )

    return chunks


# Tra cứu số trang chứa vị trí ký tự cho trước
def _page_for_position(
    page_spans: list[tuple[int, int, int]],
    position: int,
) -> int | None:
    for start, end, page_number in page_spans:
        if start <= position < end:
            return page_number
    return None
