import os
import secrets

from dotenv import load_dotenv

load_dotenv()


# Lớp cấu hình ứng dụng đọc biến môi trường
class Settings:
    app_name: str = os.getenv("APP_NAME", "AI Document Manager")
    app_env: str = os.getenv("APP_ENV", "development")
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/ai_document_manager",
    )
    # Bật cờ này thì forgot-password trả reset token/link trong response (chỉ dùng cho dev).
    # Mặc định tắt: kể cả ở development cũng không lộ token.
    expose_reset_token: bool = os.getenv("EXPOSE_RESET_TOKEN", "false").lower() == "true"
    secret_key: str = os.getenv("SECRET_KEY", "")
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    jwt_expire_minutes: int = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))
    reset_token_expire_minutes: int = int(
        os.getenv("RESET_TOKEN_EXPIRE_MINUTES", "60")
    )
    email_enabled: bool = os.getenv("EMAIL_ENABLED", "false").lower() == "true"
    frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost")
    cors_origins: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            f"{frontend_url},http://localhost,http://localhost:3000,http://localhost:5173,http://localhost:8000",
        ).split(",")
        if origin.strip()
    ]
    vector_db_url: str = os.getenv("VECTOR_DB_URL", "")
    llm_api_key: str = os.getenv("LLM_API_KEY", "")
    storage_path: str = os.getenv("STORAGE_PATH", "storage/uploads")
    max_upload_size: int = int(
        os.getenv("MAX_UPLOAD_SIZE", str(100 * 1024 * 1024))
    )

    # Kiểm tra môi trường đang chạy có phải production
    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


# Đối tượng cấu hình toàn cục dùng chung trong app
settings = Settings()

if not settings.secret_key:
    if settings.is_production:
        raise RuntimeError(
            "SECRET_KEY bắt buộc phải đặt trong môi trường production. "
            "Tạo bằng: python -c \"import secrets; print(secrets.token_hex(32))\""
        )
    settings.secret_key = secrets.token_hex(32)