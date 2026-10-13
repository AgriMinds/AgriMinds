"""Choosing a plan, and the bill that follows.

A card-based service does this in one step. Here it is three, because money does not move through
the platform: the customer chooses, an invoice is issued against a reference they can quote on a
bank transfer, and an administrator confirms receipt. Only then is the subscription active.

The subscription exists from the moment of choosing, as `pending_payment`. That is deliberate — it
records the intent, carries the price agreed at the moment of choosing, and is excluded from
revenue until settled. An unpaid subscription counted as ARR would turn a record into a forecast.
"""

from __future__ import annotations

import datetime as dt
import logging
import uuid
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from agriminds_api.core.config import Settings
from agriminds_api.core.exceptions import ConflictError, NotFoundError, ValidationError
from agriminds_api.db.models import (
    PERIODS_PER_YEAR,
    BillingPeriod,
    Invoice,
    InvoiceStatus,
    Organization,
    PaymentMethod,
    PricingTier,
    StakeholderType,
    Subscription,
    SubscriptionStatus,
    User,
)
from agriminds_api.schemas.billing import _as_amount
from agriminds_api.schemas.plan import (
    CheckoutResult,
    InvoiceOut,
    PaymentConfirmation,
    PlanChoice,
    PlanOption,
    PlanSet,
)
from agriminds_api.services.subscription import PRICE_COLUMN
from agriminds_api.services.subscription import _out as _subscription_out

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class Payer:
    """Who is buying: an institution, or one farmer buying premium for themselves.

    Everything downstream -- the rate card to read, the row to write, the invoice to address --
    follows from this one distinction, so it is resolved once at the edge and passed down rather
    than re-derived from a nullable column in each method.
    """

    stakeholder: StakeholderType
    name: str
    organization: Organization | None = None
    user: User | None = None

    @classmethod
    def institution(cls, org: Organization) -> Payer:
        return cls(stakeholder=org.stakeholder, name=org.name, organization=org)

    @classmethod
    def farmer(cls, user: User) -> Payer:
        return cls(stakeholder=StakeholderType.FARMER_PREMIUM, name=user.full_name, user=user)

    @property
    def owner_clause(self):
        """The `where` that selects this payer's own rows, and nobody else's."""
        if self.organization is not None:
            return Subscription.organization_id == self.organization.id
        return Subscription.user_id == self.user.id

    @property
    def invoice_clause(self):
        if self.organization is not None:
            return Invoice.organization_id == self.organization.id
        return Invoice.user_id == self.user.id

    @property
    def columns(self) -> dict[str, uuid.UUID]:
        """The payer columns to write. Exactly one, which the check constraint also enforces."""
        if self.organization is not None:
            return {"organization_id": self.organization.id}
        return {"user_id": self.user.id}


def term_end(starts: dt.date, period: BillingPeriod) -> dt.date | None:
    """When the term bought runs out, or None for a perpetual licence.

    A self-serve subscription was being created open-ended, which meant no plan ever reached its
    end date: the renewals and lapsed lists an administrator works from stayed empty however many
    annual plans were sold. A term that was paid for has an end, and it is this.
    """
    if period is BillingPeriod.PERPETUAL:
        return None
    if period is BillingPeriod.DAILY:
        return starts + dt.timedelta(days=1)
    if period is BillingPeriod.ANNUAL:
        # 29 February plus a year is 28 February: the term still ends, a day earlier.
        try:
            return starts.replace(year=starts.year + 1)
        except ValueError:
            return starts.replace(year=starts.year + 1, day=28)
    month = starts.month % 12 + 1
    year = starts.year + (1 if starts.month == 12 else 0)
    # The 31st of a 30-day month lands on its last day rather than overflowing into the next.
    last = (dt.date(year + (month == 12), month % 12 + 1, 1) - dt.timedelta(days=1)).day
    return dt.date(year, month, min(starts.day, last))


def _invoice_out(inv: Invoice, *, today: dt.date) -> InvoiceOut:
    return InvoiceOut(
        id=str(inv.id),
        reference=inv.reference,
        organization_id=str(inv.organization_id) if inv.organization_id else None,
        payer_name=inv.payer_name,
        subscription_id=str(inv.subscription_id) if inv.subscription_id else None,
        amount_cents=inv.amount_cents,
        amount=_as_amount(inv.amount_cents),
        currency=inv.currency,
        description=inv.description,
        issued_on=inv.issued_on,
        due_on=inv.due_on,
        status=inv.status.value,
        paid_on=inv.paid_on,
        method=inv.method.value if inv.method else None,
        payment_reference=inv.payment_reference,
        overdue=inv.is_overdue(today),
    )


class PlanService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self._session = session
        self._settings = settings

    async def _tier(self, payer: Payer) -> PricingTier:
        tier = await self._session.scalar(
            select(PricingTier).where(
                PricingTier.stakeholder == payer.stakeholder, PricingTier.effective_to.is_(None)
            )
        )
        if tier is None:
            raise NotFoundError(
                f"There is no plan for {payer.stakeholder.value.replace('_', ' ')} at the moment. "
                "Contact us and we will arrange one."
            )
        return tier

    async def plans(self, payer: Payer) -> PlanSet:
        tier = await self._tier(payer)
        offered: list[tuple[BillingPeriod, int]] = []
        for period, column in PRICE_COLUMN.items():
            price = getattr(tier, column)
            # A zero means this tier is simply not sold on that term — a farmer buys a season,
            # not a day — so it is left out rather than shown as free.
            if price > 0:
                offered.append((period, price))

        def annualised(period: BillingPeriod, price: int) -> int:
            return price * PERIODS_PER_YEAR.get(period, 0)

        recurring = [(p, c) for p, c in offered if p in PERIODS_PER_YEAR]
        dearest = max((annualised(p, c) for p, c in recurring), default=0)

        options = [
            PlanOption(
                period=period.value,
                unit_price_cents=price,
                unit_price=_as_amount(price),
                annualised_cents=annualised(period, price),
                annualised=_as_amount(annualised(period, price)),
                saving_vs_shortest_pct=(
                    round((1 - annualised(period, price) / dearest) * 100, 1)
                    if dearest and period in PERIODS_PER_YEAR
                    else 0.0
                ),
            )
            for period, price in offered
        ]

        current = await self._session.scalar(
            select(Subscription)
            .where(
                payer.owner_clause,
                Subscription.status.in_([SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING_PAYMENT]),
            )
            .order_by(Subscription.started_on.desc())
        )
        if current is not None:
            await self._session.refresh(current, ["organization", "user"])

        # The reference on an unpaid bill is the only thing a customer can quote on a transfer, so
        # it has to be readable again after they close the page rather than only at checkout.
        today = dt.date.today()
        open_bill = (
            await self._session.scalar(
                select(Invoice)
                .where(payer.invoice_clause, Invoice.status == InvoiceStatus.ISSUED)
                .options(selectinload(Invoice.organization), selectinload(Invoice.user))
                .order_by(Invoice.issued_on.desc())
            )
            if current is not None
            else None
        )

        return PlanSet(
            pay_to=self._settings.billing_pay_to,
            outstanding=_invoice_out(open_bill, today=today) if open_bill else None,
            stakeholder=payer.stakeholder.value,
            label=tier.label,
            unit=tier.unit,
            currency=tier.currency,
            strategy=tier.strategy,
            value_note=tier.value_note,
            api_quota_monthly=tier.api_quota_monthly,
            options=options,
            current=_subscription_out(current, today=today) if current else None,
        )

    async def _next_reference(self, today: dt.date) -> str:
        """`AGM-2026-000014`. From a sequence, so two people subscribing at once cannot collide."""
        number = await self._session.scalar(select(func.nextval("invoice_reference_seq")))
        return f"AGM-{today:%Y}-{int(number):06d}"

    async def choose(self, payer: Payer, choice: PlanChoice) -> CheckoutResult:
        tier = await self._tier(payer)
        period = BillingPeriod(choice.period)
        price = getattr(tier, PRICE_COLUMN[period])
        if price <= 0:
            raise ValidationError(f"{tier.label} is not sold {choice.period}. Choose another billing period.")

        live = await self._session.scalar(
            select(Subscription).where(
                payer.owner_clause,
                Subscription.status.in_([SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING_PAYMENT]),
            )
        )
        if live is not None:
            raise ConflictError(
                "This account already has a plan. End the current one before choosing another."
            )

        quantity = choice.quantity
        if payer.user is not None and quantity != 1:
            # The farmer tier is priced "per farmer" and the payer is one farmer. A quantity here
            # would silently multiply their bill with nothing to show for it.
            raise ValidationError("Premium is per farmer, so the quantity is always one.")

        today = dt.date.today()
        starts = choice.starts_on or today
        subscription = Subscription(
            **payer.columns,
            pricing_tier_id=tier.id,
            billing_period=period,
            # Frozen now: the price agreed at the moment of choosing, not whatever the catalogue
            # says when somebody eventually pays.
            unit_price_cents=price,
            currency=tier.currency,
            quantity=quantity,
            started_on=starts,
            ends_on=term_end(starts, period),
            status=SubscriptionStatus.PENDING_PAYMENT,
        )
        self._session.add(subscription)
        await self._session.flush()

        amount = price * quantity
        invoice = Invoice(
            reference=await self._next_reference(today),
            **payer.columns,
            subscription_id=subscription.id,
            amount_cents=amount,
            currency=tier.currency,
            description=f"{tier.label} — {choice.period}" + (f" x{quantity}" if quantity > 1 else ""),
            issued_on=today,
            due_on=today + dt.timedelta(days=self._settings.billing_due_days),
            status=InvoiceStatus.ISSUED,
        )
        self._session.add(invoice)
        await self._session.flush()
        await self._session.refresh(subscription, ["organization", "user"])
        await self._session.refresh(invoice, ["organization", "user"])

        log.info("%s chose %s; invoice %s for %s", payer.name, period.value, invoice.reference, amount)
        return CheckoutResult(
            subscription=_subscription_out(subscription, today=today),
            invoice=_invoice_out(invoice, today=today),
            pay_to=self._settings.billing_pay_to,
            instructions=(
                f"Transfer {_as_amount(amount)} {tier.currency} and quote {invoice.reference} as "
                f"the reference. Your plan starts once we confirm the payment."
            ),
        )

    async def invoices(self, payer: Payer) -> list[InvoiceOut]:
        rows = await self._session.scalars(
            select(Invoice)
            .where(payer.invoice_clause)
            .options(selectinload(Invoice.organization), selectinload(Invoice.user))
            .order_by(Invoice.issued_on.desc())
        )
        today = dt.date.today()
        return [_invoice_out(i, today=today) for i in rows.all()]

    async def outstanding(self) -> list[InvoiceOut]:
        """Every unsettled bill, farmers' included: each one is waiting on the same human step."""
        rows = await self._session.scalars(
            select(Invoice)
            .where(Invoice.status == InvoiceStatus.ISSUED)
            .options(selectinload(Invoice.organization), selectinload(Invoice.user))
            .order_by(Invoice.due_on)
        )
        today = dt.date.today()
        return [_invoice_out(i, today=today) for i in rows.all()]

    async def confirm_payment(self, invoice_id: uuid.UUID, confirmation: PaymentConfirmation) -> InvoiceOut:
        """Mark a bill settled, and start the subscription it paid for."""
        invoice = await self._session.get(
            Invoice,
            invoice_id,
            options=[selectinload(Invoice.organization), selectinload(Invoice.user)],
        )
        if invoice is None:
            raise NotFoundError("No such invoice.")
        if invoice.status is InvoiceStatus.PAID:
            raise ConflictError(f"{invoice.reference} is already settled.")
        if invoice.status is InvoiceStatus.VOID:
            raise ConflictError(f"{invoice.reference} was cancelled and cannot be paid.")

        today = dt.date.today()
        invoice.status = InvoiceStatus.PAID
        invoice.paid_on = confirmation.paid_on or today
        invoice.method = PaymentMethod(confirmation.method)
        invoice.payment_reference = confirmation.payment_reference
        invoice.note = confirmation.note

        if invoice.subscription_id:
            subscription = await self._session.get(Subscription, invoice.subscription_id)
            if subscription and subscription.status is SubscriptionStatus.PENDING_PAYMENT:
                subscription.status = SubscriptionStatus.ACTIVE
                log.info("%s settled; subscription now active", invoice.reference)
        await self._session.flush()
        return _invoice_out(invoice, today=today)
