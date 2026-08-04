from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_manager
from app.core.exceptions import DuplicateError, ForbiddenError, NotFoundError
from app.core.security import hash_password
from app.database.connection import get_db
from app.models.user import User, UserRole
from app.repositories import user_repository
from app.schemas.user import UserCreate, UserRead

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserRead])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    if current_user.role == UserRole.SUPER_ADMIN:
        users = user_repository.list_users(db)
    else:
        users = user_repository.list_users(
            db, organization_id=current_user.organization_id
        )
    return users


@router.post("", response_model=UserRead, status_code=201)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    if user_repository.get_by_email(db, data.email):
        raise DuplicateError("Email đã được đăng ký")

    if current_user.role == UserRole.SUPER_ADMIN:
        organization_id = data.organization_id
        role = data.role
        if role in (UserRole.STAFF, UserRole.MANAGER) and organization_id is None:
            raise ForbiddenError("Nhân viên/quản lý phải thuộc một tổ chức")
    else:
        role = UserRole.STAFF
        organization_id = current_user.organization_id

    user = user_repository.create(
        db,
        full_name=data.full_name.strip(),
        email=data.email,
        hashed_password=hash_password(data.password),
        role=role,
        organization_id=organization_id,
    )
    return user


@router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    user = user_repository.get_by_id(db, user_id)
    if not user:
        raise NotFoundError("Người dùng không tồn tại")
    if user.id == current_user.id:
        raise ForbiddenError("Không thể xoá chính mình")

    if current_user.role == UserRole.SUPER_ADMIN:
        pass
    else:
        if user.organization_id != current_user.organization_id:
            raise ForbiddenError("Chỉ được xoá nhân viên trong tổ chức của mình")
        if user.role != UserRole.STAFF:
            raise ForbiddenError("Quản lý chỉ được xoá nhân viên")

    db.delete(user)
    db.commit()
