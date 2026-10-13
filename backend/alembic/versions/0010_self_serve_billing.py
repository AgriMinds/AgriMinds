"""Let a customer choose a plan themselves, and get a bill for it.

Approval created an account and then stopped. There was no way for a cooperative to pick a plan,
no bill, and no record that anybody had paid — an administrator had to enter a subscription on
their behalf, which is not a product, it is a favour.

Three pieces close that.

* **`users.organization_id`** — until now a user belonged to a woreda and to nothing else, so a
  signed-in person could not be shown *their* account's billing. A smallholder stays null: they
  pay for themselves and are not an institution's seat.
* **`pending_payment`** — a subscription that has been chosen but not settled. It is deliberately
  excluded from revenue: an unpaid subscription counted as ARR turns a record into a forecast.
* **`invoices`** — what is owed, against a reference a payer can type into a bank transfer. A
  UUID does not survive being copied by hand, so references come from a sequence and read as
  `AGM-2026-000014`.

Money does not move through this platform, by design. The flow a card-based service does in one
step is three here: choose, pay offline, confirm. Slower, and the only version where every birr
reported as earned traces to an invoice somebody marked settled.

Revision ID: 0010_self_serve
Revises: 0009_access_requests
Create Date: 2026-10-13
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0010_self_serve"
down_revision: str | None = "0009_access_requests"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

INVOICE_STATUSES = ("issued", "paid", "void")
PAYMENT_METHODS = ("bank_transfer", "telebirr", "cheque", "cash", "other")


def upgrade() -> None:
    # A new enum value cannot be used in the transaction that adds it.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'pending_payment'")

    op.add_column(
        "users",
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_users_organization_id", "users", ["organization_id"])

    bind = op.get_bind()
    sa.Enum(*INVOICE_STATUSES, name="invoice_status").create(bind, checkfirst=True)
    sa.Enum(*PAYMENT_METHODS, name="payment_method").create(bind, checkfirst=True)
    invoice_status = postgresql.ENUM(name="invoice_status", create_type=False)
    payment_method = postgresql.ENUM(name="payment_method", create_type=False)

    # A sequence rather than counting rows: two people subscribing at once must not be handed the
    # same reference, and a count would do exactly that.
    op.execute("CREATE SEQUENCE IF NOT EXISTS invoice_reference_seq START 1")

    op.create_table(
        "invoices",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("reference", sa.String(length=32), nullable=False),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "subscription_id",
            sa.Uuid(),
            sa.ForeignKey("subscriptions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("amount_cents", sa.BigInteger(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="ETB"),
        sa.Column("description", sa.String(length=255), nullable=False),
        sa.Column("issued_on", sa.Date(), nullable=False),
        sa.Column("due_on", sa.Date(), nullable=False),
        sa.Column("status", invoice_status, nullable=False, server_default="issued"),
        sa.Column("paid_on", sa.Date(), nullable=True),
        sa.Column("method", payment_method, nullable=True),
        sa.Column("payment_reference", sa.String(length=128), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("reference", name="uq_invoice_reference"),
        sa.CheckConstraint("amount_cents >= 0", name="ck_invoice_amount_non_negative"),
        sa.CheckConstraint("due_on >= issued_on", name="ck_invoice_due_after_issue"),
    )
    op.create_index("ix_invoices_reference", "invoices", ["reference"])
    op.create_index("ix_invoices_organization_id", "invoices", ["organization_id"])
    op.create_index("ix_invoices_subscription_id", "invoices", ["subscription_id"])
    op.create_index("ix_invoices_issued_on", "invoices", ["issued_on"])
    op.create_index("ix_invoices_due_on", "invoices", ["due_on"])
    op.create_index("ix_invoices_status", "invoices", ["status"])
    op.create_index("ix_invoices_org_status", "invoices", ["organization_id", "status"])


def downgrade() -> None:
    op.drop_table("invoices")
    op.execute("DROP SEQUENCE IF EXISTS invoice_reference_seq")
    sa.Enum(name="payment_method").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="invoice_status").drop(op.get_bind(), checkfirst=True)
    op.drop_index("ix_users_organization_id", table_name="users")
    op.drop_column("users", "organization_id")
