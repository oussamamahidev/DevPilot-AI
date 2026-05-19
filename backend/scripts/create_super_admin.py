from __future__ import annotations

import argparse
import asyncio
from getpass import getpass
from pathlib import Path
import sys


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import func, select

from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models.audit import AuditLog
from app.models.user import User


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Bootstrap the first DevPilot super_admin.")
    parser.add_argument("--email", required=True, help="Email for the super_admin account.")
    parser.add_argument("--password", help="Password for the super_admin account.")
    return parser.parse_args()


async def create_super_admin(email: str, password: str) -> int:
    normalized_email = email.strip().lower()
    async with AsyncSessionLocal() as db:
        existing_super_admin_count = await db.scalar(
            select(func.count(User.id)).where(User.role == "super_admin")
        )
        if int(existing_super_admin_count or 0) > 0:
            print("A super_admin already exists. No changes made.")
            return 0

        user = await db.scalar(select(User).where(User.email == normalized_email))
        if user is None:
            user = User(
                email=normalized_email,
                full_name="Super Admin",
                password_hash=hash_password(password),
                role="super_admin",
                is_active=True,
            )
            db.add(user)
            action = "SUPER_ADMIN_CREATED"
        else:
            user.password_hash = hash_password(password)
            user.role = "super_admin"
            user.is_active = True
            user.deleted_at = None
            user.deactivated_at = None
            action = "SUPER_ADMIN_PROMOTED"

        await db.flush()
        db.add(
            AuditLog(
                actor_user_id=None,
                action=action,
                target_type="user",
                target_id=user.id,
                metadata_={"email": normalized_email},
                reason="Initial super_admin bootstrap",
            )
        )
        await db.commit()

    print("Super admin account is ready.")
    return 0


def main() -> int:
    args = parse_args()
    password = args.password or getpass("Password: ")
    if len(password) < 12:
        print("Password must be at least 12 characters.")
        return 1
    return asyncio.run(create_super_admin(args.email, password))


if __name__ == "__main__":
    raise SystemExit(main())
