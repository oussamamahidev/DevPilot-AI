from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class RetrievalRequest(BaseModel):
    query: str = Field(min_length=1)
    top_k: int = Field(default=5, ge=1, le=20)
    strategy: str = "hybrid"

    @field_validator("query")
    @classmethod
    def normalize_query(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Query is required")
        return normalized

    @field_validator("strategy")
    @classmethod
    def normalize_strategy(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"semantic", "keyword", "hybrid"}:
            raise ValueError("Strategy must be one of: semantic, keyword, hybrid")
        return normalized


class RetrievedChunkResponse(BaseModel):
    chunk_id: UUID
    document_id: UUID
    filename: str
    content: str
    chunk_index: int
    score: float
    retrieval_strategy: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
