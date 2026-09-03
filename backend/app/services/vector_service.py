import uuid

from qdrant_client import QdrantClient, models

from app.core.config import settings
from app.models.document import Document
from app.services.chunking_service import chunk_document
from app.services.embedding_service import embed_text, embed_texts


# Tên collection lưu vector các đoạn văn bản của tài liệu
COLLECTION_NAME = "document_chunks"

# Kích thước vector đầu ra của model paraphrase-multilingual-MiniLM-L12-v2
VECTOR_SIZE = 384


# Ban đầu chưa có kết nối, tạo khi cần dùng lần đầu
_client: QdrantClient | None = None


def get_client() -> QdrantClient | None:
    global _client

    if not settings.vector_db_url:
        return None

    if _client is None:
        _client = QdrantClient(url=settings.vector_db_url, timeout=60)

    return _client


def ensure_collection() -> bool:
    client = get_client()
    if client is None:
        return False

    if not client.collection_exists(COLLECTION_NAME):
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=models.VectorParams(
                size=VECTOR_SIZE,
                distance=models.Distance.COSINE,
            ),
        )
    return True


def upsert_chunks(
    document_id: int,
    document_version: int,
    chunks: list[dict],
    vectors: list[list[float]],
) -> int:
    if not chunks or len(chunks) != len(vectors):
        return 0

    points = [
        models.PointStruct(
            id=_point_id(document_id, document_version, chunk["chunk_index"]),
            vector=vector,
            payload={
                "document_id": document_id,
                "document_version": document_version,
                "chunk_index": chunk["chunk_index"],
                "text": chunk["text"],
                "page_number": chunk.get("page_number"),
            },
        )
        for chunk, vector in zip(chunks, vectors)
    ]

    client = get_client()
    if client is None:
        return 0

    ensure_collection()
    client.upsert(collection_name=COLLECTION_NAME, points=points)
    return len(points)


def delete_document_points(document_id: int) -> None:
    client = get_client()
    if client is None:
        return

    client.delete(
        collection_name=COLLECTION_NAME,
        points_selector=models.FilterSelector(
            filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="document_id",
                        match=models.MatchValue(value=document_id),
                    )
                ]
            )
        ),
    )


def index_document(document: Document) -> int:
    """Chia chunk, embed batch và lưu tất cả vào Qdrant."""
    from app.services.extraction_service import extract_text_with_pages

    chunks = chunk_document(document)
    if not chunks:
        return 0

    delete_document_points(document.id)

    vectors = embed_texts([chunk["text"] for chunk in chunks])
    return upsert_chunks(
        document_id=document.id,
        document_version=document.current_version,
        chunks=chunks,
        vectors=vectors,
    )


def query(vector: list[float], *, top_k: int = 5) -> list[dict]:
    client = get_client()
    if client is None:
        return []

    ensure_collection()
    hits = client.query_points(
        collection_name=COLLECTION_NAME,
        query=vector,
        limit=top_k,
        with_payload=True,
    ).points

    return [
        {
            "score": hit.score,
            **(hit.payload or {}),
        }
        for hit in hits
    ]


def _point_id(document_id: int, document_version: int, chunk_index: int) -> str:
    key = f"{document_id}-{document_version}-{chunk_index}"
    return str(uuid.uuid5(uuid.NAMESPACE_URL, key))
