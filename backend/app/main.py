from fastapi import FastAPI

app = FastAPI(
    title="AI Document Manager API",
    description="Backend API cho hệ thống quản lý tài liệu thông minh",
    version="1.0.0",
)


@app.get("/")
def root():
    return {
        "message": "AI Document Manager API is running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }