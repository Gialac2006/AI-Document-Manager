import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import BadRequestError, DuplicateError, UnauthorizedError
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User, UserRole
from app.repositories import (
    organization_repository,
    password_reset_repository,
    user_repository,
)
from app.schemas.auth import LoginRequest, RegisterRequest, Token


# Đăng ký tài khoản cá nhân hoặc tạo tổ chức mới
def register(db: Session, data: RegisterRequest) -> tuple[User, Token]:
    if user_repository.get_by_email(db, data.email):
        raise DuplicateError("Email đã được đăng ký")

    hashed = hash_password(data.password)

    if data.organization_name:
        if organization_repository.get_by_name(db, data.organization_name):
            raise DuplicateError("Tên tổ chức đã tồn tại")
        organization = organization_repository.create(
            db, name=data.organization_name.strip()
        )
        user = user_repository.create(
            db,
            full_name=data.full_name.strip(),
            email=data.email,
            hashed_password=hashed,
            role=UserRole.MANAGER,
            organization_id=organization.id,
        )
    else:
        user = user_repository.create(
            db,
            full_name=data.full_name.strip(),
            email=data.email,
            hashed_password=hashed,
            role=UserRole.INDIVIDUAL,
        )

    token = _build_token(user)
    return user, token


# Xác thực email và mật khẩu khi đăng nhập
def authenticate(db: Session, data: LoginRequest) -> User:
    user = user_repository.get_by_email(db, data.email)
    if not user or not verify_password(data.password, user.hashed_password):
        raise UnauthorizedError("Email hoặc mật khẩu không đúng")
    return user


# Cấp token truy cập cho người dùng
def issue_token(user: User) -> Token:
    return _build_token(user)


# Tạo token đặt lại mật khẩu cho email yêu cầu
def request_password_reset(db: Session, email: str) -> dict:
    detail = "Nếu email tồn tại, bạn sẽ nhận được link đặt lại mật khẩu"
    user = user_repository.get_by_email(db, email)
    if not user:
        return {"detail": detail, "reset_token": None, "reset_url": None}

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.reset_token_expire_minutes
    )
    password_reset_repository.create(
        db, token=token, user_id=user.id, expires_at=expires_at
    )

    if settings.is_production:
        if settings.email_enabled:
            # TODO: gửi email thật qua SMTP khi có cấu hình
            pass
        return {"detail": detail, "reset_token": None, "reset_url": None}

    reset_url = f"{settings.frontend_url}/reset-password?token={token}"
    return {
        "detail": "Chế độ dev: dùng link bên dưới để đặt lại mật khẩu",
        "reset_token": token,
        "reset_url": reset_url,
    }


# Kiểm tra token đặt lại mật khẩu còn hợp lệ
def validate_reset_token(db: Session, token: str) -> bool:
    return password_reset_repository.get_valid_by_token(db, token) is not None


# Đặt mật khẩu mới cho người dùng theo token
def reset_password(db: Session, token: str, new_password: str) -> None:
    record = password_reset_repository.get_valid_by_token(db, token)
    if not record:
        raise BadRequestError("Link không hợp lệ hoặc đã hết hạn")

    user = db.get(User, record.user_id)
    if not user:
        raise BadRequestError("Người dùng không tồn tại")

    user.hashed_password = hash_password(new_password)
    password_reset_repository.mark_used(db, record)


# Tạo token JWT kèm vai trò và tổ chức của người dùng
def _build_token(user: User) -> Token:
    extra = {
        "role": user.role,
        "organization_id": user.organization_id,
    }
    return Token(
        access_token=create_access_token(subject=str(user.id), extra=extra)
    )
