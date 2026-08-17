from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field
from typing import Literal


# Schema yêu cầu phê duyệt tài liệu
class ApprovalRequest(BaseModel):
    decision: Literal["approved", "rejected"]
    reason: str | None = Field(default=None, max_length=1000)


# Schema trả về thông tin phê duyệt tài liệu
class ApprovalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    document_id: int
    reviewer_id: int
    decision: str
    reason: str | None
    created_at: datetime


# Schema trả về log lịch sử hành động
class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int | None
    action: str
    entity_type: str | None
    entity_id: int | None
    details: str | None
    created_at: datetime