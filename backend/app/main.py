from fastapi import APIRouter, FastAPI
from sqlalchemy import text

from app.api.routes import admin, auth, documents, folders, users
from app.database.connection import SessionLocal
from app import models  # noqa: F401


app = FastAPI(
    title="AI Document Manager API",
    description="Backend API cho hệ thống quản lý tài liệu thông minh",
    version="1.0.0",
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(admin.router)
api_router.include_router(folders.router)
api_router.include_router(documents.router)
app.include_router(api_router)


@app.get("/")
def root():
    return {"message": "AI Document Manager API is running"}


@app.get("/health")
def health_check():
    database = "ok"
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except Exception:
        database = "error"
    return {"status": "healthy", "database": database}
