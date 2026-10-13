"""The commercial model as the business defined it: seven segments, three products.

This replaces the figures seeded in 0005/0006 with the rate card the business actually agreed.
The changes are not cosmetic:

* **Insurers, microfinance and agricultural lenders** are a new segment. They buy risk analytics
  rather than advisories, which is a different product and a different price.
* **Development agents** become *agricultural offices and extension agents*, still per woreda.
* **International partners** become *government agencies, NGOs and development partners*.
* **Regional government** and **private sector** are retired: the agreed model has no line for
  them. Their rows are closed rather than deleted, so an organisation already recorded against
  either keeps a readable history — but it will have no price in force until a segment is chosen
  for it.

Two columns are added because the model carries more than a number. `strategy` is how a segment is
sold to, and `value_note` is the argument that justifies the price to the buyer — the figure a
farmer weighs the subscription against. Keeping them beside the price means a quote and its
justification cannot drift apart.

Three products are recorded too, so the rate card and what is actually delivered stay connected.

Revision ID: 0008_business_v2
Revises: 0007_message_credits
Create Date: 2026-10-13
"""

from __future__ import annotations

import datetime as dt
import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0008_business_v2"
down_revision: str | None = "0007_message_credits"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

#: (stakeholder, label, unit, annual, monthly, daily, api quota, strategy, value note) — birr.
#: Amounts are santim. A zero period means the segment is not sold on that term: a farmer buys a
#: season, not a day.
MODEL = (
    (
        "farmer_premium", "Farmers (premium)", "per farmer",
        46_500, 0, 0, 0,
        "Free basic alerts; affordable premium subscription.",
        "ETB 70,000 in avoided losses covers the annual subscription cost.",
    ),
    (
        "development_agent", "Agricultural offices & extension agents", "per woreda",
        6_000_000, 500_000, 16_400, 25_000,
        "Institutional service contracts and annual licenses.",
        "Shared across many farmers, reducing the cost per farmer.",
    ),
    (
        "cooperative", "Cooperatives & farmer unions", "per cooperative",
        2_400_000, 200_000, 6_600, 10_000,
        "Group subscriptions and sponsored member access.",
        "Shared subscription costs improve affordability for members.",
    ),
    (
        "insurer_lender", "Insurers, microfinance & agricultural lenders", "per institution",
        18_000_000, 1_500_000, 49_300, 100_000,
        "Paid analytics, licensed dashboards and data services.",
        "Compare fees with potential savings on claims and defaults.",
    ),
    (
        "federal_ministry", "Federal ministries", "per ministry",
        60_000_000, 5_000_000, 164_400, 1_000_000,
        "National or multi-region annual licenses.",
        "Compare costs with improved drought preparedness.",
    ),
    (
        "research", "Research institutes & universities", "per institution",
        3_000_000, 250_000, 8_200, 50_000,
        "Affordable annual research licenses.",
        "Supports climate research and risk analysis at modest cost.",
    ),
    (
        "international_partner", "Government agencies, NGOs & development partners", "per organisation",
        30_000_000, 2_500_000, 82_200, 500_000,
        "Annual contracts, sponsored farmer access and funded pilot projects.",
        "Potential losses avoided across the programmes they fund.",
    ),
)

PRODUCTS = (
    ("A", "Farmer Drought Alert", "Seasonal drought warnings and crop advisories delivered to the farmer, in their own language.", ["farmer_premium"]),
    ("B", "Cooperative & Extension Package", "Bulk advisory delivery, member management and woreda-level reporting for the people who reach farmers.", ["cooperative", "development_agent"]),
    ("C", "Institutional Risk Intelligence", "Watershed forecasts, historical indices, scenario runs and API access for underwriting, lending and policy.", ["insurer_lender", "federal_ministry", "research", "international_partner"]),
)


def upgrade() -> None:
    # A new enum value cannot be used in the transaction that adds it, so it is committed first.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE stakeholder_type ADD VALUE IF NOT EXISTS 'insurer_lender'")

    op.add_column("pricing_tiers", sa.Column("strategy", sa.Text(), nullable=True))
    op.add_column("pricing_tiers", sa.Column("value_note", sa.Text(), nullable=True))

    bind = op.get_bind()
    today = dt.date.today()
    bind.execute(
        sa.text(
            "UPDATE pricing_tiers SET effective_to = :today "
            "WHERE effective_to IS NULL AND effective_from < :today"
        ),
        {"today": today},
    )
    bind.execute(
        sa.text("DELETE FROM pricing_tiers WHERE effective_to IS NULL AND effective_from >= :today"),
        {"today": today},
    )

    stakeholder = postgresql.ENUM(name="stakeholder_type", create_type=False)
    tiers = sa.table(
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
        sa.column("api_quota_monthly", sa.BigInteger()),
        sa.column("effective_from", sa.Date()),
        sa.column("effective_to", sa.Date()),
        sa.column("strategy", sa.Text()),
        sa.column("value_note", sa.Text()),
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
                # The agreed model sells subscriptions; no perpetual licence is offered.
                "one_time_cents": 0,
                "annual_cents": annual,
                "monthly_cents": monthly,
                "daily_cents": daily,
                "api_quota_monthly": quota,
                "effective_from": today,
                "effective_to": None,
                "strategy": strategy,
                "value_note": value_note,
            }
            for key, label, unit, annual, monthly, daily, quota, strategy, value_note in MODEL
        ],
    )

    op.create_table(
        "products",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("code", sa.String(length=4), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        # An array rather than a join table: three products, each naming the segments it serves,
        # and nothing else references the pairing.
        sa.Column("stakeholders", postgresql.ARRAY(sa.String(length=40)), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("code", name="uq_product_code"),
    )
    op.bulk_insert(
        sa.table(
            "products",
            sa.column("id", sa.Uuid()),
            sa.column("code", sa.String()),
            sa.column("name", sa.String()),
            sa.column("summary", sa.Text()),
            sa.column("stakeholders", postgresql.ARRAY(sa.String())),
        ),
        [
            {"id": uuid.uuid4(), "code": code, "name": name, "summary": summary, "stakeholders": who}
            for code, name, summary, who in PRODUCTS
        ],
    )


def downgrade() -> None:
    op.drop_table("products")
    op.drop_column("pricing_tiers", "value_note")
    op.drop_column("pricing_tiers", "strategy")
    # The enum value stays: dropping one requires rebuilding the type, and an unused value is
    # harmless where a half-rebuilt type is not.
