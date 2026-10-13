"""Give an approved organisation a way to sign in.

Approval created the organisation and linked it to the request, and there it stopped: no account,
and no endpoint anywhere that creates one. The organisation existed and nobody could reach it --
not the plans page the previous migration added, not an invoice, not the forecasts they had just
been approved for. Seeding was the only way an account came into being, which is not an onboarding
path, it is a development convenience.

An invitation is a single-use, expiring token against one named account. Only its hash is stored,
as with refresh tokens, so a database copy yields no working invitations. There is no mail server
here, so the token is shown to the approving administrator once and relayed by hand -- which is
exactly why it expires and works once.

Revision ID: 0011_invitations
Revises: 0010_self_serve
Create Date: 2026-10-13
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011_invitations"
down_revision: str | None = "0010_self_serve"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "invitations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("invited_by_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_invitations_user_id", "invitations", ["user_id"])
    # Unique because the token is the credential: a lookup must land on one row or none.
    op.create_index("ix_invitations_token_hash", "invitations", ["token_hash"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_invitations_token_hash", table_name="invitations")
    op.drop_index("ix_invitations_user_id", table_name="invitations")
    op.drop_table("invitations")
