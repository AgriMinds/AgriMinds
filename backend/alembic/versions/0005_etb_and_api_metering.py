"""Price in Birr, and make API access something that can be sold and metered.

**Currency.** The opening list was drafted in USD. Ethiopian institutions budget in birr, and a
price list is not an exchange-rate calculation: what a federal ministry can actually commit to a
decision-support licence is a local question, so these are local figures rather than a conversion
of the dollar ones. They keep the structure the dollar list had, because that structure is a
commercial decision and not an artefact of the currency:

    monthly  = annual / 10      paying by the year costs ten months, not twelve
    daily   ~= annual / 365
    one-off  = annual x 4       a perpetual licence priced as four years

Amounts are santim (1/100 birr). Existing USD rows are superseded rather than rewritten, so any
quote already made against them still resolves.

**Metering.** ``api_quota_monthly`` turns "Regional government, 250k calls" from a sales promise
into something the API can enforce. ``organizations`` is who pays, ``api_keys`` is what they
present, and ``api_usage_daily`` is the durable record an invoice is computed from.

Revision ID: 0005_etb_metering
Revises: 0004_pricing_tiers
Create Date: 2026-10-13
"""

from __future__ import annotations

import datetime as dt
import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005_etb_metering"
down_revision: str | None = "0004_pricing_tiers"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

#: (stakeholder, label, unit, one_time, annual, monthly, daily, api_quota) in santim / requests.
ETB_TIERS = (
    (
        "federal_ministry",
        "Federal ministry",
        "per ministry",
        1_800_000_000,
        450_000_000,
        45_000_000,
        1_233_000,
        1_000_000,
    ),
    (
        "international_partner",
        "International partner / NGO",
        "per organisation",
        1_200_000_000,
        300_000_000,
        30_000_000,
        822_000,
        500_000,
    ),
    (
        "regional_government",
        "Regional / zonal government",
        "per bureau",
        720_000_000,
        180_000_000,
        18_000_000,
        493_000,
        250_000,
    ),
    (
        "private_sector",
        "Private sector",
        "per company",
        480_000_000,
        120_000_000,
        12_000_000,
        329_000,
        100_000,
    ),
    (
        "development_agent",
        "Development agent",
        "per woreda",
        48_000_000,
        12_000_000,
        1_200_000,
        33_000,
        25_000,
    ),
    ("research", "Research / university", "per institution", 0, 6_000_000, 600_000, 16_500, 50_000),
    ("cooperative", "Cooperative", "per cooperative", 12_000_000, 3_000_000, 300_000, 8_200, 10_000),
    # A farmer gets the app, not an integration: no API quota at all.
    ("farmer_premium", "Farmer (premium)", "per farmer", 0, 15_000, 1_500, 41, 0),
)


def upgrade() -> None:
    op.add_column(
        "pricing_tiers",
        sa.Column("api_quota_monthly", sa.BigInteger(), nullable=False, server_default="0"),
    )
    op.create_check_constraint(
        "ck_pricing_tier_quota_non_negative", "pricing_tiers", "api_quota_monthly >= 0"
    )

    bind = op.get_bind()
    today = dt.date.today()

    # Close every USD row today and open the birr list from the same date, so the two never
    # overlap and the dollar figures stay readable as what was quoted before.
    bind.execute(
        sa.text(
            "UPDATE pricing_tiers SET effective_to = :today "
            "WHERE effective_to IS NULL AND effective_from < :today"
        ),
        {"today": today},
    )
    # A row created today cannot be closed today: the window check forbids it, and there is no
    # history worth keeping for a price nobody has quoted yet.
    bind.execute(
        sa.text("DELETE FROM pricing_tiers WHERE effective_to IS NULL AND effective_from >= :today"),
        {"today": today},
    )

    # The column is the `stakeholder_type` enum created in 0004; declaring it as a string here
    # makes asyncpg bind a varchar and PostgreSQL refuse the insert.
    stakeholder_type = postgresql.ENUM(name="stakeholder_type", create_type=False)
    tiers = sa.table(
        "pricing_tiers",
        sa.column("id", sa.Uuid()),
        sa.column("stakeholder", stakeholder_type),
        sa.column("label", sa.String()),
        sa.column("unit", sa.String()),
        sa.column("currency", sa.String()),
        sa.column("one_time_cents", sa.BigInteger()),
        sa.column("annual_cents", sa.BigInteger()),
        sa.column("monthly_cents", sa.BigInteger()),
        sa.column("daily_cents", sa.BigInteger()),
        sa.column("api_quota_monthly", sa.BigInteger()),
        sa.column("effective_from", sa.Date()),
        sa.column("effective_to", sa.Date()),
    )
    op.bulk_insert(
        tiers,
        [
            {
                "id": uuid.uuid4(),
                "stakeholder": key,
                "label": label,
                "unit": unit,
                "currency": "ETB",
                "one_time_cents": one_time,
                "annual_cents": annual,
                "monthly_cents": monthly,
                "daily_cents": daily,
                "api_quota_monthly": quota,
                "effective_from": today,
                "effective_to": None,
            }
            for key, label, unit, one_time, annual, monthly, daily, quota in ETB_TIERS
        ],
    )

    op.create_table(
        "organizations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("stakeholder", stakeholder_type, nullable=False),
        sa.Column("woreda_id", sa.Uuid(), sa.ForeignKey("woredas.id", ondelete="SET NULL"), nullable=True),
        sa.Column("contact_email", sa.String(length=254), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("name", name="uq_organization_name"),
    )
    op.create_index("ix_organizations_name", "organizations", ["name"])
    op.create_index("ix_organizations_stakeholder", "organizations", ["stakeholder"])
    op.create_index("ix_organizations_woreda_id", "organizations", ["woreda_id"])
    op.create_index("ix_organizations_is_active", "organizations", ["is_active"])

    op.create_table(
        "api_keys",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("label", sa.String(length=80), nullable=False),
        sa.Column("key_hash", sa.String(length=64), nullable=False),
        sa.Column("last_four", sa.String(length=4), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("key_hash", name="uq_api_key_hash"),
    )
    op.create_index("ix_api_keys_organization_id", "api_keys", ["organization_id"])
    op.create_index("ix_api_keys_key_hash", "api_keys", ["key_hash"])

    op.create_table(
        "api_usage_daily",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("requests", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("organization_id", "day", name="uq_api_usage_org_day"),
        sa.CheckConstraint("requests >= 0", name="ck_api_usage_requests_non_negative"),
    )
    op.create_index("ix_api_usage_daily_organization_id", "api_usage_daily", ["organization_id"])
    op.create_index("ix_api_usage_day", "api_usage_daily", ["day"])


def downgrade() -> None:
    op.drop_table("api_usage_daily")
    op.drop_table("api_keys")
    op.drop_table("organizations")
    op.execute("DELETE FROM pricing_tiers WHERE currency = 'ETB'")
    op.execute("UPDATE pricing_tiers SET effective_to = NULL WHERE currency = 'USD'")
    op.drop_constraint("ck_pricing_tier_quota_non_negative", "pricing_tiers", type_="check")
    op.drop_column("pricing_tiers", "api_quota_monthly")
