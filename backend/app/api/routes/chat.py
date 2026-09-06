from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.database.connection import get_db
from app.models.user import User
from app.services.rag_service import answer


router = APIRouter(prefix="/chat", tags=["chat"])


# Dữ liệu frontend gửi lên
class ChatRequest(BaseModel):
    question: str


@router.post("")
def ask_chat(
    data: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Nhận câu hỏi từ user và dùng RAG + Gemini để trả lời.
    """

    # Gọi RAG để tìm tài liệu liên quan và hỏi Gemini
    response = answer(
        db,
        question=data.question,
        current_user=current_user,
    )

    # Trả câu trả lời về frontend
    return {
        "question": data.question,
        "answer": response,
    }
    