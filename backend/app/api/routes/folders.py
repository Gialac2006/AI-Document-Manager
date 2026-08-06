from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.exceptions import BadRequestError, ForbiddenError
from app.database.connection import get_db
from app.models.user import User, UserRole
from app.repositories import folder_repository
from app.schemas.folder import FolderCreate, FolderRead, FolderUpdate
from app.services.scope_service import Scope, check_folder_scope

router = APIRouter(prefix="/folders", tags=["folders"])


def _guard_write(user: User) -> None:
    if user.role == UserRole.STAFF:
        raise ForbiddenError("Nhân viên không được tạo/sửa/xoá thư mục")


@router.get("", response_model=list[FolderRead])
def list_folders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scope = Scope(current_user)
    return folder_repository.list_all(
        db, organization_id=scope.organization_id, owner_id=scope.owner_id
    )


@router.post("", response_model=FolderRead, status_code=201)
def create_folder(
    data: FolderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _guard_write(current_user)
    scope = Scope(current_user)
    if data.parent_id is not None:
        parent = check_folder_scope(
            folder_repository.get_by_id(db, data.parent_id), current_user
        )
        if (
            scope.organization_id is not None
            and parent.organization_id != scope.organization_id
        ):
            raise BadRequestError("Không thể tạo thư mục con trong thư mục khác tổ chức")
    return folder_repository.create(
        db,
        name=data.name,
        parent_id=data.parent_id,
        organization_id=scope.organization_id,
        owner_id=scope.owner_id,
    )


@router.put("/{folder_id}", response_model=FolderRead)
def rename_folder(
    folder_id: int,
    data: FolderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _guard_write(current_user)
    folder = check_folder_scope(
        folder_repository.get_by_id(db, folder_id), current_user
    )
    return folder_repository.rename(db, folder, data.name)


@router.delete("/{folder_id}", status_code=204)
def delete_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _guard_write(current_user)
    folder = check_folder_scope(
        folder_repository.get_by_id(db, folder_id), current_user
    )
    folder_repository.delete(db, folder)