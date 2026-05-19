from collections.abc import Callable
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import ALGORITHM
from app.db.session import get_db
from app.models.user import User


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def _credentials_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        email = payload.get("email")
        role = payload.get("role")
        if not isinstance(user_id, str) or not isinstance(email, str) or not isinstance(role, str):
            raise _credentials_exception()
        user_uuid = UUID(user_id)
    except (JWTError, ValueError) as exc:
        raise _credentials_exception() from exc

    user = await db.scalar(select(User).where(User.id == user_uuid))
    if user is None:
        raise _credentials_exception()

    return user


async def require_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if current_user.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Deleted user",
        )
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )
    return current_user


get_current_active_user = require_active_user


def require_role(*allowed_roles: str, message: str = "Insufficient role") -> Callable[[User], User]:
    async def dependency(
        current_user: Annotated[User, Depends(require_active_user)],
    ) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=message,
            )
        return current_user

    return dependency


require_admin = require_role("admin", "super_admin", message="Admin access required")
require_super_admin = require_role("super_admin", message="Super admin access required")
