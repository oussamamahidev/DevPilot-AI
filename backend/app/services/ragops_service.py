from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import PurePosixPath
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from qdrant_client.http import models
from sqlalchemy import desc, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.models.conversation import (
    AgentRun,
    Conversation,
    Evaluation,
    LLMUsage,
    Message,
    RetrievedChunk,
)
from app.models.document import Chunk, Document
from app.models.user import User
from app.models.workspace import Workspace
from app.services import vector_store_service


RECENT_LIMIT = 10
RETRY_STUCK_THRESHOLD = timedelta(minutes=30)
DOCUMENT_RETRY_AUDIT_ACTION = "DOCUMENT_RETRY_REQUESTED"


async def list_workspace_summaries(db: AsyncSession) -> list[dict[str, object]]:
    workspace_rows = await db.execute(
        select(
            Workspace.id,
            Workspace.name,
            User.email.label("owner_email"),
        )
        .join(User, User.id == Workspace.owner_id)
        .order_by(desc(Workspace.updated_at))
    )
    workspaces = list(workspace_rows.all())
    if not workspaces:
        return []

    status_counts = await _workspace_document_status_counts(db)
    chunk_stats = await _workspace_chunk_stats(db)
    last_uploaded = await _workspace_last_document_uploaded_at(db)
    last_indexed = await _workspace_last_document_indexed_at(db)

    summaries: list[dict[str, object]] = []
    for row in workspaces:
        counts = status_counts.get(row.id, {})
        stats = chunk_stats.get(row.id, _empty_chunk_stats())
        summaries.append(
            _build_workspace_summary(
                workspace_id=row.id,
                workspace_name=row.name,
                owner_email=row.owner_email,
                counts=counts,
                chunk_stats=stats,
                last_document_uploaded_at=last_uploaded.get(row.id),
                last_document_indexed_at=last_indexed.get(row.id),
            )
        )
    return summaries


async def get_workspace_detail(db: AsyncSession, workspace_id: UUID) -> dict[str, object]:
    workspace_row = (
        await db.execute(
            select(
                Workspace.id,
                Workspace.name,
                Workspace.description,
                Workspace.created_at,
                Workspace.updated_at,
                User.id.label("owner_id"),
                User.email.label("owner_email"),
                User.full_name.label("owner_full_name"),
            )
            .join(User, User.id == Workspace.owner_id)
            .where(Workspace.id == workspace_id)
        )
    ).one_or_none()
    if workspace_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    status_counts = await _document_status_counts_for_workspace(db, workspace_id)
    chunk_stats = await _chunk_stats_for_workspace(db, workspace_id)
    summary = _build_workspace_summary(
        workspace_id=workspace_row.id,
        workspace_name=workspace_row.name,
        owner_email=workspace_row.owner_email,
        counts=status_counts,
        chunk_stats=chunk_stats,
        last_document_uploaded_at=await _last_document_uploaded_at(db, workspace_id),
        last_document_indexed_at=await _last_document_indexed_at(db, workspace_id),
    )
    chunking_summary = await _chunking_summary_for_workspace(db, workspace_id, chunk_stats)
    qdrant_summary = await _workspace_qdrant_summary(
        workspace_id=workspace_id,
        expected_chunks_count=int(chunk_stats["total_chunks"]),
        postgres_vector_id_count=int(chunk_stats["chunks_with_vector_id"]),
    )

    return {
        "workspace": {
            "id": workspace_row.id,
            "name": workspace_row.name,
            "description": workspace_row.description,
            "created_at": workspace_row.created_at,
            "updated_at": workspace_row.updated_at,
        },
        "owner": {
            "id": workspace_row.owner_id,
            "email": workspace_row.owner_email,
            "full_name": workspace_row.owner_full_name,
        },
        "summary": summary,
        "document_status_distribution": status_counts,
        "chunking_summary": chunking_summary,
        "embedding_summary": {
            "total_chunks": int(chunk_stats["total_chunks"]),
            "chunks_with_vector_id": int(chunk_stats["chunks_with_vector_id"]),
            "chunks_missing_vector_id": int(chunk_stats["chunks_missing_vector_id"]),
            "embedding_coverage_percent": float(chunk_stats["embedding_coverage_percent"]),
        },
        "qdrant_summary": qdrant_summary,
        "recent_ingestion_jobs": await _recent_ingestion_jobs(db, workspace_id),
        "recent_failed_documents": await _recent_failed_documents(db, workspace_id),
        "recent_rag_queries": await _recent_rag_queries(db, workspace_id),
        "average_evaluation_scores": await _average_evaluation_scores(db, workspace_id),
        "average_agent_latency_by_agent_type": await _average_agent_latency(db, workspace_id),
    }


async def get_document_pipeline(db: AsyncSession, document_id: UUID) -> dict[str, object]:
    row = (
        await db.execute(
            select(
                Document.id,
                Document.workspace_id,
                Workspace.name.label("workspace_name"),
                Document.filename,
                Document.file_type,
                Document.file_size,
                Document.status,
                Document.storage_path,
                Document.created_at,
                Document.processed_at,
                User.email.label("uploader_email"),
                func.count(Chunk.id).label("chunks_count"),
                func.count(Chunk.vector_id).label("chunks_with_vector_id"),
                func.avg(func.length(Chunk.content)).label("average_chunk_length"),
                func.min(func.length(Chunk.content)).label("min_chunk_length"),
                func.max(func.length(Chunk.content)).label("max_chunk_length"),
            )
            .join(Workspace, Workspace.id == Document.workspace_id)
            .outerjoin(User, User.id == Document.uploaded_by)
            .outerjoin(Chunk, Chunk.document_id == Document.id)
            .where(Document.id == document_id)
            .group_by(Document.id, Workspace.name, User.email)
        )
    ).one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    chunks_count = int(row.chunks_count or 0)
    chunks_with_vector_id = int(row.chunks_with_vector_id or 0)
    chunks_missing_vector_id = max(chunks_count - chunks_with_vector_id, 0)
    coverage = _coverage_percent(chunks_with_vector_id, chunks_count)
    qdrant_indexed = row.status == "indexed" and chunks_missing_vector_id == 0
    retry_allowed = _retry_allowed(
        status_value=row.status,
        created_at=row.created_at,
        now=datetime.now(UTC),
    )
    states = _document_pipeline_states(
        status_value=row.status,
        created_at=row.created_at,
        processed_at=row.processed_at,
        chunks_count=chunks_count,
        chunks_missing_vector_id=chunks_missing_vector_id,
        qdrant_indexed=qdrant_indexed,
    )

    return {
        "document_id": row.id,
        "workspace_id": row.workspace_id,
        "workspace_name": row.workspace_name,
        "filename": row.filename,
        "uploader_email": row.uploader_email,
        "upload_state": states["upload_state"],
        "extraction_state": states["extraction_state"],
        "chunking_state": states["chunking_state"],
        "embedding_state": states["embedding_state"],
        "vector_indexing_state": states["vector_indexing_state"],
        "indexed_state": states["indexed_state"],
        "pipeline_steps": [
            states["upload_state"],
            states["extraction_state"],
            states["chunking_state"],
            states["embedding_state"],
            states["vector_indexing_state"],
            states["indexed_state"],
        ],
        "file_type": row.file_type,
        "file_size": row.file_size,
        "status": row.status,
        "storage_path": _mask_storage_path(row.storage_path),
        "created_at": row.created_at,
        "processed_at": row.processed_at,
        "processing_duration_seconds": _duration_seconds(row.created_at, row.processed_at),
        "chunks_count": chunks_count,
        "chunks_with_vector_id": chunks_with_vector_id,
        "chunks_missing_vector_id": chunks_missing_vector_id,
        "embedding_coverage_percent": coverage,
        "average_chunk_length": _float_or_zero(row.average_chunk_length),
        "min_chunk_length": int(row.min_chunk_length or 0),
        "max_chunk_length": int(row.max_chunk_length or 0),
        "qdrant_indexed": qdrant_indexed,
        "retry_allowed": retry_allowed,
        "errors": _document_pipeline_errors(
            status_value=row.status,
            chunks_count=chunks_count,
            chunks_missing_vector_id=chunks_missing_vector_id,
        ),
    }


async def list_document_chunks(
    db: AsyncSession,
    document_id: UUID,
    *,
    actor: User,
    include_content: bool = False,
    limit: int = 50,
    offset: int = 0,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> dict[str, object]:
    if include_content and actor.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super_admin can include full chunk content",
        )

    document_exists = await db.scalar(select(Document.id).where(Document.id == document_id))
    if document_exists is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    total = await db.scalar(select(func.count(Chunk.id)).where(Chunk.document_id == document_id))
    rows = await db.execute(
        select(
            Chunk.id,
            Chunk.chunk_index,
            Chunk.content,
            Chunk.token_count,
            Chunk.metadata_.label("metadata_value"),
            Chunk.vector_id,
            Chunk.created_at,
        )
        .where(Chunk.document_id == document_id)
        .order_by(Chunk.chunk_index)
        .offset(offset)
        .limit(limit)
    )

    chunks = []
    for row in rows.all():
        content = row.content or ""
        chunks.append(
            {
                "chunk_id": row.id,
                "chunk_index": row.chunk_index,
                "content_preview": _preview(content),
                "content": content if include_content else None,
                "token_count": row.token_count,
                "vector_id_exists": row.vector_id is not None,
                "metadata": dict(row.metadata_value or {}),
                "created_at": row.created_at,
            }
        )

    if include_content:
        db.add(
            AuditLog(
                actor_user_id=actor.id,
                action="FULL_CHUNK_CONTENT_VIEWED",
                target_type="document",
                target_id=document_id,
                metadata_={
                    "document_id": str(document_id),
                    "limit": limit,
                    "offset": offset,
                },
                reason=None,
                ip_address=ip_address,
                user_agent=user_agent,
            )
        )
        await db.commit()

    return {
        "document_id": document_id,
        "total": int(total or 0),
        "limit": limit,
        "offset": offset,
        "include_content": include_content,
        "chunks": chunks,
    }


async def retry_document_processing(
    db: AsyncSession,
    document_id: UUID,
    *,
    actor: User,
    reason: str | None,
    ip_address: str | None,
    user_agent: str | None,
) -> dict[str, object]:
    document = await db.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    now = datetime.now(UTC)
    if not _retry_allowed(status_value=document.status, created_at=document.created_at, now=now):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Retry is allowed only for failed documents or queued/processing documents "
                f"older than {int(RETRY_STUCK_THRESHOLD.total_seconds() // 60)} minutes"
            ),
        )

    old_status = document.status
    document.status = "queued"
    document.processed_at = None
    db.add(
        AuditLog(
            actor_user_id=actor.id,
            action=DOCUMENT_RETRY_AUDIT_ACTION,
            target_type="document",
            target_id=document.id,
            metadata_={
                "document_id": str(document.id),
                "workspace_id": str(document.workspace_id),
                "filename": document.filename,
                "old_status": old_status,
                "new_status": "queued",
            },
            reason=reason,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    )
    await db.commit()

    from app.workers.document_tasks import process_document_task

    process_document_task.delay(str(document.id))
    return {
        "document_id": document.id,
        "status": document.status,
        "task_enqueued": True,
        "audit_action": DOCUMENT_RETRY_AUDIT_ACTION,
    }


async def get_qdrant_health(db: AsyncSession) -> dict[str, object]:
    chunk_stats = await _global_chunk_stats(db)
    qdrant = vector_store_service.get_qdrant_client()
    collections: list[dict[str, object]] = []

    try:
        collection_response = await qdrant.get_collections()
        collection_names = [
            collection.name
            for collection in getattr(collection_response, "collections", [])
            if getattr(collection, "name", None)
        ]

        configured_vector_count: int | None = None
        configured_indexed_vectors_count: int | None = None
        for collection_name in collection_names:
            collection_info = await qdrant.get_collection(collection_name)
            vector_count = _optional_int(getattr(collection_info, "points_count", None))
            indexed_vectors_count = _optional_int(
                getattr(collection_info, "indexed_vectors_count", None)
            )
            if collection_name == vector_store_service.COLLECTION_NAME:
                configured_vector_count = vector_count
                configured_indexed_vectors_count = indexed_vectors_count
            collections.append(
                {
                    "name": collection_name,
                    "vector_count": vector_count,
                    "indexed_vectors_count": indexed_vectors_count,
                    "status": _qdrant_status_value(getattr(collection_info, "status", None)),
                }
            )

        mismatch_count = None
        if configured_vector_count is not None:
            mismatch_count = abs(int(chunk_stats["postgres_vector_id_count"]) - configured_vector_count)

        return {
            "qdrant_reachable": True,
            "collections": collections,
            "collection_name": vector_store_service.COLLECTION_NAME,
            "vector_count": configured_vector_count,
            "indexed_vectors_count": configured_indexed_vectors_count,
            "expected_chunks_count": int(chunk_stats["expected_chunks_count"]),
            "postgres_vector_id_count": int(chunk_stats["postgres_vector_id_count"]),
            "chunks_missing_vector_id": int(chunk_stats["chunks_missing_vector_id"]),
            "mismatch_count": mismatch_count,
            "error": None,
        }
    except Exception as exc:
        return {
            "qdrant_reachable": False,
            "collections": [],
            "collection_name": vector_store_service.COLLECTION_NAME,
            "vector_count": None,
            "indexed_vectors_count": None,
            "expected_chunks_count": int(chunk_stats["expected_chunks_count"]),
            "postgres_vector_id_count": int(chunk_stats["postgres_vector_id_count"]),
            "chunks_missing_vector_id": int(chunk_stats["chunks_missing_vector_id"]),
            "mismatch_count": None,
            "error": str(exc),
        }
    finally:
        await _close_qdrant_client(qdrant)


async def _workspace_document_status_counts(db: AsyncSession) -> dict[UUID, dict[str, int]]:
    rows = await db.execute(
        select(Document.workspace_id, Document.status, func.count(Document.id))
        .group_by(Document.workspace_id, Document.status)
        .order_by(Document.workspace_id)
    )
    counts: dict[UUID, dict[str, int]] = {}
    for workspace_id, document_status, count in rows.all():
        counts.setdefault(workspace_id, {})[str(document_status)] = int(count or 0)
    return counts


async def _document_status_counts_for_workspace(
    db: AsyncSession,
    workspace_id: UUID,
) -> dict[str, int]:
    rows = await db.execute(
        select(Document.status, func.count(Document.id))
        .where(Document.workspace_id == workspace_id)
        .group_by(Document.status)
        .order_by(Document.status)
    )
    return {str(document_status): int(count or 0) for document_status, count in rows.all()}


async def _workspace_chunk_stats(db: AsyncSession) -> dict[UUID, dict[str, object]]:
    rows = await db.execute(
        select(
            Chunk.workspace_id,
            func.count(Chunk.id).label("total_chunks"),
            func.count(Chunk.vector_id).label("chunks_with_vector_id"),
            func.avg(func.length(Chunk.content)).label("average_chunk_length"),
        )
        .join(Document, Document.id == Chunk.document_id)
        .where(Document.status != "deleted")
        .group_by(Chunk.workspace_id)
    )
    stats: dict[UUID, dict[str, object]] = {}
    for row in rows.all():
        stats[row.workspace_id] = _normalize_chunk_stats(
            total_chunks=row.total_chunks,
            chunks_with_vector_id=row.chunks_with_vector_id,
            average_chunk_length=row.average_chunk_length,
        )
    return stats


async def _chunk_stats_for_workspace(
    db: AsyncSession,
    workspace_id: UUID,
) -> dict[str, object]:
    row = (
        await db.execute(
            select(
                func.count(Chunk.id).label("total_chunks"),
                func.count(Chunk.vector_id).label("chunks_with_vector_id"),
                func.avg(func.length(Chunk.content)).label("average_chunk_length"),
                func.min(func.length(Chunk.content)).label("min_chunk_length"),
                func.max(func.length(Chunk.content)).label("max_chunk_length"),
            )
            .select_from(Chunk)
            .join(Document, Document.id == Chunk.document_id)
            .where(Chunk.workspace_id == workspace_id, Document.status != "deleted")
        )
    ).one()
    stats = _normalize_chunk_stats(
        total_chunks=row.total_chunks,
        chunks_with_vector_id=row.chunks_with_vector_id,
        average_chunk_length=row.average_chunk_length,
    )
    stats["min_chunk_length"] = int(row.min_chunk_length or 0)
    stats["max_chunk_length"] = int(row.max_chunk_length or 0)
    return stats


async def _global_chunk_stats(db: AsyncSession) -> dict[str, int]:
    row = (
        await db.execute(
            select(
                func.count(Chunk.id).label("expected_chunks_count"),
                func.count(Chunk.vector_id).label("postgres_vector_id_count"),
            )
            .select_from(Chunk)
            .join(Document, Document.id == Chunk.document_id)
            .where(Document.status != "deleted")
        )
    ).one()
    expected_chunks_count = int(row.expected_chunks_count or 0)
    postgres_vector_id_count = int(row.postgres_vector_id_count or 0)
    return {
        "expected_chunks_count": expected_chunks_count,
        "postgres_vector_id_count": postgres_vector_id_count,
        "chunks_missing_vector_id": max(expected_chunks_count - postgres_vector_id_count, 0),
    }


async def _workspace_last_document_uploaded_at(db: AsyncSession) -> dict[UUID, datetime]:
    rows = await db.execute(
        select(Document.workspace_id, func.max(Document.created_at)).group_by(Document.workspace_id)
    )
    return {
        workspace_id: uploaded_at
        for workspace_id, uploaded_at in rows.all()
        if uploaded_at is not None
    }


async def _workspace_last_document_indexed_at(db: AsyncSession) -> dict[UUID, datetime]:
    rows = await db.execute(
        select(Document.workspace_id, func.max(Document.processed_at))
        .where(Document.status == "indexed")
        .group_by(Document.workspace_id)
    )
    return {
        workspace_id: indexed_at
        for workspace_id, indexed_at in rows.all()
        if indexed_at is not None
    }


async def _last_document_uploaded_at(db: AsyncSession, workspace_id: UUID) -> datetime | None:
    return await db.scalar(
        select(func.max(Document.created_at)).where(Document.workspace_id == workspace_id)
    )


async def _last_document_indexed_at(db: AsyncSession, workspace_id: UUID) -> datetime | None:
    return await db.scalar(
        select(func.max(Document.processed_at)).where(
            Document.workspace_id == workspace_id,
            Document.status == "indexed",
        )
    )


async def _chunking_summary_for_workspace(
    db: AsyncSession,
    workspace_id: UUID,
    chunk_stats: dict[str, object],
) -> dict[str, object]:
    rows = await db.execute(
        select(
            Document.id,
            func.count(Chunk.id).label("chunks_count"),
        )
        .outerjoin(Chunk, Chunk.document_id == Document.id)
        .where(Document.workspace_id == workspace_id, Document.status != "deleted")
        .group_by(Document.id)
    )
    documents_with_chunks = 0
    documents_without_chunks = 0
    for row in rows.all():
        if int(row.chunks_count or 0) > 0:
            documents_with_chunks += 1
        else:
            documents_without_chunks += 1

    return {
        "total_chunks": int(chunk_stats["total_chunks"]),
        "documents_with_chunks": documents_with_chunks,
        "documents_without_chunks": documents_without_chunks,
        "average_chunk_length": float(chunk_stats["average_chunk_length"]),
        "min_chunk_length": int(chunk_stats.get("min_chunk_length", 0)),
        "max_chunk_length": int(chunk_stats.get("max_chunk_length", 0)),
    }


async def _workspace_qdrant_summary(
    *,
    workspace_id: UUID,
    expected_chunks_count: int,
    postgres_vector_id_count: int,
) -> dict[str, object]:
    qdrant = vector_store_service.get_qdrant_client()
    try:
        collection_exists = await qdrant.collection_exists(vector_store_service.COLLECTION_NAME)
        if not collection_exists:
            return {
                "qdrant_reachable": True,
                "collection_name": vector_store_service.COLLECTION_NAME,
                "collection_exists": False,
                "vector_count": None,
                "indexed_vectors_count": None,
                "expected_chunks_count": expected_chunks_count,
                "postgres_vector_id_count": postgres_vector_id_count,
                "workspace_vector_count": None,
                "mismatch_count": None,
                "error": None,
            }

        collection_info = await qdrant.get_collection(vector_store_service.COLLECTION_NAME)
        workspace_vector_count = await _count_qdrant_workspace_vectors(qdrant, workspace_id)
        mismatch_count = (
            abs(postgres_vector_id_count - workspace_vector_count)
            if workspace_vector_count is not None
            else None
        )
        return {
            "qdrant_reachable": True,
            "collection_name": vector_store_service.COLLECTION_NAME,
            "collection_exists": True,
            "vector_count": _optional_int(getattr(collection_info, "points_count", None)),
            "indexed_vectors_count": _optional_int(
                getattr(collection_info, "indexed_vectors_count", None)
            ),
            "expected_chunks_count": expected_chunks_count,
            "postgres_vector_id_count": postgres_vector_id_count,
            "workspace_vector_count": workspace_vector_count,
            "mismatch_count": mismatch_count,
            "error": None,
        }
    except Exception as exc:
        return {
            "qdrant_reachable": False,
            "collection_name": vector_store_service.COLLECTION_NAME,
            "collection_exists": False,
            "vector_count": None,
            "indexed_vectors_count": None,
            "expected_chunks_count": expected_chunks_count,
            "postgres_vector_id_count": postgres_vector_id_count,
            "workspace_vector_count": None,
            "mismatch_count": None,
            "error": str(exc),
        }
    finally:
        await _close_qdrant_client(qdrant)


async def _count_qdrant_workspace_vectors(qdrant: Any, workspace_id: UUID) -> int | None:
    try:
        response = await qdrant.count(
            collection_name=vector_store_service.COLLECTION_NAME,
            count_filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="workspace_id",
                        match=models.MatchValue(value=str(workspace_id)),
                    )
                ]
            ),
            exact=True,
        )
    except Exception:
        return None
    return _optional_int(getattr(response, "count", None))


async def _recent_ingestion_jobs(db: AsyncSession, workspace_id: UUID) -> list[dict[str, object]]:
    rows = await db.execute(
        select(
            Document.id,
            Document.filename,
            Document.file_type,
            Document.file_size,
            Document.status,
            Document.created_at,
            Document.processed_at,
            func.count(Chunk.id).label("chunks_count"),
            func.count(Chunk.vector_id).label("chunks_with_vector_id"),
        )
        .outerjoin(Chunk, Chunk.document_id == Document.id)
        .where(Document.workspace_id == workspace_id)
        .group_by(Document.id)
        .order_by(desc(Document.created_at))
        .limit(RECENT_LIMIT)
    )
    jobs = []
    for row in rows.all():
        chunks_count = int(row.chunks_count or 0)
        chunks_with_vector_id = int(row.chunks_with_vector_id or 0)
        jobs.append(
            {
                "document_id": row.id,
                "filename": row.filename,
                "file_type": row.file_type,
                "file_size": row.file_size,
                "status": row.status,
                "created_at": row.created_at,
                "processed_at": row.processed_at,
                "processing_duration_seconds": _duration_seconds(row.created_at, row.processed_at),
                "chunks_count": chunks_count,
                "chunks_with_vector_id": chunks_with_vector_id,
                "chunks_missing_vector_id": max(chunks_count - chunks_with_vector_id, 0),
                "embedding_coverage_percent": _coverage_percent(
                    chunks_with_vector_id,
                    chunks_count,
                ),
            }
        )
    return jobs


async def _recent_failed_documents(db: AsyncSession, workspace_id: UUID) -> list[dict[str, object]]:
    rows = await db.execute(
        select(
            Document.id,
            Document.filename,
            Document.file_type,
            Document.file_size,
            Document.status,
            Document.created_at,
            Document.processed_at,
        )
        .where(Document.workspace_id == workspace_id, Document.status == "failed")
        .order_by(desc(Document.processed_at), desc(Document.created_at))
        .limit(RECENT_LIMIT)
    )
    return [
        {
            "document_id": row.id,
            "filename": row.filename,
            "file_type": row.file_type,
            "file_size": row.file_size,
            "status": row.status,
            "created_at": row.created_at,
            "processed_at": row.processed_at,
            "error": "Document processing failed. Check worker logs for extraction, embedding, or Qdrant errors.",
        }
        for row in rows.all()
    ]


async def _recent_rag_queries(db: AsyncSession, workspace_id: UUID) -> list[dict[str, object]]:
    rows = await db.execute(
        select(
            AgentRun.message_id,
            AgentRun.input.label("input_payload"),
            AgentRun.latency_ms,
            AgentRun.created_at,
            Conversation.id.label("conversation_id"),
            func.count(distinct(RetrievedChunk.id)).label("retrieved_chunks_count"),
            func.avg(RetrievedChunk.score).label("average_retrieval_score"),
            Evaluation.faithfulness,
            Evaluation.relevance,
            LLMUsage.latency_ms.label("llm_latency_ms"),
        )
        .join(Message, Message.id == AgentRun.message_id)
        .join(Conversation, Conversation.id == Message.conversation_id)
        .outerjoin(RetrievedChunk, RetrievedChunk.message_id == Message.id)
        .outerjoin(Evaluation, Evaluation.message_id == Message.id)
        .outerjoin(LLMUsage, LLMUsage.message_id == Message.id)
        .where(
            Conversation.workspace_id == workspace_id,
            AgentRun.agent_type == "generator",
        )
        .group_by(
            AgentRun.id,
            AgentRun.message_id,
            AgentRun.input,
            AgentRun.latency_ms,
            AgentRun.created_at,
            Conversation.id,
            Evaluation.id,
            LLMUsage.id,
        )
        .order_by(desc(AgentRun.created_at))
        .limit(RECENT_LIMIT)
    )
    queries = []
    for row in rows.all():
        input_payload = row.input_payload if isinstance(row.input_payload, dict) else {}
        query_text = str(
            input_payload.get("question")
            or input_payload.get("rewritten_query")
            or input_payload.get("query")
            or ""
        )
        queries.append(
            {
                "message_id": row.message_id,
                "conversation_id": row.conversation_id,
                "query_preview": _preview(query_text, max_chars=180),
                "retrieved_chunks_count": int(row.retrieved_chunks_count or 0),
                "average_retrieval_score": _float_or_zero(row.average_retrieval_score),
                "latency_ms": row.llm_latency_ms if row.llm_latency_ms is not None else row.latency_ms,
                "faithfulness": _float_or_zero(row.faithfulness),
                "relevance": _float_or_zero(row.relevance),
                "created_at": row.created_at,
            }
        )
    return queries


async def _average_evaluation_scores(db: AsyncSession, workspace_id: UUID) -> dict[str, float]:
    row = (
        await db.execute(
            select(
                func.avg(Evaluation.faithfulness).label("faithfulness"),
                func.avg(Evaluation.relevance).label("relevance"),
                func.avg(Evaluation.context_precision).label("context_precision"),
                func.avg(Evaluation.context_recall).label("context_recall"),
                func.avg(Evaluation.hallucination_score).label("hallucination_score"),
            )
            .select_from(Evaluation)
            .join(Message, Message.id == Evaluation.message_id)
            .join(Conversation, Conversation.id == Message.conversation_id)
            .where(Conversation.workspace_id == workspace_id)
        )
    ).one()
    return {
        "faithfulness": _float_or_zero(row.faithfulness),
        "relevance": _float_or_zero(row.relevance),
        "context_precision": _float_or_zero(row.context_precision),
        "context_recall": _float_or_zero(row.context_recall),
        "hallucination_score": _float_or_zero(row.hallucination_score),
    }


async def _average_agent_latency(db: AsyncSession, workspace_id: UUID) -> list[dict[str, object]]:
    rows = await db.execute(
        select(
            AgentRun.agent_type,
            func.avg(AgentRun.latency_ms).label("average_latency_ms"),
            func.count(AgentRun.id).label("run_count"),
            func.max(AgentRun.created_at).label("last_run_at"),
        )
        .join(Message, Message.id == AgentRun.message_id)
        .join(Conversation, Conversation.id == Message.conversation_id)
        .where(Conversation.workspace_id == workspace_id)
        .group_by(AgentRun.agent_type)
        .order_by(desc(func.avg(AgentRun.latency_ms)))
    )
    return [
        {
            "agent_type": row.agent_type,
            "average_latency_ms": _float_or_zero(row.average_latency_ms),
            "run_count": int(row.run_count or 0),
            "last_run_at": row.last_run_at,
        }
        for row in rows.all()
    ]


def _build_workspace_summary(
    *,
    workspace_id: UUID,
    workspace_name: str,
    owner_email: str,
    counts: dict[str, int],
    chunk_stats: dict[str, object],
    last_document_uploaded_at: datetime | None,
    last_document_indexed_at: datetime | None,
) -> dict[str, object]:
    documents_total = sum(counts.values())
    documents_deleted = counts.get("deleted", 0)
    non_deleted_total = max(documents_total - documents_deleted, 0)
    documents_indexed = counts.get("indexed", 0)
    documents_failed = counts.get("failed", 0)
    embedding_coverage_percent = float(chunk_stats["embedding_coverage_percent"])
    rag_health_status = _rag_health_status(
        counts=counts,
        non_deleted_total=non_deleted_total,
        documents_indexed=documents_indexed,
        embedding_coverage_percent=embedding_coverage_percent,
    )

    return {
        "workspace_id": workspace_id,
        "workspace_name": workspace_name,
        "owner_email": owner_email,
        "documents_total": documents_total,
        "documents_queued": counts.get("queued", 0),
        "documents_processing": counts.get("processing", 0),
        "documents_indexed": documents_indexed,
        "documents_failed": documents_failed,
        "documents_deleted": documents_deleted,
        "total_chunks": int(chunk_stats["total_chunks"]),
        "chunks_with_vector_id": int(chunk_stats["chunks_with_vector_id"]),
        "chunks_missing_vector_id": int(chunk_stats["chunks_missing_vector_id"]),
        "embedding_coverage_percent": embedding_coverage_percent,
        "average_chunk_length": float(chunk_stats["average_chunk_length"]),
        "last_document_uploaded_at": last_document_uploaded_at,
        "last_document_indexed_at": last_document_indexed_at,
        "rag_health_status": rag_health_status,
    }


def _rag_health_status(
    *,
    counts: dict[str, int],
    non_deleted_total: int,
    documents_indexed: int,
    embedding_coverage_percent: float,
) -> str:
    if counts.get("failed", 0) > 0 or embedding_coverage_percent < 70:
        return "critical"
    if (
        counts.get("queued", 0) > 0
        or counts.get("processing", 0) > 0
        or counts.get("uploaded", 0) > 0
        or 70 <= embedding_coverage_percent < 95
        or documents_indexed < non_deleted_total
    ):
        return "warning"
    return "healthy"


def _normalize_chunk_stats(
    *,
    total_chunks: object,
    chunks_with_vector_id: object,
    average_chunk_length: object,
) -> dict[str, object]:
    total = int(total_chunks or 0)
    with_vector_id = int(chunks_with_vector_id or 0)
    missing = max(total - with_vector_id, 0)
    return {
        "total_chunks": total,
        "chunks_with_vector_id": with_vector_id,
        "chunks_missing_vector_id": missing,
        "embedding_coverage_percent": _coverage_percent(with_vector_id, total),
        "average_chunk_length": _float_or_zero(average_chunk_length),
    }


def _empty_chunk_stats() -> dict[str, object]:
    return {
        "total_chunks": 0,
        "chunks_with_vector_id": 0,
        "chunks_missing_vector_id": 0,
        "embedding_coverage_percent": 100.0,
        "average_chunk_length": 0.0,
    }


def _document_pipeline_states(
    *,
    status_value: str,
    created_at: datetime,
    processed_at: datetime | None,
    chunks_count: int,
    chunks_missing_vector_id: int,
    qdrant_indexed: bool,
) -> dict[str, dict[str, object]]:
    failed = status_value == "failed"
    indexed = status_value == "indexed"
    has_chunks = chunks_count > 0
    vectors_complete = chunks_count == 0 or chunks_missing_vector_id == 0

    extraction_status = "completed" if indexed or has_chunks else "pending"
    chunking_status = "completed" if indexed or has_chunks else "pending"
    embedding_status = "completed" if (indexed and vectors_complete) else "pending"
    vector_status = "completed" if qdrant_indexed else "pending"
    indexed_status = "completed" if qdrant_indexed else "pending"

    if failed:
        extraction_status = "completed" if has_chunks else "failed"
        chunking_status = "completed" if has_chunks else "failed"
        embedding_status = "failed" if chunks_missing_vector_id > 0 or not has_chunks else "completed"
        vector_status = "failed" if not qdrant_indexed else "completed"
        indexed_status = "failed"
    elif status_value in {"queued", "uploaded"}:
        extraction_status = "pending"
        chunking_status = "pending"
        embedding_status = "pending"
        vector_status = "pending"
        indexed_status = "pending"
    elif status_value == "processing":
        if has_chunks:
            extraction_status = "completed"
            chunking_status = "completed"
            embedding_status = "completed" if vectors_complete else "pending"
            vector_status = "completed" if qdrant_indexed else "pending"

    return {
        "upload_state": {
            "name": "Upload",
            "status": "completed",
            "timestamp": created_at,
            "detail": "Document metadata and file were accepted.",
        },
        "extraction_state": {
            "name": "Extraction",
            "status": extraction_status,
            "timestamp": processed_at if extraction_status == "completed" else None,
            "detail": _stage_detail("extraction", extraction_status),
        },
        "chunking_state": {
            "name": "Chunking",
            "status": chunking_status,
            "timestamp": processed_at if chunking_status == "completed" else None,
            "detail": _stage_detail("chunking", chunking_status),
        },
        "embedding_state": {
            "name": "Embedding",
            "status": embedding_status,
            "timestamp": processed_at if embedding_status == "completed" else None,
            "detail": _stage_detail("embedding", embedding_status),
        },
        "vector_indexing_state": {
            "name": "Qdrant Indexing",
            "status": vector_status,
            "timestamp": processed_at if vector_status == "completed" else None,
            "detail": _stage_detail("qdrant indexing", vector_status),
        },
        "indexed_state": {
            "name": "Indexed",
            "status": indexed_status,
            "timestamp": processed_at if indexed_status == "completed" else None,
            "detail": _stage_detail("retrieval readiness", indexed_status),
        },
    }


def _stage_detail(stage: str, status_value: str) -> str:
    if status_value == "completed":
        return f"{stage.title()} completed."
    if status_value == "failed":
        return f"{stage.title()} did not complete successfully."
    return f"{stage.title()} is pending or in progress."


def _document_pipeline_errors(
    *,
    status_value: str,
    chunks_count: int,
    chunks_missing_vector_id: int,
) -> list[str]:
    errors: list[str] = []
    if status_value == "failed":
        errors.append(
            "Document processing failed. Worker logs contain the provider or Qdrant exception."
        )
    if chunks_count > 0 and chunks_missing_vector_id > 0:
        errors.append(f"{chunks_missing_vector_id} chunks are missing vector IDs.")
    if status_value == "indexed" and chunks_missing_vector_id > 0:
        errors.append("Document is marked indexed but vector coverage is incomplete.")
    return errors


def _retry_allowed(*, status_value: str, created_at: datetime, now: datetime) -> bool:
    if status_value == "failed":
        return True
    if status_value not in {"queued", "processing"}:
        return False
    return _aware_datetime(now) - _aware_datetime(created_at) >= RETRY_STUCK_THRESHOLD


def _duration_seconds(start: datetime | None, end: datetime | None) -> float | None:
    if start is None or end is None:
        return None
    return max((_aware_datetime(end) - _aware_datetime(start)).total_seconds(), 0.0)


def _aware_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


def _coverage_percent(chunks_with_vector_id: int, total_chunks: int) -> float:
    if total_chunks <= 0:
        return 100.0
    return round((chunks_with_vector_id / total_chunks) * 100, 2)


def _float_or_zero(value: object) -> float:
    if value is None:
        return 0.0
    return float(value)


def _optional_int(value: object) -> int | None:
    if value is None:
        return None
    return int(value)


def _preview(value: str, max_chars: int = 300) -> str:
    normalized = " ".join(value.split())
    if len(normalized) <= max_chars:
        return normalized
    return f"{normalized[: max_chars - 3]}..."


def _mask_storage_path(storage_path: str) -> str:
    normalized = storage_path.replace("\\", "/")
    parts = PurePosixPath(normalized).parts
    if not parts:
        return "***"
    if len(parts) == 1:
        return f".../{parts[0]}"
    first = parts[0]
    filename = parts[-1]
    return f"{first}/.../{filename}"


def _qdrant_status_value(value: object) -> str | None:
    if value is None:
        return None
    return str(value.value if hasattr(value, "value") else value)


async def _close_qdrant_client(qdrant: Any) -> None:
    close = getattr(qdrant, "close", None)
    if close is None:
        return
    result = close()
    if hasattr(result, "__await__"):
        await result
