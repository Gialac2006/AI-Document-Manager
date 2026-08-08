from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.exceptions import DuplicateError
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


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    user, token = auth_service.register(db, data)
    return AuthResponse(user=UserRead.model_validate(user), token=token)


@router.post("/login", response_model=AuthResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = auth_service.authenticate(db, data)
    token = auth_service.issue_token(user)
    return AuthResponse(user=UserRead.model_validate(user), token=token)


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserRead)
def update_me(
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.email and data.email.lower() != current_user.email.lower():
        if user_repository.get_by_email(db, data.email):
            raise DuplicateError("Email đã được sử dụng")

    user = user_repository.update(
        db,
        current_user,
        full_name=data.full_name,
        email=data.email.lower() if data.email else None,
        hashed_password=hash_password(data.password) if data.password else None,
    )
    return user


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    return auth_service.request_password_reset(db, data.email)


@router.get("/reset-password/validate")
def validate_reset_password(token: str, db: Session = Depends(get_db)):
    return {"valid": auth_service.validate_reset_token(db, token)}


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    auth_service.reset_password(db, data.token, data.new_password)
    return {"detail": "Mật khẩu đã được đặt lại. Vui lòng đăng nhập."}
