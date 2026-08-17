from pydantic import BaseModel, ConfigDict, Field
from typing import Literal
from datetime import datetime


AccessLevelLiteral = Literal["view", "edit", "admin"]


# Schema yêu cầu cấp quyền truy cập tài liệu
class PermissionCreate(BaseModel):
    user_id: int
    access_level: AccessLevelLiteral


# Schema trả về thông tin quyền truy cập
class PermissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    document_id: int
    user_id: int
    access_level: str
    created_at: datetime
    user_full_name: str | None = None
    user_email: str | None = None