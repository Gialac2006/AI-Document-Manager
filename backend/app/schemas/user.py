from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole


# Schema trả về thông tin người dùng
class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: EmailStr
    role: str
    organization_id: int | None = None
    created_at: datetime


# Schema yêu cầu tạo người dùng
class UserCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: str = Field(default=UserRole.STAFF)
    organization_id: int | None = None


# Schema cập nhật thông tin người dùng
class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
