from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.routes import admin, audit, auth, documents, folders, search, users
from app.core.config import settings
from app.database.connection import SessionLocal
from app import models  # noqa: F401


# Tạo ứng dụng FastAPI chính cho hệ thống
app = FastAPI(
    title="AI Document Manager API",
    description="Backend API cho hệ thống quản lý tài liệu thông minh",
    version="1.0.0",
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
)

# Cấu hình CORS cho phép các nguồn frontend truy cập
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gộp tất cả router của các module vào API chung
api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(admin.router)
api_router.include_router(folders.router)
api_router.include_router(documents.router)
api_router.include_router(audit.router)
api_router.include_router(search.router)
app.include_router(api_router)


# Endpoint gốc kiểm tra API hoạt động
@app.get("/")
def root():
    return {"message": "AI Document Manager API is running"}


# Endpoint kiểm tra sức khỏe hệ thống và kết nối database
@app.get("/health")
def health_check():
    database = "ok"
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except Exception:
        database = "error"
    return {"status": "healthy", "database": database}