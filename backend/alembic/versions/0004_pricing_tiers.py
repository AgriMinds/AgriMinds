"""Pricing tiers: what each stakeholder pays, and when that price was in force.

Seeds the eight tiers of the commercial model. Three regularities hold across every paying tier
and are worth stating, because they are the reason the numbers look arbitrary and are not:

    monthly  = annual / 10      paying by the year costs ten months, not twelve
    daily   ~= annual / 365
    one-off  = annual x 4       a perpetual licence priced as four years

Farmers and researchers have no one-time rate: those tiers are subscription-only.

Amounts are integer cents of USD. Rows are versioned rather than edited, so a later price change
closes this window and opens a new one instead of restating what anybody was already charged.

Revision ID: 0004_pricing_tiers
Revises: 0003_in_watershed
Create Date: 2026-10-12
"""

from __future__ import annotations

import datetime as dt
import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_pricing_tiers"
down_revision: str | None = "0003_in_watershed"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

STAKEHOLDERS = (
    "farmer_premium",
    "cooperative",
    "development_agent",
    "regional_government",
    "federal_ministry",
    "research",
    "international_partner",
    "private_sector",
)

#: (stakeholder, label, unit, one_time, annual, monthly, daily) in whole USD cents.
SEED = (
    ("farmer_premium", "Farmer (premium)", "per farmer", 0, 300, 30, 1),
    ("cooperative", "Cooperative", "per cooperative", 240_000, 60_000, 6_000, 160),
    ("development_agent", "Development agent", "per woreda", 960_000, 240_000, 24_000, 660),
    ("regional_government", "Regional / zonal government", "per bureau", 14_400_000, 3_600_000, 360_000, 9_900),
    ("federal_ministry", "Federal ministry", "per ministry", 36_000_000, 9_000_000, 900_000, 24_700),
    ("research", "Research / university", "per institution", 0, 120_000, 12_000, 330),
    ("international_partner", "International partner / NGO", "per organisation", 24_000_000, 6_000_000, 600_000, 16_400),
    ("private_sector", "Private sector", "per company", 9_600_000, 2_400_000, 240_000, 6_600),
)


def upgrade() -> None:
    # Created once up front with ``create_type=False`` on the column, as 0001 does: letting
    # ``create_table`` emit it as well raises "type already exists".
    sa.Enum(*STAKEHOLDERS, name="stakeholder_type").create(op.get_bind(), checkfirst=True)
    stakeholder = postgresql.ENUM(*STAKEHOLDERS, name="stakeholder_type", create_type=False)

    op.create_table(
        "pricing_tiers",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("stakeholder", stakeholder, nullable=False),
        sa.Column("label", sa.String(length=128), nullable=False),
        sa.Column("unit", sa.String(length=64), nullable=False, server_default="per organisation"),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="USD"),
        sa.Column("one_time_cents", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("annual_cents", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("monthly_cents", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("daily_cents", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("effective_to", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("one_time_cents >= 0", name="ck_pricing_tier_one_time_non_negative"),
        sa.CheckConstraint("annual_cents >= 0", name="ck_pricing_tier_annual_non_negative"),
        sa.CheckConstraint("monthly_cents >= 0", name="ck_pricing_tier_monthly_non_negative"),
        sa.CheckConstraint("daily_cents >= 0", name="ck_pricing_tier_daily_non_negative"),
        sa.CheckConstraint(
            "effective_to IS NULL OR effective_to > effective_from",
            name="ck_pricing_tier_window_ordered",
        ),
    )
    op.create_index("ix_pricing_tiers_stakeholder", "pricing_tiers", ["stakeholder"])
    op.create_index("ix_pricing_tiers_effective_from", "pricing_tiers", ["effective_from"])
    # The current price for a stakeholder must be unambiguous; superseded rows may repeat freely.
    op.create_index(
        "uq_pricing_tier_current",
        "pricing_tiers",
        ["stakeholder"],
        unique=True,
        postgresql_where=sa.text("effective_to IS NULL"),
    )

    today = dt.date.today()
    op.bulk_insert(
        sa.table(
            "pricing_tiers",
            sa.column("id", sa.Uuid()),
            sa.column("stakeholder", stakeholder),
            sa.column("label", sa.String()),
            sa.column("unit", sa.String()),
            sa.column("currency", sa.String()),
            sa.column("one_time_cents", sa.BigInteger()),
            sa.column("annual_cents", sa.BigInteger()),
            sa.column("monthly_cents", sa.BigInteger()),
            sa.column("daily_cents", sa.BigInteger()),
            sa.column("effective_from", sa.Date()),
            sa.column("effective_to", sa.Date()),
        ),
        [
            {
                "id": uuid.uuid4(),
                "stakeholder": key,
                "label": label,
                "unit": unit,
                "currency": "USD",
                "one_time_cents": one_time,
                "annual_cents": annual,
                "monthly_cents": monthly,
                "daily_cents": daily,
                "effective_from": today,
                "effective_to": None,
            }
            for key, label, unit, one_time, annual, monthly, daily in SEED
        ],
    )


def downgrade() -> None:
    op.drop_index("uq_pricing_tier_current", table_name="pricing_tiers")
    op.drop_index("ix_pricing_tiers_effective_from", table_name="pricing_tiers")
    op.drop_index("ix_pricing_tiers_stakeholder", table_name="pricing_tiers")
    op.drop_table("pricing_tiers")
    sa.Enum(name="stakeholder_type").drop(op.get_bind(), checkfirst=True)
