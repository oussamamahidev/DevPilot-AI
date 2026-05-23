from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ChatQueryRequest(BaseModel):
    question: str = Field(min_length=1)
    retrieval_strategy: Literal["semantic", "keyword", "hybrid"] = "hybrid"
    conversation_id: UUID | None = None

    @field_validator("question")
    @classmethod
    def normalize_question(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Question is required")
        return normalized


class CitationResponse(BaseModel):
    id: int
    document_id: UUID
    filename: str
    chunk_id: UUID
    chunk_index: int
    score: float


class AnswerEvaluationResponse(BaseModel):
    faithfulness: float
    relevance: float
    context_precision: float
    hallucination_score: float
    explanation: str


class MessageEvaluationResponse(AnswerEvaluationResponse):
    id: UUID
    message_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChatQueryResponse(BaseModel):
    answer: str
    citations: list[CitationResponse]
    conversation_id: UUID
    message_id: UUID
    evaluation: AnswerEvaluationResponse


class ConversationSummaryResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    user_id: UUID | None
    title: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConversationMessageResponse(BaseModel):
    id: UUID
    role: str
    content: str
    created_at: datetime
    citations: list[CitationResponse] = Field(default_factory=list)


class ConversationDetailResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    user_id: UUID | None
    title: str | None
    created_at: datetime
    updated_at: datetime
    messages: list[ConversationMessageResponse] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
