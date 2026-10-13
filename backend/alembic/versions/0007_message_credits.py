"""Advisory delivery to farmers without smartphones, and the credits that pay for it.

The forecast reaches a dashboard today. Most smallholders in the watershed do not have one, so the
advisory stops short of the person whose field it concerns. SMS is how it closes that gap, and it
is the one part of the platform that costs money per use — which makes credits the natural way to
sell it: a cooperative or a bureau buys a bundle, and each advisory delivered spends one.

Balance is derived from these two tables rather than stored, so it cannot drift from the rows that
justify it. A failed message is not charged for.

Nothing sends until an aggregator is configured; deliveries sit at `queued`.

Revision ID: 0007_message_credits
Revises: 0006_subs_daily
Create Date: 2026-10-13
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0007_message_credits"
down_revision: str | None = "0006_subs_daily"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CHANNELS = ("sms", "ussd")
STATUSES = ("queued", "sent", "failed")


def upgrade() -> None:
    bind = op.get_bind()
    sa.Enum(*CHANNELS, name="delivery_channel").create(bind, checkfirst=True)
    sa.Enum(*STATUSES, name="delivery_status").create(bind, checkfirst=True)
    channel = postgresql.ENUM(name="delivery_channel", create_type=False)
    status = postgresql.ENUM(name="delivery_status", create_type=False)

    op.create_table(
        "message_bundles",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("messages", sa.BigInteger(), nullable=False),
        sa.Column("unit_price_cents", sa.BigInteger(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="ETB"),
        sa.Column("purchased_on", sa.Date(), nullable=False),
        sa.Column("expires_on", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("messages > 0", name="ck_bundle_messages_positive"),
        sa.CheckConstraint("unit_price_cents >= 0", name="ck_bundle_price_non_negative"),
    )
    op.create_index("ix_message_bundles_organization_id", "message_bundles", ["organization_id"])
    op.create_index("ix_message_bundles_purchased_on", "message_bundles", ["purchased_on"])

    op.create_table(
        "message_deliveries",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("channel", channel, nullable=False, server_default="sms"),
        sa.Column("recipient", sa.String(length=32), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("locale", sa.String(length=2), nullable=False, server_default="am"),
        sa.Column("status", status, nullable=False, server_default="queued"),
        sa.Column("provider_ref", sa.String(length=128), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_message_deliveries_organization_id", "message_deliveries", ["organization_id"])
    op.create_index("ix_message_deliveries_recipient", "message_deliveries", ["recipient"])
    op.create_index("ix_message_deliveries_status", "message_deliveries", ["status"])
    op.create_index("ix_deliveries_org_status", "message_deliveries", ["organization_id", "status"])


def downgrade() -> None:
    op.drop_table("message_deliveries")
    op.drop_table("message_bundles")
    sa.Enum(name="delivery_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="delivery_channel").drop(op.get_bind(), checkfirst=True)
