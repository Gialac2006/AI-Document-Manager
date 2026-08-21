from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# Schema trả về thông tin tài liệu
class DocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    file_name: str
    file_type: str | None = None
    folder_id: int | None = None
    organization_id: int | None = None
    owner_id: int | None = None
    status: str
    processing_status: str = "uploaded"
    processing_error: str | None = None
    current_version: int
    created_at: datetime
    updated_at: datetime
    access_level: str = "view"


# Schema cập nhật thông tin tài liệu
class DocumentUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    folder_id: int | None = None


# Schema trả về thông tin phiên bản tài liệu
class DocumentVersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    version: int
    file_name: str
    created_by: int | None = None
    created_at: datetime