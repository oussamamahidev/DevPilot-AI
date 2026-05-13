"""phase 12 answer evaluation

Revision ID: d90c3143158d
Revises: 67cde1c99923
Create Date: 2026-05-13 12:00:00.000000+00:00
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "d90c3143158d"
down_revision: str | None = "67cde1c99923"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "evaluations",
        sa.Column(
            "explanation",
            sa.Text(),
            server_default="",
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("evaluations", "explanation")
