from uuid import NAMESPACE_URL, uuid5

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    FilterSelector,
    MatchValue,
    PointStruct,
    VectorParams,
)


from app.core.config import settings
from app.models.document import Document
from app.services.chunking_service import chunk_document
from app.services.embedding_service import embed_text


# Tên collection dùng để lưu các vector của tài liệu
COLLECTION_NAME = "document_chunks"

# Model embedding hiện tại tạo vector 384 chiều
VECTOR_SIZE = 384


def get_client() -> QdrantClient:
    """Kết nối tới Qdrant."""
    return QdrantClient(url=settings.vector_db_url)


def create_collection():
    """Tạo collection nếu chưa có."""
    client = get_client()

    # Lấy tên các collection hiện có
    collections = client.get_collections().collections
    collection_names = [item.name for item in collections]

    # Có rồi thì không cần tạo lại
    if COLLECTION_NAME in collection_names:
        return

    # Tạo collection để lưu vector
    client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(
            size=VECTOR_SIZE,
            distance=Distance.COSINE,
        ),
    )


def upsert(
    document_id: int,
    document_version: int,
    chunk_index: int,
    text: str,
    vector: list[float],
):
    """Lưu một chunk và vector của nó vào Qdrant."""

    # Đảm bảo collection đã tồn tại
    create_collection()

    # Mỗi chunk có một ID cố định
    # Lưu lại cùng chunk sẽ cập nhật thay vì tạo bản trùng
    point_id = str(
        uuid5(
            NAMESPACE_URL,
            f"{document_id}:{document_version}:{chunk_index}",
        )
    )

    client = get_client()

    # Lưu vector và thông tin của chunk
    client.upsert(
        collection_name=COLLECTION_NAME,
        points=[
            PointStruct(
                id=point_id,
                vector=vector,
                payload={
                    "document_id": document_id,
                    "document_version": document_version,
                    "chunk_index": chunk_index,
                    "text": text,
                },
            )
        ],
    )


def query(
    vector: list[float],
    limit: int = 5,
):
    """Tìm các chunk có nội dung gần nghĩa nhất."""

    # Đảm bảo collection tồn tại
    create_collection()

    client = get_client()

    # So sánh vector cần tìm với các vector đã lưu
    result = client.query_points(
        collection_name=COLLECTION_NAME,
        query=vector,
        limit=limit,
        with_payload=True,
    )

    return result.points


def delete_document_points(document_id: int):
    """Xóa các vector cũ của một document khỏi Qdrant."""

    create_collection()
    client = get_client()

    client.delete(
        collection_name=COLLECTION_NAME,
        points_selector=FilterSelector(
            filter=Filter(
                must=[
                    FieldCondition(
                        key="document_id",
                        match=MatchValue(value=document_id),
                    )
                ]
            )
        ),
        wait=True,
    )


def index_document(document: Document) -> int:
    """
    Chia tài liệu thành chunks, tạo embedding
    và lưu tất cả chunks vào Qdrant.
    """

    # Lấy các chunk từ extracted_text của document
    chunks = chunk_document(document)
    # Xóa vector của version cũ trước khi lưu version hiện tại
    delete_document_points(document.id)
    # Xử lý từng chunk
    for chunk in chunks:
        # Biến nội dung chunk thành vector 384 chiều
        vector = embed_text(chunk["text"])

        # Lưu chunk + vector vào Qdrant
        upsert(
            document_id=chunk["document_id"],
            document_version=chunk["document_version"],
            chunk_index=chunk["chunk_index"],
            text=chunk["text"],
            vector=vector,
        )

    # Trả về số chunk đã index
    return len(chunks)

