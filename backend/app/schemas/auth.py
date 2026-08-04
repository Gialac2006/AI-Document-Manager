from pydantic import BaseModel, EmailStr, Field

from app.schemas.user import UserRead


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    organization_name: str | None = Field(
        default=None,
        max_length=255,
        description="Nếu có: tạo tổ chức mới, người đăng ký trở thành manager. Nếu trống: tài khoản cá nhân (individual).",
    )


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    detail: str
    reset_token: str | None = None
    reset_url: str | None = None


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=6, max_length=128)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AuthResponse(BaseModel):
    user: UserRead
    token: Token
