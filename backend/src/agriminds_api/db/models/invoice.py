"""What a customer owes for a subscription, and whether it has been settled.

The flow a card-based service does in one step — choose a plan, pay, start — is three steps here,
because money does not move through this platform. A customer chooses a plan, an invoice is issued
with a reference, they pay it by bank transfer or telebirr, and an administrator confirms receipt.
The subscription is `pending_payment` until then.

That is slower than a checkout and it is the honest shape: a button that said "Pay" and silently
activated an unpaid subscription would turn the revenue figures into fiction. Every birr reported
as earned traces to an invoice somebody marked settled.

The reference is the thing a bank transfer carries, so it is short, unique and human-readable.
Nothing else in the system is suitable: a UUID does not survive being copied into a transfer form
by hand.
"""

from __future__ import annotations

import datetime as dt
import enum
import uuid

from sqlalchemy import BigInteger, CheckConstraint, Date, Enum, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from agriminds_api.db.base import Base, Timestamps, UUIDPrimaryKey


class InvoiceStatus(enum.StrEnum):
    ISSUED = "issued"
    PAID = "paid"
    #: Cancelled before payment. Kept, never deleted: it is a number that was once quoted.
    VOID = "void"


class PaymentMethod(enum.StrEnum):
    BANK_TRANSFER = "bank_transfer"
    TELEBIRR = "telebirr"
    CHEQUE = "cheque"
    CASH = "cash"
    OTHER = "other"


invoice_status_enum = Enum(
    InvoiceStatus, name="invoice_status", values_callable=lambda e: [m.value for m in e]
)
payment_method_enum = Enum(
    PaymentMethod, name="payment_method", values_callable=lambda e: [m.value for m in e]
)


class Invoice(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "invoices"
    __table_args__ = (
        CheckConstraint("amount_cents >= 0", name="ck_invoice_amount_non_negative"),
        CheckConstraint("due_on >= issued_on", name="ck_invoice_due_after_issue"),
        # The same rule as the subscription it bills: one payer, an institution or a farmer.
        CheckConstraint("(organization_id IS NULL) <> (user_id IS NULL)", name="ck_invoice_one_payer"),
        Index("ix_invoices_org_status", "organization_id", "status"),
        Index("ix_invoices_user_status", "user_id", "status"),
    )

    #: What a payer types into a transfer form. Short enough to copy without error.
    reference: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=True
    )
    #: Set when a farmer is buying premium for themselves rather than an institution buying.
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=True
    )
    subscription_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("subscriptions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    #: Frozen at issue. Repricing the catalogue must never restate a bill already sent.
    amount_cents: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3), default="ETB")
    description: Mapped[str] = mapped_column(String(255))

    issued_on: Mapped[dt.date] = mapped_column(Date, index=True)
    due_on: Mapped[dt.date] = mapped_column(Date, index=True)
    status: Mapped[InvoiceStatus] = mapped_column(
        invoice_status_enum, default=InvoiceStatus.ISSUED, index=True
    )
    paid_on: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    method: Mapped[PaymentMethod | None] = mapped_column(payment_method_enum, nullable=True)
    #: The payer's own reference — a bank slip number, a telebirr transaction id.
    payment_reference: Mapped[str | None] = mapped_column(String(128), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    organization = relationship("Organization")
    user = relationship("User")
    subscription = relationship("Subscription")

    @property
    def payer_name(self) -> str:
        """Who this bill is addressed to. An administrator confirming a payment needs the name."""
        return self.organization.name if self.organization else self.user.full_name

    def is_overdue(self, on: dt.date) -> bool:
        return self.status is InvoiceStatus.ISSUED and self.due_on < on
