import re
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.metrics import DOCUMENTS_UPLOADED_TOTAL
from app.models.document import Document
from app.models.user import User
from app.models.workspace import Workspace
from app.services import workspace_service


SUPPORTED_EXTENSIONS = {
    ".pdf": "pdf",
    ".txt": "txt",
    ".md": "markdown",
    ".markdown": "markdown",
}
DOCUMENT_STATUSES = {"uploaded", "queued", "processing", "indexed", "failed", "deleted"}
STORAGE_ROOT = Path(__file__).resolve().parents[2] / "storage"
CHUNK_SIZE = 1024 * 1024


def sanitize_filename(filename: str | None) -> str:
    raw_filename = (filename or "").replace("\\", "/").split("/")[-1].strip()
    sanitized = re.sub(r"[^A-Za-z0-9._ -]", "_", raw_filename)
    sanitized = re.sub(r"\s+", " ", sanitized).strip(" .")
    if not sanitized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid filename",
        )
    return sanitized


def get_file_type(filename: str) -> str:
    extension = Path(filename).suffix.lower()
    if extension not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type",
        )
    return SUPPORTED_EXTENSIONS[extension]


def resolve_storage_path(storage_path: str) -> Path:
    raw_path = Path(storage_path)
    candidate = raw_path if raw_path.is_absolute() else STORAGE_ROOT.parent / raw_path
    resolved_path = candidate.resolve()
    storage_root = STORAGE_ROOT.resolve()

    try:
        resolved_path.relative_to(storage_root)
    except ValueError as exc:
        raise ValueError("Document storage path is outside storage root") from exc

    return resolved_path


async def upload_document(
    db: AsyncSession,
    workspace: Workspace,
    uploader: User,
    upload_file: UploadFile,
) -> Document:
    filename = sanitize_filename(upload_file.filename)
    file_type = get_file_type(filename)
    document_id = uuid4()
    document_dir = STORAGE_ROOT / str(workspace.id) / str(document_id)
    storage_path = document_dir / filename

    document_dir.mkdir(parents=True, exist_ok=False)

    file_size = 0
    try:
        with storage_path.open("wb") as destination:
            while chunk := await upload_file.read(CHUNK_SIZE):
                file_size += len(chunk)
                if file_size > settings.max_upload_size:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="File is too large",
                    )
                destination.write(chunk)
    except Exception:
        if storage_path.exists():
            storage_path.unlink()
        if document_dir.exists():
            document_dir.rmdir()
        raise

    document = Document(
        id=document_id,
        workspace_id=workspace.id,
        uploaded_by=uploader.id,
        filename=filename,
        file_type=file_type,
        file_size=file_size,
        status="queued",
        storage_path=str(storage_path.relative_to(STORAGE_ROOT.parent)),
    )
    db.add(document)
    await db.commit()

    created_document = await get_document_by_id(db, document.id)
    if created_document is None:
        raise RuntimeError("Uploaded document could not be loaded")

    DOCUMENTS_UPLOADED_TOTAL.labels(file_type=file_type).inc()

    from app.workers.document_tasks import process_document_task

    process_document_task.delay(str(created_document.id))
    return created_document


async def list_documents_for_workspace(
    db: AsyncSession,
    workspace_id: UUID,
) -> list[Document]:
    result = await db.scalars(
        select(Document)
        .where(Document.workspace_id == workspace_id, Document.status != "deleted")
        .order_by(Document.created_at.desc())
    )
    return list(result.all())


async def get_document_by_id(db: AsyncSession, document_id: UUID) -> Document | None:
    return await db.scalar(select(Document).where(Document.id == document_id))


async def get_document_for_user(
    db: AsyncSession,
    document_id: UUID,
    user: User,
) -> Document | None:
    document = await get_document_by_id(db, document_id)
    if document is None or document.status == "deleted":
        return None

    if user.role in {"admin", "super_admin"}:
        return document

    member = await workspace_service.get_workspace_member(
        db=db,
        workspace_id=document.workspace_id,
        user_id=user.id,
    )
    if member is None:
        return None

    return document


async def mark_document_deleted(db: AsyncSession, document: Document) -> Document:
    document.status = "deleted"
    await db.commit()

    deleted_document = await get_document_by_id(db, document.id)
    if deleted_document is None:
        raise RuntimeError("Deleted document could not be loaded")
    return deleted_document
