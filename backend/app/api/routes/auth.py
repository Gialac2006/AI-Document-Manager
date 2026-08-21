from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.exceptions import DuplicateError, TooManyRequestsError, UnauthorizedError
from app.core.rate_limit import RateLimiter
from app.core.security import hash_password
from app.database.connection import get_db
from app.models.user import User
from app.repositories import user_repository
from app.schemas.auth import (
    AuthResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
)
from app.schemas.user import UserRead, UserUpdate
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

login_limiter = RateLimiter(max_attempts=5, window_seconds=60)
register_limiter = RateLimiter(max_attempts=5, window_seconds=3600)
forgot_limiter = RateLimiter(max_attempts=5, window_seconds=300)
reset_limiter = RateLimiter(max_attempts=5, window_seconds=300)


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


# Đăng ký tài khoản mới và trả về token đăng nhập
@router.post("/register", response_model=AuthResponse, status_code=201)
def register(
    data: RegisterRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    key = _client_ip(request)
    if register_limiter.is_blocked(key):
        raise TooManyRequestsError()
    register_limiter.hit(key)
    user, token = auth_service.register(db, data)
    return AuthResponse(user=UserRead.model_validate(user), token=token)


# Đăng nhập với kiểm tra giới hạn số lần thử và trả về token
@router.post("/login", response_model=AuthResponse)
def login(
    data: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    key = f"{data.email.strip().lower()}|{_client_ip(request)}"
    if login_limiter.is_blocked(key):
        raise TooManyRequestsError()
    try:
        user = auth_service.authenticate(db, data)
    except UnauthorizedError:
        login_limiter.hit(key)
        raise
    login_limiter.reset(key)
    token = auth_service.issue_token(user)
    return AuthResponse(user=UserRead.model_validate(user), token=token)


# Xem thông tin người dùng hiện tại
@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)):
    return current_user


# Cập nhật thông tin cá nhân của người dùng hiện tại
@router.put("/me", response_model=UserRead)
def update_me(
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.email and data.email.strip().lower() != current_user.email.lower():
        if user_repository.get_by_email(db, data.email.strip().lower()):
            raise DuplicateError("Email đã được sử dụng")

    user = user_repository.update(
        db,
        current_user,
        full_name=data.full_name,
        email=data.email.lower() if data.email else None,
        hashed_password=hash_password(data.password) if data.password else None,
    )
    return user


# Gửi yêu cầu khôi phục mật khẩu qua email
@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(
    data: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    key = f"{data.email.strip().lower()}|{_client_ip(request)}"
    if forgot_limiter.is_blocked(key):
        raise TooManyRequestsError()
    forgot_limiter.hit(key)
    return auth_service.request_password_reset(db, data.email)


# Kiểm tra token khôi phục mật khẩu còn hợp lệ hay không
@router.get("/reset-password/validate")
def validate_reset_password(token: str, db: Session = Depends(get_db)):
    return {"valid": auth_service.validate_reset_token(db, token)}


# Đặt lại mật khẩu mới bằng token khôi phục
@router.post("/reset-password")
def reset_password(
    data: ResetPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    key = _client_ip(request)
    if reset_limiter.is_blocked(key):
        raise TooManyRequestsError()
    reset_limiter.hit(key)
    auth_service.reset_password(db, data.token, data.new_password)
    return {"detail": "Mật khẩu đã được đặt lại. Vui lòng đăng nhập."}
