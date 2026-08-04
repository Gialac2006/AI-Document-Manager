from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import UserRead


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class OrganizationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    created_at: datetime


class OrganizationDetail(OrganizationRead):
    members: list[UserRead] = []
