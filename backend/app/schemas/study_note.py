from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class StudyNoteContent(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1, max_length=50000)


class StudyNoteCreate(StudyNoteContent):
    document_id: int = Field(gt=0)
    source_version: int = Field(gt=0)


class StudyNoteRead(StudyNoteContent):
    model_config = ConfigDict(from_attributes=True)

    id: int
    document_id: int | None
    source_version: int
    reviewed_version: int
    created_at: datetime
    updated_at: datetime