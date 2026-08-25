from uuid import NAMESPACE_URL, uuid5

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams

from app.core.config import settings


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