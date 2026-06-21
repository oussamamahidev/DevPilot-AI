"""constrain global user roles

Revision ID: b19d0e2c8f44
Revises: a91f4d5e7b20
Create Date: 2026-05-18 13:00:00.000000+00:00
"""

from collections.abc import Sequence

from alembic import op


revision: str = "b19d0e2c8f44"
down_revision: str | None = "a91f4d5e7b20"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_check_constraint(
        "ck_users_role_valid",
        "users",
        "role IN ('user', 'admin', 'super_admin')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_users_role_valid", "users", type_="check")
