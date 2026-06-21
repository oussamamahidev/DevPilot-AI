"""enforce admin user column defaults

Revision ID: c8f2b4e9a710
Revises: b19d0e2c8f44
Create Date: 2026-05-18 14:00:00.000000+00:00
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "c8f2b4e9a710"
down_revision: str | None = "b19d0e2c8f44"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "users",
        "role",
        server_default="user",
        existing_type=sa.String(length=50),
        existing_nullable=False,
    )
    op.alter_column(
        "users",
        "is_active",
        server_default=sa.true(),
        existing_type=sa.Boolean(),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "users",
        "is_active",
        server_default=None,
        existing_type=sa.Boolean(),
        existing_nullable=False,
    )
    op.alter_column(
        "users",
        "role",
        server_default=None,
        existing_type=sa.String(length=50),
        existing_nullable=False,
    )
