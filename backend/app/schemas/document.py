from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


DocumentStatus = Literal["uploaded", "queued", "processing", "indexed", "failed", "deleted"]


class DocumentResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    uploaded_by: UUID | None
    filename: str
    file_type: str
    file_size: int
    status: DocumentStatus
    storage_path: str
    created_at: datetime
    processed_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class DocumentStatusResponse(BaseModel):
    id: UUID
    status: DocumentStatus
