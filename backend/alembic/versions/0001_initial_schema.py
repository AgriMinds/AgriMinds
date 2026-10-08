"""Initial schema: geography, users, farms, advisory records.

Hand-reviewed from autogenerate. The `crop` enum is shared by two tables, so every enum type
is created once up front with ``create_type=False`` on the columns; letting ``create_table``
emit the type inline would fail on the second table.

Revision ID: 0001_initial
Revises:
Create Date: 2026-10-08
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

user_role = postgresql.ENUM("farmer", "agent", "minister", "admin", name="user_role", create_type=False)
locale = postgresql.ENUM("en", "am", "or", name="locale", create_type=False)
crop = postgresql.ENUM("tef", "wheat", "maize", name="crop", create_type=False)
risk_level = postgresql.ENUM("Low", "Moderate", "High", "Severe", name="risk_level", create_type=False)
ENUMS = (user_role, locale, crop, risk_level)

NOW = sa.text("now()")


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
    ]


def upgrade() -> None:
    bind = op.get_bind()
    for enum in ENUMS:
        enum.create(bind, checkfirst=True)

    # ---------------------------------------------------------------- geography
    op.create_table(
        "regions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(16), nullable=False),
        sa.Column("name_en", sa.String(128), nullable=False),
        sa.Column("name_am", sa.String(128), nullable=False),
        sa.Column("name_om", sa.String(128), nullable=False),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_regions")),
    )
    op.create_index(op.f("ix_regions_code"), "regions", ["code"], unique=True)

    op.create_table(
        "zones",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("region_id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(16), nullable=False),
        sa.Column("name_en", sa.String(128), nullable=False),
        sa.Column("name_am", sa.String(128), nullable=False),
        sa.Column("name_om", sa.String(128), nullable=False),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["region_id"], ["regions.id"], name=op.f("fk_zones_region_id_regions"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_zones")),
        sa.UniqueConstraint("region_id", "code", name=op.f("uq_zones_region_id_code")),
    )
    op.create_index(op.f("ix_zones_code"), "zones", ["code"])
    op.create_index(op.f("ix_zones_region_id"), "zones", ["region_id"])

    op.create_table(
        "woredas",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("zone_id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(16), nullable=False),
        sa.Column("name_en", sa.String(128), nullable=False),
        sa.Column("name_am", sa.String(128), nullable=False),
        sa.Column("name_om", sa.String(128), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["zone_id"], ["zones.id"], name=op.f("fk_woredas_zone_id_zones"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_woredas")),
        sa.UniqueConstraint("zone_id", "code", name=op.f("uq_woredas_zone_id_code")),
    )
    op.create_index(op.f("ix_woredas_code"), "woredas", ["code"])
    op.create_index(op.f("ix_woredas_zone_id"), "woredas", ["zone_id"])

    # ---------------------------------------------------------------- accounts
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(254), nullable=True),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("full_name", sa.String(160), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column("locale", locale, nullable=False),
        sa.Column("woreda_id", sa.Uuid(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("failed_login_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.CheckConstraint(
            "email IS NOT NULL OR phone IS NOT NULL", name=op.f("ck_users_identifier_present")
        ),
        sa.ForeignKeyConstraint(
            ["woreda_id"], ["woredas.id"], name=op.f("fk_users_woreda_id_woredas"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_phone"), "users", ["phone"], unique=True)
    op.create_index(op.f("ix_users_role"), "users", ["role"])
    op.create_index("ix_users_role_woreda", "users", ["role", "woreda_id"])
    op.create_index(op.f("ix_users_woreda_id"), "users", ["woreda_id"])

    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("family_id", sa.Uuid(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("user_agent", sa.String(255), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_refresh_tokens_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_refresh_tokens")),
    )
    op.create_index(op.f("ix_refresh_tokens_family_id"), "refresh_tokens", ["family_id"])
    op.create_index(op.f("ix_refresh_tokens_token_hash"), "refresh_tokens", ["token_hash"], unique=True)
    op.create_index("ix_refresh_tokens_user_expires", "refresh_tokens", ["user_id", "expires_at"])
    op.create_index(op.f("ix_refresh_tokens_user_id"), "refresh_tokens", ["user_id"])

    # ---------------------------------------------------------------- farms
    op.create_table(
        "farms",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("woreda_id", sa.Uuid(), nullable=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("grid_row", sa.Integer(), nullable=False),
        sa.Column("grid_col", sa.Integer(), nullable=False),
        sa.Column("area_hectares", sa.Float(), nullable=False),
        sa.Column("primary_crop", crop, nullable=False),
        *_timestamps(),
        sa.CheckConstraint(
            "area_hectares > 0 AND area_hectares <= 10000", name=op.f("ck_farms_area_positive")
        ),
        sa.CheckConstraint("grid_row >= 0 AND grid_col >= 0", name=op.f("ck_farms_grid_non_negative")),
        sa.ForeignKeyConstraint(
            ["owner_id"], ["users.id"], name=op.f("fk_farms_owner_id_users"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["woreda_id"], ["woredas.id"], name=op.f("fk_farms_woreda_id_woredas"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_farms")),
    )
    op.create_index("ix_farms_grid", "farms", ["grid_row", "grid_col"])
    op.create_index(op.f("ix_farms_owner_id"), "farms", ["owner_id"])
    op.create_index(op.f("ix_farms_primary_crop"), "farms", ["primary_crop"])
    op.create_index(op.f("ix_farms_woreda_id"), "farms", ["woreda_id"])

    # ---------------------------------------------------------------- advisory delivery log
    op.create_table(
        "advisory_records",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("farm_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("crop", crop, nullable=False),
        sa.Column("lead_month", sa.Integer(), nullable=False),
        sa.Column("issued_date", sa.Date(), nullable=False),
        sa.Column("target_month", sa.Date(), nullable=False),
        sa.Column("raw_probability", sa.Float(), nullable=False),
        sa.Column("adjusted_probability", sa.Float(), nullable=False),
        sa.Column("risk_level", risk_level, nullable=False),
        sa.Column("model_version", sa.String(64), nullable=False),
        sa.Column("rules_version", sa.String(64), nullable=False),
        sa.Column("data_source", sa.String(32), nullable=False),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["farm_id"], ["farms.id"], name=op.f("fk_advisory_records_farm_id_farms"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_advisory_records_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_advisory_records")),
    )
    op.create_index("ix_advisory_records_created", "advisory_records", ["created_at"])
    op.create_index(op.f("ix_advisory_records_farm_id"), "advisory_records", ["farm_id"])
    op.create_index("ix_advisory_records_farm_issued", "advisory_records", ["farm_id", "issued_date"])
    op.create_index(op.f("ix_advisory_records_risk_level"), "advisory_records", ["risk_level"])
    op.create_index(op.f("ix_advisory_records_user_id"), "advisory_records", ["user_id"])


def downgrade() -> None:
    op.drop_table("advisory_records")
    op.drop_table("farms")
    op.drop_table("refresh_tokens")
    op.drop_table("users")
    op.drop_table("woredas")
    op.drop_table("zones")
    op.drop_table("regions")
    bind = op.get_bind()
    for enum in reversed(ENUMS):
        enum.drop(bind, checkfirst=True)
