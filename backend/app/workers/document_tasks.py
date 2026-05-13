import asyncio
import logging
from datetime import UTC, datetime
from pathlib import Path
from time import perf_counter
from uuid import UUID

from celery import Task
from pypdf import PdfReader
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal, engine
from app.models.document import Chunk, Document
from app.providers.base import EmbeddingProviderError
from app.services.document_service import resolve_storage_path
from app.services.vector_store_service import VectorStoreError, upsert_chunks
from app.utils.chunker import chunk_text
from app.utils.text_cleaner import clean_text
from app.workers.celery_app import celery_app


logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="process_document_task", max_retries=3)
def process_document_task(self: Task, document_id: str) -> dict[str, object]:
    started_at = perf_counter()
    try:
        result = asyncio.run(_run_document_processing_attempt(document_id=document_id))
        elapsed_ms = int((perf_counter() - started_at) * 1000)
        logger.info(
            "Document processing task completed document_id=%s status=%s processing_time_ms=%s",
            document_id,
            result.get("status"),
            elapsed_ms,
            extra={
                "document_id": document_id,
                "status": result.get("status"),
                "processing_time_ms": elapsed_ms,
            },
        )
        return result
    except (EmbeddingProviderError, VectorStoreError) as exc:
        elapsed_ms = int((perf_counter() - started_at) * 1000)
        logger.exception(
            "Document processing task failed without retry document_id=%s status=failed "
            "processing_time_ms=%s error=%s",
            document_id,
            elapsed_ms,
            str(exc),
            extra={
                "document_id": document_id,
                "status": "failed",
                "processing_time_ms": elapsed_ms,
                "error": str(exc),
            },
        )
        return {"document_id": document_id, "status": "failed", "error": str(exc)}
    except Exception as exc:
        elapsed_ms = int((perf_counter() - started_at) * 1000)
        logger.exception(
            "Document processing task failed document_id=%s status=failed processing_time_ms=%s "
            "retry=%s max_retries=%s",
            document_id,
            elapsed_ms,
            self.request.retries,
            self.max_retries,
            extra={
                "document_id": document_id,
                "status": "failed",
                "processing_time_ms": elapsed_ms,
                "retry": self.request.retries,
                "max_retries": self.max_retries,
            },
        )

        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=min(2**self.request.retries, 30)) from exc
        raise


async def _run_document_processing_attempt(document_id: str) -> dict[str, object]:
    try:
        return await _process_document(document_id=document_id)
    except Exception:
        await _mark_document_failed(document_id=document_id)
        raise
    finally:
        await engine.dispose()


async def _process_document(document_id: str) -> dict[str, object]:
    document_uuid = UUID(document_id)
    async with AsyncSessionLocal() as db:
        document = await _get_document(db=db, document_id=document_uuid)
        if document is None:
            logger.warning(
                "Document processing skipped because document was not found document_id=%s",
                document_id,
                extra={"document_id": document_id},
            )
            return {"document_id": document_id, "status": "missing"}

        if document.status == "deleted":
            logger.info(
                "Document processing skipped because document is deleted document_id=%s status=deleted",
                document_id,
                extra={"document_id": document_id, "status": "deleted"},
            )
            return {"document_id": document_id, "status": "deleted"}

        await _set_document_status(db=db, document=document, status="processing")

        storage_path = resolve_storage_path(document.storage_path)
        extracted_text = extract_text(storage_path=storage_path, file_type=document.file_type)
        cleaned_text = clean_text(extracted_text)
        chunks = chunk_text(cleaned_text)

        logger.info(
            "Document text extracted document_id=%s file_type=%s text_length=%s chunk_count=%s",
            document_id,
            document.file_type,
            len(cleaned_text),
            len(chunks),
            extra={
                "document_id": document_id,
                "file_type": document.file_type,
                "text_length": len(cleaned_text),
                "chunk_count": len(chunks),
            },
        )

        await _replace_document_chunks(db=db, document=document, chunks=chunks)
        vector_count = await upsert_chunks(document_id=document.id, db=db)
        await _set_document_status(db=db, document=document, status="indexed")
        return {
            "document_id": document_id,
            "status": "indexed",
            "text_length": len(cleaned_text),
            "chunk_count": len(chunks),
            "vector_count": vector_count,
        }


async def _mark_document_failed(document_id: str) -> None:
    try:
        document_uuid = UUID(document_id)
    except ValueError:
        return

    async with AsyncSessionLocal() as db:
        document = await _get_document(db=db, document_id=document_uuid)
        if document is None:
            return
        await _set_document_status(db=db, document=document, status="failed")


async def _get_document(db: AsyncSession, document_id: UUID) -> Document | None:
    return await db.scalar(select(Document).where(Document.id == document_id))


async def _replace_document_chunks(
    db: AsyncSession,
    document: Document,
    chunks: list[dict[str, object]],
) -> None:
    await db.execute(delete(Chunk).where(Chunk.document_id == document.id))

    for chunk in chunks:
        db.add(
            Chunk(
                document_id=document.id,
                workspace_id=document.workspace_id,
                content=str(chunk["content"]),
                chunk_index=int(chunk["chunk_index"]),
                token_count=int(chunk["token_count"]),
                metadata_=dict(chunk["metadata"]),
            )
        )

    await db.commit()
    logger.info(
        "Document chunks saved document_id=%s chunk_count=%s",
        str(document.id),
        len(chunks),
        extra={"document_id": str(document.id), "chunk_count": len(chunks)},
    )


async def _set_document_status(db: AsyncSession, document: Document, status: str) -> None:
    document.status = status
    if status in {"indexed", "failed"}:
        document.processed_at = datetime.now(UTC)
    elif status == "processing":
        document.processed_at = None

    await db.commit()
    logger.info(
        "Document status changed document_id=%s status=%s",
        str(document.id),
        status,
        extra={
            "document_id": str(document.id),
            "status": status,
        },
    )


def extract_text(storage_path: Path, file_type: str) -> str:
    if file_type == "pdf":
        reader = PdfReader(str(storage_path))
        return "\n".join(page.extract_text() or "" for page in reader.pages)

    if file_type in {"txt", "markdown"}:
        return storage_path.read_text(encoding="utf-8", errors="replace")

    raise ValueError(f"Unsupported document file type: {file_type}")
