"""A front door: let a farmer or an institution ask, instead of waiting to be found.

Until now every account was created by an administrator who already knew the customer. The
platform could price, meter and invoice, and had no way to receive an enquiry — a back office with
no way in.

A request is a lead, kept apart from `organizations` on purpose: most enquiries never become
customers, and putting them in the accounts table would pollute the rows revenue is counted from.
Approval is what creates the account, and the link back is kept so any account can be traced to
how it arrived.

Revision ID: 0009_access_requests
Revises: 0008_business_v2
Create Date: 2026-10-13
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0009_access_requests"
down_revision: str | None = "0008_business_v2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

KINDS = ("farmer_premium", "organization")
STATUSES = ("new", "contacted", "approved", "declined")


def upgrade() -> None:
    bind = op.get_bind()
    sa.Enum(*KINDS, name="request_kind").create(bind, checkfirst=True)
    sa.Enum(*STATUSES, name="request_status").create(bind, checkfirst=True)
    kind = postgresql.ENUM(name="request_kind", create_type=False)
    status = postgresql.ENUM(name="request_status", create_type=False)
    stakeholder = postgresql.ENUM(name="stakeholder_type", create_type=False)

    op.create_table(
        "access_requests",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("kind", kind, nullable=False),
        sa.Column("status", status, nullable=False, server_default="new"),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("stakeholder", stakeholder, nullable=True),
        sa.Column("organization_name", sa.String(length=160), nullable=True),
        sa.Column("contact_name", sa.String(length=120), nullable=False),
        sa.Column("contact_email", sa.String(length=254), nullable=True),
        sa.Column("contact_phone", sa.String(length=32), nullable=True),
        sa.Column("woreda_id", sa.Uuid(), sa.ForeignKey("woredas.id", ondelete="SET NULL"), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decision_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_access_requests_kind", "access_requests", ["kind"])
    op.create_index("ix_access_requests_status", "access_requests", ["status"])
    op.create_index("ix_access_requests_user_id", "access_requests", ["user_id"])
    op.create_index("ix_access_requests_status_created", "access_requests", ["status", "created_at"])


def downgrade() -> None:
    op.drop_table("access_requests")
    sa.Enum(name="request_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="request_kind").drop(op.get_bind(), checkfirst=True)
