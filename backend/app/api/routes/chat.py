import re
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies import get_current_user
from app.core.exceptions import (
    BadRequestError,
    ForbiddenError,
    NotFoundError,
)
from app.database.connection import get_db
from app.models.chat import Chat
from app.models.chat_message import ChatMessage
from app.models.chat_attachment import ChatAttachment
from app.models.user import User
from app.services.rag_service import answer
from app.services import chat_image_service as image_service


router = APIRouter(prefix="/chat", tags=["chat"])


def clean_message_for_history(content: str) -> str:
    content = re.split(
        r"\n\s*#{0,3}\s*Chi tiết nguồn\s*:?\s*\n",
        content,
        maxsplit=1,
        flags=re.IGNORECASE,
    )[0]

    return re.sub(
        r"\[Nguồn\s+\d+(?:\s*,\s*Nguồn\s+\d+)*\]",
        "",
        content,
        flags=re.IGNORECASE,
    ).strip()


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=12000)
    chat_id: int | None = None


def get_owned_chat(db, chat_id, current_user):
    chat = db.get(Chat, chat_id)

    if not chat:
        raise NotFoundError("Không tìm thấy cuộc chat")

    if chat.user_id != current_user.id:
        raise ForbiddenError(
            "Bạn không có quyền truy cập cuộc chat này"
        )

    return chat


def serialize_message(message):
    return {
        "id": message.id,
        "role": message.role,
        "content": message.content,
        "created_at": message.created_at,
        "attachments": [
            {
                "id": attachment.id,
                "filename": attachment.filename,
                "content_type": attachment.content_type,
                "byte_size": attachment.byte_size,
                "url": f"/chat/attachments/{attachment.id}",
            }
            for attachment in message.attachments
        ],
    }


@router.get("")
def get_chats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    chats = (
        db.query(Chat)
        .filter(Chat.user_id == current_user.id)
        .order_by(Chat.updated_at.desc())
        .all()
    )

    return [
        {
            "id": chat.id,
            "title": chat.title,
            "created_at": chat.created_at,
            "updated_at": chat.updated_at,
        }
        for chat in chats
    ]


@router.get("/attachments/{attachment_id}")
def get_chat_image(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Ảnh chat chỉ thuộc về chủ cuộc trò chuyện.
    attachment = (
        db.query(ChatAttachment)
        .join(
            ChatMessage,
            ChatAttachment.message_id == ChatMessage.id,
        )
        .join(Chat, ChatMessage.chat_id == Chat.id)
        .filter(
            ChatAttachment.id == attachment_id,
            Chat.user_id == current_user.id,
        )
        .first()
    )

    if not attachment:
        raise NotFoundError("Không tìm thấy ảnh.")

    path = image_service.image_path(attachment.storage_key)

    if not path.is_file():
        raise NotFoundError("Không tìm thấy ảnh.")

    return FileResponse(
        path,
        media_type=attachment.content_type,
        filename=attachment.filename,
        content_disposition_type="inline",
        headers={
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/{chat_id}")
def get_chat_history(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    chat = get_owned_chat(db, chat_id, current_user)

    messages = (
        db.query(ChatMessage)
        .options(selectinload(ChatMessage.attachments))
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
            serialize_message(message)
            for message in messages
        ],
    }


def save_chat_turn(
    db,
    current_user,
    question,
    chat_id,
    images,
):
    question = question.strip()

    if not question and images:
        question = (
            "Hãy mô tả và giải thích nội dung các ảnh đính kèm."
        )

    if not question or len(question) > 12000:
        raise BadRequestError(
            "Vui lòng nhập câu hỏi từ 1 đến 12.000 ký tự "
            "hoặc đính kèm ảnh."
        )

    written = []

    try:
        if chat_id is not None:
            chat = get_owned_chat(db, chat_id, current_user)
        else:
            chat = Chat(
                user_id=current_user.id,
                organization_id=current_user.organization_id,
                title=question[:100],
            )
            db.add(chat)
            db.flush()

        history = (
            db.query(ChatMessage)
            .options(selectinload(ChatMessage.attachments))
            .filter(ChatMessage.chat_id == chat.id)
            .order_by(ChatMessage.id.desc())
            .limit(6)
            .all()
        )
        history.reverse()

        conversation = "\n".join(
            f"{message.role}: "
            f"{clean_message_for_history(message.content)}"
            for message in history
        )

        supplied_images = (
            images or image_service.recent_images(history)
        )

        kwargs = {
            "question": question,
            "current_user": current_user,
            "conversation_history": conversation,
        }

        if supplied_images:
            kwargs["images"] = supplied_images

        response = answer(db, **kwargs)

        user_message = ChatMessage(
            chat_id=chat.id,
            role="user",
            content=question,
        )
        assistant_message = ChatMessage(
            chat_id=chat.id,
            role="assistant",
            content=response,
        )

        db.add_all([user_message, assistant_message])
        db.flush()

        image_service.store_images(
            db,
            user_message,
            images,
            written,
        )

        chat.updated_at = datetime.now(timezone.utc).replace(
            tzinfo=None
        )

        db.flush()
        db.expire(user_message, ["attachments"])

        payload = {
            "chat_id": chat.id,
            "question": question,
            "answer": response,
            "user_message": serialize_message(user_message),
            "assistant_message": serialize_message(
                assistant_message
            ),
        }

        db.commit()
        return payload

    except Exception:
        db.rollback()

        for path in written:
            path.unlink(missing_ok=True)

        raise


@router.post("")
def ask_chat(
    data: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return save_chat_turn(
        db,
        current_user,
        data.question,
        data.chat_id,
        [],
    )


@router.post("/with-images")
def ask_chat_with_images(
    question: str = Form(""),
    chat_id: int | None = Form(None),
    images: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        if chat_id is not None:
            get_owned_chat(db, chat_id, current_user)

        prepared = image_service.prepare_images(images)

        return save_chat_turn(
            db,
            current_user,
            question,
            chat_id,
            prepared,
        )

    finally:
        for image in images:
            image.file.close()

@router.delete("/{chat_id}", status_code=204)
def delete_chat(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    chat = get_owned_chat(db, chat_id, current_user)

    attachments = (
        db.query(ChatAttachment)
        .join(
            ChatMessage,
            ChatAttachment.message_id == ChatMessage.id,
        )
        .filter(ChatMessage.chat_id == chat.id)
        .all()
    )

    paths = [
        image_service.image_path(attachment.storage_key)
        for attachment in attachments
    ]

    try:
        db.delete(chat)
        db.commit()
    except Exception:
        db.rollback()
        raise

    # Chỉ dọn tệp sau khi xóa dữ liệu thành công.
    for path in paths:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            logging.getLogger(__name__).warning(
                "Không thể dọn một tệp ảnh của cuộc chat đã xóa.",
                exc_info=True,
            )

    return Response(status_code=204)