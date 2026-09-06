from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.exceptions import ForbiddenError, NotFoundError
from app.api.dependencies import get_current_user
from app.database.connection import get_db
from app.models.chat import Chat
from app.models.chat_message import ChatMessage
from app.models.user import User
from app.services.rag_service import answer


router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    question: str
    chat_id: int | None = None


@router.post("")
def ask_chat(
    data: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Nhận câu hỏi, gọi RAG và lưu lịch sử chat.
    """

        # Nếu frontend gửi chat_id thì dùng lại cuộc chat cũ
    if data.chat_id is not None:
        chat = db.get(Chat, data.chat_id)

        if not chat:
            raise NotFoundError("Không tìm thấy cuộc chat")

        if chat.user_id != current_user.id:
            raise ForbiddenError("Bạn không có quyền truy cập cuộc chat này")

    # Không có chat_id thì tạo chat mới
    else:
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
