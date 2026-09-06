from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.database.connection import get_db
from app.models.chat import Chat
from app.models.chat_message import ChatMessage
from app.models.user import User
from app.services.rag_service import answer


router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    question: str


@router.post("")
def ask_chat(
    data: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Nhận câu hỏi, gọi RAG và lưu lịch sử chat.
    """

    # 1. Tạo một cuộc chat mới
    chat = Chat(
        user_id=current_user.id,
        organization_id=current_user.organization_id,
        title=data.question[:100],
    )

    db.add(chat)
    db.flush()

    # 2. Lưu câu hỏi của user
    user_message = ChatMessage(
        chat_id=chat.id,
        role="user",
        content=data.question,
    )

    db.add(user_message)

    # 3. Gọi RAG + Gemini
    response = answer(
        db,
        question=data.question,
        current_user=current_user,
    )

    # 4. Lưu câu trả lời của AI
    assistant_message = ChatMessage(
        chat_id=chat.id,
        role="assistant",
        content=response,
    )

    db.add(assistant_message)

    # 5. Lưu tất cả xuống database
    db.commit()

    return {
        "chat_id": chat.id,
        "question": data.question,
        "answer": response,
    }
