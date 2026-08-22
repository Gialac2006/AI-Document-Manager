from typing import TypedDict

from app.models.document import Document
from app.services.text_processing_service import split_text


class DocumentChunk(TypedDict):
    document_id: int
    document_version: int
    chunk_index: int
    text: str


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
) -> list[DocumentChunk]:
    """
    Chia extracted_text của một document và gắn metadata
    cần thiết cho bước embedding/vector database.
    """
    if not document.extracted_text:
        return []

    chunks = chunk_text(
        document.extracted_text,
        chunk_size=chunk_size,
        overlap=overlap,
    )

    return [
        {
            "document_id": document.id,
            "document_version": document.current_version,
            "chunk_index": index,
            "text": chunk,
        }
        for index, chunk in enumerate(chunks)
    ]
