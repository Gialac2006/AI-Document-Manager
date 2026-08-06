from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.exceptions import ForbiddenError, NotFoundError
from app.database.connection import get_db
from app.models.user import User, UserRole
from app.repositories import document_repository
from app.schemas.document import (
    DocumentRead,
    DocumentUpdate,
    DocumentVersionRead,
)
from app.services import document_service, storage_service

router = APIRouter(prefix="/documents", tags=["documents"])


def _guard_delete(user: User) -> None:
    if user.role == UserRole.STAFF:
        raise ForbiddenError("Nhân viên không được xoá tài liệu")


@router.get("", response_model=list[DocumentRead])
def list_documents(
    folder_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return document_service.list_documents(
        db, current_user=current_user, folder_id=folder_id
    )


@router.post("", response_model=DocumentRead, status_code=201)
def upload_document(
    file: UploadFile = File(...),
    title: str = Form(""),
    folder_id: int | None = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return document_service.create_document(
        db,
        file=file,
        title=title,
        folder_id=folder_id,
        current_user=current_user,
    )


@router.get("/{document_id}", response_model=DocumentRead)
def get_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return document_service.get_document(
        db, document_id=document_id, current_user=current_user
    )


@router.put("/{document_id}", response_model=DocumentRead)
def update_document(
    document_id: int,
    data: DocumentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = document_service.get_document(
        db, document_id=document_id, current_user=current_user
    )
    return document_service.update_document(
        db,
        document=document,
        title=data.title,
        folder_id=data.folder_id,
        current_user=current_user,
    )


@router.delete("/{document_id}", status_code=204)
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _guard_delete(current_user)
    document = document_service.get_document(
        db, document_id=document_id, current_user=current_user
    )
    document_service.delete_document(db, document=document)


@router.get("/{document_id}/download")
def download_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = document_service.get_document(
        db, document_id=document_id, current_user=current_user
    )
    full_path = storage_service.get_full_path(document.file_path)
    if not full_path.exists():
        raise NotFoundError("File không còn tồn tại trên máy chủ")
    return FileResponse(str(full_path), filename=document.file_name)


@router.get("/{document_id}/versions", response_model=list[DocumentVersionRead])
def list_versions(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document_service.get_document(
        db, document_id=document_id, current_user=current_user
    )
    return document_repository.list_versions(db, document_id)