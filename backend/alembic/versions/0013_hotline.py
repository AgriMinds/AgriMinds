"""The 977 hotline: what farmers asked, and what was answered.

Smartphone farmers got a dashboard. Everyone else got nothing -- which in this watershed is most
farmers. The hotline is how a feature phone reaches the same forecast: an SMS or a USSD menu, and
an IVR call for someone who would rather hear it than read it.

Stored apart from `message_deliveries` on purpose. That table is a ledger against the message
credits an organisation buys; the hotline is free to the farmer and funded by the platform, so
putting a farmer's question through it would spend a cooperative's balance on a service the
cooperative is not providing.

Nothing here reaches a real handset yet: that needs a short code assigned by Ethio Telecom and an
SMS aggregator contract. The pipeline is complete up to the point where a provider takes the
message, which is why an unsent reply is recorded as `held` rather than `queued` -- it is not
waiting in a queue, it is waiting on a contract.

Revision ID: 0013_hotline
Revises: 0012_farmer_payer
Create Date: 2026-10-13
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0013_hotline"
down_revision: str | None = "0012_farmer_payer"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

channel = postgresql.ENUM("sms", "ussd", "voice", "chat", name="hotline_channel", create_type=False)
direction = postgresql.ENUM("inbound", "outbound", name="hotline_direction", create_type=False)
status = postgresql.ENUM("held", "sent", "failed", "received", name="hotline_status", create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    channel.create(bind, checkfirst=True)
    direction.create(bind, checkfirst=True)
    status.create(bind, checkfirst=True)

    op.create_table(
        "hotline_messages",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("direction", direction, nullable=False),
        sa.Column("channel", channel, nullable=False),
        sa.Column("caller", sa.String(length=20), nullable=False),
        sa.Column("short_code", sa.String(length=12), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("locale", sa.String(length=2), nullable=False, server_default="en"),
        sa.Column("intent", sa.String(length=32), nullable=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("session_id", sa.String(length=64), nullable=True),
        sa.Column("status", status, nullable=False, server_default="received"),
        sa.Column("provider_message_id", sa.String(length=128), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_hotline_messages_direction", "hotline_messages", ["direction"])
    op.create_index("ix_hotline_messages_channel", "hotline_messages", ["channel"])
    op.create_index("ix_hotline_messages_status", "hotline_messages", ["status"])
    op.create_index("ix_hotline_messages_user_id", "hotline_messages", ["user_id"])
    # The two reads this table exists for: one caller's history, and one session's turns.
    op.create_index("ix_hotline_caller_created", "hotline_messages", ["caller", "created_at"])
    op.create_index("ix_hotline_session", "hotline_messages", ["session_id"])


def downgrade() -> None:
    op.drop_table("hotline_messages")
    bind = op.get_bind()
    status.drop(bind, checkfirst=True)
    direction.drop(bind, checkfirst=True)
    channel.drop(bind, checkfirst=True)
