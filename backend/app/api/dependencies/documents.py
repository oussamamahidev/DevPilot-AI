from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_active_user
from app.db.session import get_db
from app.models.document import Document
from app.models.user import User
from app.services import document_service


async def get_document_or_403(
    document_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> Document:
    document = await document_service.get_document_for_user(
        db=db,
        document_id=document_id,
        user=current_user,
    )
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Document not found or access denied",
        )
    return document
