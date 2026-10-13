"""Let a farmer buy the premium tier that was priced for them.

The platform priced a farmer premium at ETB 465 a year, gave farmers a form to ask for it, and an
administrator a button to approve the request. Approval then did nothing: a farmer could not choose
a plan, could not be billed, had no reference to pay against, and nothing in the product changed.
The card on their dashboard said "approved" and stopped there. That is where the farmer sat --
outside the billing system entirely, while every institutional segment went through it.

The fix is not a second billing system for individuals. It is to admit that a payer is either an
institution or one farmer, so a subscription and an invoice carry whichever of the two applies:

* **`subscriptions.user_id` / `invoices.user_id`** -- the farmer paying for themselves.
* **`organization_id` becomes nullable** on both, with a check constraint that exactly one payer is
  set. Without the constraint, "who owes this" would depend on which column the reading code looked
  at first.

A farmer deliberately does not get a one-person organisation instead. That would be the smaller
migration and the worse model: the institutional accounts list would fill with thousands of rows
that are not accounts, and every per-account figure would be measuring two different things.

Revision ID: 0012_farmer_payer
Revises: 0011_invitations
Create Date: 2026-10-13
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0012_farmer_payer"
down_revision: str | None = "0011_invitations"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    for table in ("subscriptions", "invoices"):
        op.add_column(
            table,
            sa.Column(
                "user_id",
                sa.Uuid(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=True,
            ),
        )
        op.create_index(f"ix_{table}_user_id", table, ["user_id"])
        op.alter_column(table, "organization_id", existing_type=sa.Uuid(), nullable=True)

    op.create_check_constraint(
        "ck_subscription_one_payer", "subscriptions", "(organization_id IS NULL) <> (user_id IS NULL)"
    )
    op.create_check_constraint(
        "ck_invoice_one_payer", "invoices", "(organization_id IS NULL) <> (user_id IS NULL)"
    )
    op.create_index("ix_invoices_user_status", "invoices", ["user_id", "status"])


def downgrade() -> None:
    # Every farmer-paid row would violate the restored NOT NULL, so they go first. They are
    # individual premium subscriptions and their bills; nothing institutional is touched.
    op.execute(sa.text("DELETE FROM invoices WHERE user_id IS NOT NULL"))
    op.execute(sa.text("DELETE FROM subscriptions WHERE user_id IS NOT NULL"))

    op.drop_index("ix_invoices_user_status", table_name="invoices")
    op.drop_constraint("ck_invoice_one_payer", "invoices", type_="check")
    op.drop_constraint("ck_subscription_one_payer", "subscriptions", type_="check")
    for table in ("subscriptions", "invoices"):
        op.alter_column(table, "organization_id", existing_type=sa.Uuid(), nullable=False)
        op.drop_index(f"ix_{table}_user_id", table_name=table)
        op.drop_column(table, "user_id")
