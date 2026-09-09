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


@router.get("")
def get_chats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lấy danh sách các cuộc chat của user hiện tại.
    """

    # Chỉ lấy chat thuộc về user đang đăng nhập
    chats = (
        db.query(Chat)
        .filter(Chat.user_id == current_user.id)
        .order_by(Chat.updated_at.desc())
        .all()
    )

    # Trả dữ liệu đơn giản cho frontend
    return [
        {
            "id": chat.id,
            "title": chat.title,
            "created_at": chat.created_at,
            "updated_at": chat.updated_at,
        }
        for chat in chats
    ]


@router.get("/{chat_id}")
def get_chat_history(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lấy thông tin và toàn bộ tin nhắn của một cuộc chat.
    """

    # Tìm cuộc chat theo id
    chat = db.get(Chat, chat_id)

    if not chat:
        raise NotFoundError("Không tìm thấy cuộc chat")

    # Chỉ chủ sở hữu mới được xem lịch sử
    if chat.user_id != current_user.id:
        raise ForbiddenError("Bạn không có quyền truy cập cuộc chat này")

    # Lấy message theo đúng thứ tự gửi
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.chat_id == chat.id)
        .order_by(ChatMessage.id.asc())
        .all()
    )

    return {
        "id": chat.id,
        "title": chat.title,
        "created_at": chat.created_at,
        "updated_at": chat.updated_at,
        "messages": [
            {
                "id": message.id,
                "role": message.role,
                "content": message.content,
                "created_at": message.created_at,
            }
            for message in messages
        ],
    }


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


        # Lấy tối đa 6 tin nhắn gần nhất để AI hiểu ngữ cảnh
    history_messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.chat_id == chat.id)
        .order_by(ChatMessage.id.desc())
        .limit(6)
        .all()
    )

    # Đảo lại để đúng thứ tự cũ → mới
    history_messages.reverse()

    conversation_history = "\n".join(
        f"{message.role}: {message.content}"
        for message in history_messages
    )


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
        conversation_history=conversation_history,
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
