"""admin rbac and audit logs

Revision ID: a91f4d5e7b20
Revises: d90c3143158d
Create Date: 2026-05-18 12:00:00.000000+00:00
"""

from collections.abc import Sequence

from alembic import context, op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "a91f4d5e7b20"
down_revision: str | None = "d90c3143158d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    if context.is_offline_mode():
        op.alter_column("users", "role", server_default="user", existing_type=sa.String(length=50))
        op.alter_column(
            "users",
            "is_active",
            server_default=sa.true(),
            existing_type=sa.Boolean(),
        )
        op.add_column("users", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
        op.add_column("users", sa.Column("deactivated_at", sa.DateTime(timezone=True), nullable=True))
        op.add_column("users", sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))
        _create_audit_logs_table()
        return

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    user_columns = {column["name"] for column in inspector.get_columns("users")}

    if "role" not in user_columns:
        op.add_column(
            "users",
            sa.Column("role", sa.String(length=50), server_default="user", nullable=False),
        )
    else:
        op.alter_column("users", "role", server_default="user", existing_type=sa.String(length=50))

    if "is_active" not in user_columns:
        op.add_column(
            "users",
            sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        )
    else:
        op.alter_column(
            "users",
            "is_active",
            server_default=sa.true(),
            existing_type=sa.Boolean(),
        )

    if "deleted_at" not in user_columns:
        op.add_column("users", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    if "deactivated_at" not in user_columns:
        op.add_column("users", sa.Column("deactivated_at", sa.DateTime(timezone=True), nullable=True))
    if "last_login_at" not in user_columns:
        op.add_column("users", sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))

    if "audit_logs" not in inspector.get_table_names():
        _create_audit_logs_table()


def downgrade() -> None:
    op.drop_index(op.f("ix_audit_logs_target_id"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_created_at"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_actor_user_id"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_action"), table_name="audit_logs")
    op.drop_table("audit_logs")
    op.drop_column("users", "last_login_at")
    op.drop_column("users", "deactivated_at")
    op.drop_column("users", "deleted_at")


def _create_audit_logs_table() -> None:
    op.create_table(
        "audit_logs",
        sa.Column("actor_user_id", sa.UUID(), nullable=True),
        sa.Column("action", sa.String(length=150), nullable=False),
        sa.Column("target_type", sa.String(length=100), nullable=False),
        sa.Column("target_id", sa.UUID(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.String(length=100), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audit_logs_action"), "audit_logs", ["action"], unique=False)
    op.create_index(
        op.f("ix_audit_logs_actor_user_id"),
        "audit_logs",
        ["actor_user_id"],
        unique=False,
    )
    op.create_index(op.f("ix_audit_logs_created_at"), "audit_logs", ["created_at"], unique=False)
    op.create_index(op.f("ix_audit_logs_target_id"), "audit_logs", ["target_id"], unique=False)
