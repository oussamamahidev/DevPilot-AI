from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.agents.rag import AgenticRAGWorkflow
from app.models.conversation import (
    AgentRun,
    Conversation,
    Evaluation,
    LLMUsage,
    Message,
    RetrievedChunk,
)
from app.models.document import Chunk
from app.models.user import User
from app.models.workspace import Workspace
from app.providers.ollama_provider import OllamaLLMProvider
from app.services.evaluation_service import evaluate_answer
from app.services.reranking_service import rerank
from app.services.retrieval_service import retrieve_chunks


class ConversationNotFoundError(RuntimeError):
    pass


async def query_chat(
    db: AsyncSession,
    workspace: Workspace,
    user: User,
    question: str,
    conversation_id: UUID | None = None,
) -> dict[str, object]:
    conversation = await _get_or_create_conversation(
        db=db,
        workspace=workspace,
        user=user,
        question=question,
        conversation_id=conversation_id,
    )
    user_message = Message(
        conversation_id=conversation.id,
        role="user",
        content=question,
    )
    conversation.updated_at = datetime.now(UTC)
    db.add(user_message)
    await db.commit()

    assistant_message = Message(
        conversation_id=conversation.id,
        role="assistant",
        content="",
    )
    conversation.updated_at = datetime.now(UTC)
    db.add(assistant_message)
    await db.flush()

    def log_agent_run(
        agent_type: str,
        input_payload: dict[str, object],
        output_payload: dict[str, object] | None,
        latency_ms: int | None,
        status: str,
    ) -> None:
        db.add(
            AgentRun(
                message_id=assistant_message.id,
                agent_type=agent_type,
                status=status,
                input=input_payload,
                output=output_payload,
                latency_ms=latency_ms,
            )
        )

    workflow = AgenticRAGWorkflow(
        retriever=retrieve_chunks,
        reranker=rerank,
        llm_provider_factory=OllamaLLMProvider,
        evaluator=evaluate_answer,
        run_logger=log_agent_run,
    )
    workflow_result = await workflow.run(
        db=db,
        workspace_id=workspace.id,
        question=question,
    )

    assistant_message.content = workflow_result.final_answer
    prompt_chunks = workflow_result.retrieved_chunks
    citations = _build_citations(prompt_chunks)

    for rank, chunk in enumerate(prompt_chunks, start=1):
        db.add(
            RetrievedChunk(
                message_id=assistant_message.id,
                chunk_id=chunk["chunk_id"],
                score=float(chunk["score"]),
                rank=rank,
                retrieval_strategy=workflow_result.retrieval_strategy,
            )
        )

    db.add(
        LLMUsage(
            message_id=assistant_message.id,
            provider="ollama",
            model=workflow_result.llm_response.model,
            prompt_tokens=workflow_result.llm_response.prompt_tokens,
            completion_tokens=workflow_result.llm_response.completion_tokens,
            total_tokens=workflow_result.llm_response.total_tokens,
            latency_ms=workflow_result.llm_response.latency_ms,
        )
    )

    evaluation = workflow_result.evaluation
    db.add(
        Evaluation(
            message_id=assistant_message.id,
            faithfulness=evaluation["faithfulness"],
            relevance=evaluation["relevance"],
            context_precision=evaluation["context_precision"],
            hallucination_score=evaluation["hallucination_score"],
            explanation=evaluation["explanation"],
        )
    )
    await db.commit()

    return {
        "answer": workflow_result.final_answer,
        "citations": citations,
        "conversation_id": conversation.id,
        "message_id": assistant_message.id,
        "evaluation": evaluation,
    }


async def list_workspace_conversations(
    db: AsyncSession,
    workspace_id: UUID,
) -> list[Conversation]:
    result = await db.scalars(
        select(Conversation)
        .where(Conversation.workspace_id == workspace_id)
        .order_by(Conversation.updated_at.desc(), Conversation.created_at.desc())
    )
    return list(result.all())


async def get_conversation_detail(
    db: AsyncSession,
    conversation_id: UUID,
    workspace_id: UUID,
) -> dict[str, object]:
    conversation = await db.scalar(
        select(Conversation)
        .where(
            Conversation.id == conversation_id,
            Conversation.workspace_id == workspace_id,
        )
        .options(
            selectinload(Conversation.messages)
            .selectinload(Message.retrieved_chunks)
            .selectinload(RetrievedChunk.chunk)
            .selectinload(Chunk.document)
        )
    )
    if conversation is None:
        raise ConversationNotFoundError("Conversation not found or access denied")

    messages = sorted(conversation.messages, key=lambda message: message.created_at)
    return {
        "id": conversation.id,
        "workspace_id": conversation.workspace_id,
        "user_id": conversation.user_id,
        "title": conversation.title,
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at,
        "messages": [
            {
                "id": message.id,
                "role": message.role,
                "content": message.content,
                "created_at": message.created_at,
                "citations": _citations_from_retrieved_chunks(message.retrieved_chunks),
            }
            for message in messages
        ],
        "metadata": {},
    }


async def get_conversation_workspace_id(
    db: AsyncSession,
    conversation_id: UUID,
) -> UUID | None:
    return await db.scalar(
        select(Conversation.workspace_id).where(Conversation.id == conversation_id)
    )


async def _get_or_create_conversation(
    db: AsyncSession,
    workspace: Workspace,
    user: User,
    question: str,
    conversation_id: UUID | None,
) -> Conversation:
    if conversation_id is not None:
        conversation = await db.scalar(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.workspace_id == workspace.id,
            )
        )
        if conversation is None:
            raise ConversationNotFoundError("Conversation not found or access denied")
        return conversation

    conversation = Conversation(
        workspace_id=workspace.id,
        user_id=user.id,
        title=_title_from_question(question),
    )
    db.add(conversation)
    await db.flush()
    return conversation


def _title_from_question(question: str) -> str:
    normalized = " ".join(question.split())
    return normalized[:80] if normalized else "New conversation"


def _build_user_prompt(
    question: str,
    retrieved_chunks: list[dict[str, object]],
) -> str:
    context = _build_context(retrieved_chunks)
    return f"""Context:
{context}

Question:
{question}

Answer:"""


def _build_context(retrieved_chunks: list[dict[str, object]]) -> str:
    if not retrieved_chunks:
        return "No retrieved context was available."

    blocks: list[str] = []
    for citation_id, chunk in enumerate(retrieved_chunks, start=1):
        blocks.append(
            f"""[{citation_id}] Source: {chunk["filename"]} | Chunk: {chunk["chunk_index"]}
Content:
{chunk["content"]}"""
        )
    return "\n\n".join(blocks)


def _build_citations(retrieved_chunks: list[dict[str, object]]) -> list[dict[str, object]]:
    return [
        {
            "id": citation_id,
            "document_id": chunk["document_id"],
            "filename": chunk["filename"],
            "chunk_id": chunk["chunk_id"],
            "chunk_index": chunk["chunk_index"],
            "score": chunk["score"],
        }
        for citation_id, chunk in enumerate(retrieved_chunks, start=1)
    ]


def _citations_from_retrieved_chunks(
    retrieved_chunks: list[RetrievedChunk],
) -> list[dict[str, object]]:
    citations: list[dict[str, object]] = []
    for retrieved_chunk in sorted(retrieved_chunks, key=lambda item: item.rank):
        chunk = retrieved_chunk.chunk
        document = chunk.document
        citations.append(
            {
                "id": retrieved_chunk.rank,
                "document_id": chunk.document_id,
                "filename": document.filename,
                "chunk_id": chunk.id,
                "chunk_index": chunk.chunk_index,
                "score": retrieved_chunk.score,
            }
        )
    return citations
