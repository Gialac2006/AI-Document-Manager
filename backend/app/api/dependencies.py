from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import decode_access_token
from app.database.connection import get_db
from app.models.user import User, UserRole
from app.repositories import user_repository

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise UnauthorizedError("Chưa đăng nhập")
    payload = decode_access_token(credentials.credentials)
    if not payload or "sub" not in payload:
        raise UnauthorizedError("Token không hợp lệ hoặc đã hết hạn")
    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError):
        raise UnauthorizedError("Token không hợp lệ hoặc đã hết hạn")
    user = user_repository.get_by_id(db, user_id)
    if not user:
        raise UnauthorizedError("Người dùng không tồn tại")
    return user


def require_super_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.SUPER_ADMIN:
        raise ForbiddenError("Chỉ admin hệ thống mới được thực hiện")
    return user


def require_manager(user: User = Depends(get_current_user)) -> User:
    if user.role not in (UserRole.MANAGER, UserRole.SUPER_ADMIN):
        raise ForbiddenError("Chỉ quản lý hoặc admin hệ thống mới được thực hiện")
    return user
