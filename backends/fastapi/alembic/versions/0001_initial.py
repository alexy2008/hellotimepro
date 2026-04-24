"""initial schema — 对齐 spec/db/schema.sql

Revision ID: 0001_initial
Revises:
Create Date: 2026-04-24
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def _is_pg() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def _uuid_pk(is_pg: bool) -> sa.Column:
    default = sa.text("gen_random_uuid()") if is_pg else None
    return sa.Column("id", sa.Uuid(), primary_key=True, server_default=default)


def upgrade() -> None:
    is_pg = _is_pg()

    if is_pg:
        op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
        op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # users
    op.create_table(
        "users",
        _uuid_pk(is_pg),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("password_hash", sa.String(100), nullable=False),
        sa.Column("nickname", sa.String(20), nullable=False),
        sa.Column("avatar_id", sa.String(20), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.CheckConstraint(
            "email = lower(email) AND position('@' in email) > 1"
            if is_pg
            else "email = lower(email) AND instr(email, '@') > 1",
            name="users_email_format_chk",
        ),
        sa.CheckConstraint(
            "length(nickname) BETWEEN 2 AND 20",
            name="users_nickname_length_chk",
        ),
    )
    op.create_index("users_email_uk", "users", ["email"], unique=True)
    op.create_index("users_nickname_uk", "users", ["nickname"], unique=True)

    # capsules
    op.create_table(
        "capsules",
        _uuid_pk(is_pg),
        sa.Column(
            "owner_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("code", sa.String(8), nullable=False),
        sa.Column("title", sa.String(60), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("open_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("in_plaza", sa.Boolean(), nullable=False, server_default=sa.text("TRUE")),
        sa.Column(
            "favorite_count", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.CheckConstraint(
            "code ~ '^[A-Z0-9]{8}$'"
            if is_pg
            else "length(code) = 8 AND code = upper(code) AND code NOT GLOB '*[^A-Z0-9]*'",
            name="capsules_code_format_chk",
        ),
        sa.CheckConstraint(
            "length(title) BETWEEN 1 AND 60",
            name="capsules_title_length_chk",
        ),
        sa.CheckConstraint(
            "length(content) BETWEEN 1 AND 5000",
            name="capsules_content_length_chk",
        ),
        sa.CheckConstraint(
            "open_at > created_at + INTERVAL '60 seconds'"
            if is_pg
            else "datetime(open_at) > datetime(created_at, '+60 seconds')",
            name="capsules_open_after_create_chk",
        ),
        sa.CheckConstraint("favorite_count >= 0", name="capsules_favorite_count_nonneg_chk"),
    )
    op.create_index("capsules_code_uk", "capsules", ["code"], unique=True)
    op.create_index(
        "capsules_plaza_hot_ix",
        "capsules",
        ["in_plaza", sa.text("favorite_count DESC"), sa.text("created_at DESC")],
    )
    op.create_index(
        "capsules_plaza_new_ix",
        "capsules",
        ["in_plaza", sa.text("created_at DESC")],
    )
    op.create_index(
        "capsules_plaza_open_at_ix", "capsules", ["in_plaza", "open_at"]
    )
    op.create_index(
        "capsules_owner_created_ix",
        "capsules",
        ["owner_id", sa.text("created_at DESC")],
    )

    if is_pg:
        op.execute(
            "CREATE INDEX users_nickname_trgm_ix "
            "ON users USING gin (lower(nickname) gin_trgm_ops)"
        )
        op.execute(
            "CREATE INDEX capsules_title_trgm_ix "
            "ON capsules USING gin (lower(title) gin_trgm_ops)"
        )

    # favorites
    op.create_table(
        "favorites",
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "capsule_id",
            sa.Uuid(),
            sa.ForeignKey("capsules.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index(
        "favorites_user_created_ix",
        "favorites",
        ["user_id", sa.text("created_at DESC")],
    )
    op.create_index("favorites_capsule_ix", "favorites", ["capsule_id"])

    # refresh_tokens
    op.create_table(
        "refresh_tokens",
        _uuid_pk(is_pg),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(100), nullable=False),
        sa.Column("family_id", sa.Uuid(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "refresh_tokens_hash_uk", "refresh_tokens", ["token_hash"], unique=True
    )
    op.create_index("refresh_tokens_user_ix", "refresh_tokens", ["user_id"])
    op.create_index("refresh_tokens_family_ix", "refresh_tokens", ["family_id"])
    op.create_index("refresh_tokens_expires_ix", "refresh_tokens", ["expires_at"])


def downgrade() -> None:
    op.drop_table("refresh_tokens")
    op.drop_table("favorites")
    op.drop_table("capsules")
    op.drop_table("users")
