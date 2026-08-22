from sentence_transformers import SentenceTransformer


# Model này hỗ trợ nhiều ngôn ngữ, có cả tiếng Việt và tiếng Anh
MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

# Ban đầu chưa tải model
model = None


def get_model():
    """Tải model khi cần dùng lần đầu tiên."""
    global model

    if model is None:
        model = SentenceTransformer(MODEL_NAME)

    return model


def embed_text(text: str) -> list[float]:
    """
    Chuyển một đoạn văn bản thành vector số.
    Vector này sau đó sẽ được lưu vào Qdrant.
    """

    # Text rỗng thì không cần tạo embedding
    if not text or not text.strip():
        return []

    embedding_model = get_model()

    # Model biến nội dung text thành một vector gồm nhiều số
    vector = embedding_model.encode(
        text,
        normalize_embeddings=True,
    )

    # Chuyển numpy array thành list Python để dễ lưu vào Qdrant
    return vector.tolist()
