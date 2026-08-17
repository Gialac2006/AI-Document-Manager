from pydantic import BaseModel, EmailStr, Field

from app.schemas.user import UserRead


# Schema yêu cầu đăng ký người dùng
class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    organization_name: str | None = Field(
        default=None,
        max_length=255,
        description="Nếu có: tạo tổ chức mới, người đăng ký trở thành manager. Nếu trống: tài khoản cá nhân (individual).",
    )


# Schema yêu cầu đăng nhập
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# Schema yêu cầu đặt lại mật khẩu
class ForgotPasswordRequest(BaseModel):
    email: EmailStr


# Schema phản hồi yêu cầu đặt lại mật khẩu
class ForgotPasswordResponse(BaseModel):
    detail: str
    reset_token: str | None = None
    reset_url: str | None = None


# Schema yêu cầu đặt mật khẩu mới
class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


# Schema token truy cập
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# Schema phản hồi đăng nhập/đăng ký
class AuthResponse(BaseModel):
    user: UserRead
    token: Token
