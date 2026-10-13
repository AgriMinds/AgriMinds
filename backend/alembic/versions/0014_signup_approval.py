"""Let a farmer sign themselves up, and hold the account until somebody confirms it.

Until now an account could only come into being by seeding, by an invitation to an approved
organisation's contact, or not at all. A smallholder who heard about the platform had no way in --
which, for a system whose whole purpose is reaching smallholders, is the wrong door to leave shut.

Self sign-up cannot simply create a usable account: a plot's advisory is tied to a real holding in
a real kebele, and nothing on a sign-up form proves either. So a self-registered account starts
`pending` and a development agent or administrator confirms it.

`approval_status` is deliberately not `is_active`. That flag means an account that was usable and
was switched off; this one means an account that has never been usable yet. Collapsing them would
give the same sign-in message to somebody who should wait and somebody who should not bother.

Revision ID: 0014_signup
Revises: 0013_hotline
Create Date: 2026-10-13
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0014_signup"
down_revision: str | None = "0013_hotline"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

approval = postgresql.ENUM("pending", "approved", "rejected", name="approval_status", create_type=False)


def upgrade() -> None:
    approval.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "users",
        # Everyone who already exists got here by seeding or by invitation, so they are approved:
        # a default of `pending` would lock out every current account on deploy.
        sa.Column("approval_status", approval, nullable=False, server_default="approved"),
    )
    op.add_column(
        "users",
        sa.Column("approved_by_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    op.add_column("users", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("signup_note", sa.Text(), nullable=True))
    op.create_index("ix_users_approval_status", "users", ["approval_status"])


def downgrade() -> None:
    op.drop_index("ix_users_approval_status", table_name="users")
    for column in ("signup_note", "approved_at", "approved_by_id", "approval_status"):
        op.drop_column("users", column)
    approval.drop(op.get_bind(), checkfirst=True)
