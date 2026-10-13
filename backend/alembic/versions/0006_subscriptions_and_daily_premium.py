"""The ledger, and a correction to the daily rate.

**Subscriptions.** Until now the platform could price a stakeholder type, issue API keys and meter
calls, but nothing recorded that a given organisation had agreed to a given rate on a given date.
Without that there is no revenue figure, no renewal date and no arrears — the catalogue total on
the pricing page is what one of everything would be worth, not what anybody is paying.

The agreed rate is copied onto the subscription at signing and the tier version is recorded
alongside it, so repricing the catalogue changes what new customers pay and leaves signed
agreements exactly as they were.

**The daily rate was mispriced.** It was annual/365, so a year bought one day at a time cost the
same as a year bought up front: the most flexible term carried no premium at all, while monthly
already carried 20%. A buyer reading the card closely would always take daily. It becomes
annual/250, which puts a year of daily at 1.46x the annual rate and restores the ladder that every
other term already followed: annual cheapest, then monthly, then daily.

Revision ID: 0006_subs_daily
Revises: 0005_etb_metering
Create Date: 2026-10-13
"""

from __future__ import annotations

import datetime as dt
import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006_subs_daily"
down_revision: str | None = "0005_etb_metering"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

BILLING_PERIODS = ("annual", "monthly", "daily", "perpetual")
SUBSCRIPTION_STATUSES = ("active", "suspended", "ended")

#: Days of the shortest term that add up to a year's price. Below 365 so flexibility is paid for.
DAILY_DIVISOR = 250


def upgrade() -> None:
    bind = op.get_bind()
    today = dt.date.today()

    # ---- the daily correction, as a reprice rather than an edit --------------------------
    live = (
        bind.execute(
            sa.text(
                "SELECT id, stakeholder, label, unit, currency, one_time_cents, annual_cents, "
                "monthly_cents, api_quota_monthly, effective_from "
                "FROM pricing_tiers WHERE effective_to IS NULL"
            )
        )
        .mappings()
        .all()
    )

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
        sa.column("notes", sa.Text()),
    )

    successors = []
    for row in live:
        daily = round(row["annual_cents"] / DAILY_DIVISOR) if row["annual_cents"] else 0
        successors.append(
            {
                "id": uuid.uuid4(),
                "stakeholder": row["stakeholder"],
                "label": row["label"],
                "unit": row["unit"],
                "currency": row["currency"],
                "one_time_cents": row["one_time_cents"],
                "annual_cents": row["annual_cents"],
                "monthly_cents": row["monthly_cents"],
                "daily_cents": daily,
                "api_quota_monthly": row["api_quota_monthly"],
                "effective_from": today,
                "effective_to": None,
                "notes": "Daily rate corrected: the shortest term now carries a premium.",
            }
        )

    if successors:
        # A row opened today has no history worth keeping and cannot be closed today either —
        # the window check forbids `effective_to = effective_from`.
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
        op.bulk_insert(tiers, successors)

    # ---- the ledger -----------------------------------------------------------------------
    sa.Enum(*BILLING_PERIODS, name="billing_period").create(bind, checkfirst=True)
    sa.Enum(*SUBSCRIPTION_STATUSES, name="subscription_status").create(bind, checkfirst=True)
    billing_period = postgresql.ENUM(name="billing_period", create_type=False)
    subscription_status = postgresql.ENUM(name="subscription_status", create_type=False)

    op.create_table(
        "subscriptions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "pricing_tier_id",
            sa.Uuid(),
            sa.ForeignKey("pricing_tiers.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("billing_period", billing_period, nullable=False),
        sa.Column("unit_price_cents", sa.BigInteger(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="ETB"),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("started_on", sa.Date(), nullable=False),
        sa.Column("ends_on", sa.Date(), nullable=True),
        sa.Column("status", subscription_status, nullable=False, server_default="active"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("unit_price_cents >= 0", name="ck_subscription_price_non_negative"),
        sa.CheckConstraint("quantity > 0", name="ck_subscription_quantity_positive"),
        sa.CheckConstraint("ends_on IS NULL OR ends_on >= started_on", name="ck_subscription_window_ordered"),
    )
    op.create_index("ix_subscriptions_organization_id", "subscriptions", ["organization_id"])
    op.create_index("ix_subscriptions_billing_period", "subscriptions", ["billing_period"])
    op.create_index("ix_subscriptions_started_on", "subscriptions", ["started_on"])
    op.create_index("ix_subscriptions_status", "subscriptions", ["status"])
    op.create_index("ix_subscriptions_status_ends", "subscriptions", ["status", "ends_on"])


def downgrade() -> None:
    op.drop_table("subscriptions")
    sa.Enum(name="subscription_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="billing_period").drop(op.get_bind(), checkfirst=True)
    op.execute("DELETE FROM pricing_tiers WHERE notes LIKE 'Daily rate corrected%'")
    op.execute("UPDATE pricing_tiers SET effective_to = NULL WHERE effective_to IS NOT NULL")
