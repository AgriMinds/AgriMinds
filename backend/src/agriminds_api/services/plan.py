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

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

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
    Subscription,
    SubscriptionStatus,
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


def _invoice_out(inv: Invoice, *, today: dt.date) -> InvoiceOut:
    return InvoiceOut(
        id=str(inv.id),
        reference=inv.reference,
        organization_id=str(inv.organization_id),
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

    async def _tier(self, org: Organization) -> PricingTier:
        tier = await self._session.scalar(
            select(PricingTier).where(
                PricingTier.stakeholder == org.stakeholder, PricingTier.effective_to.is_(None)
            )
        )
        if tier is None:
            raise NotFoundError(
                f"There is no plan for {org.stakeholder.value.replace('_', ' ')} at the moment. "
                "Contact us and we will arrange one."
            )
        return tier

    async def plans(self, org: Organization) -> PlanSet:
        tier = await self._tier(org)
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
                Subscription.organization_id == org.id,
                Subscription.status.in_(
                    [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING_PAYMENT]
                ),
            )
            .order_by(Subscription.started_on.desc())
        )
        if current is not None:
            await self._session.refresh(current, ["organization"])

        return PlanSet(
            stakeholder=org.stakeholder.value,
            label=tier.label,
            unit=tier.unit,
            currency=tier.currency,
            strategy=tier.strategy,
            value_note=tier.value_note,
            api_quota_monthly=tier.api_quota_monthly,
            options=options,
            current=_subscription_out(current, today=dt.date.today()) if current else None,
        )

    async def _next_reference(self, today: dt.date) -> str:
        """`AGM-2026-000014`. From a sequence, so two people subscribing at once cannot collide."""
        number = await self._session.scalar(select(func.nextval("invoice_reference_seq")))
        return f"AGM-{today:%Y}-{int(number):06d}"

    async def choose(self, org: Organization, choice: PlanChoice) -> CheckoutResult:
        tier = await self._tier(org)
        period = BillingPeriod(choice.period)
        price = getattr(tier, PRICE_COLUMN[period])
        if price <= 0:
            raise ValidationError(
                f"{tier.label} is not sold {choice.period}. Choose another billing period."
            )

        live = await self._session.scalar(
            select(Subscription).where(
                Subscription.organization_id == org.id,
                Subscription.status.in_(
                    [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING_PAYMENT]
                ),
            )
        )
        if live is not None:
            raise ConflictError(
                "This account already has a plan. End the current one before choosing another."
            )

        today = dt.date.today()
        starts = choice.starts_on or today
        subscription = Subscription(
            organization_id=org.id,
            pricing_tier_id=tier.id,
            billing_period=period,
            # Frozen now: the price agreed at the moment of choosing, not whatever the catalogue
            # says when somebody eventually pays.
            unit_price_cents=price,
            currency=tier.currency,
            quantity=choice.quantity,
            started_on=starts,
            status=SubscriptionStatus.PENDING_PAYMENT,
        )
        self._session.add(subscription)
        await self._session.flush()

        amount = price * choice.quantity
        invoice = Invoice(
            reference=await self._next_reference(today),
            organization_id=org.id,
            subscription_id=subscription.id,
            amount_cents=amount,
            currency=tier.currency,
            description=f"{tier.label} — {choice.period}"
            + (f" x{choice.quantity}" if choice.quantity > 1 else ""),
            issued_on=today,
            due_on=today + dt.timedelta(days=self._settings.billing_due_days),
            status=InvoiceStatus.ISSUED,
        )
        self._session.add(invoice)
        await self._session.flush()
        await self._session.refresh(subscription, ["organization"])

        log.info("%s chose %s; invoice %s for %s", org.name, period.value, invoice.reference, amount)
        return CheckoutResult(
            subscription=_subscription_out(subscription, today=today),
            invoice=_invoice_out(invoice, today=today),
            pay_to=self._settings.billing_pay_to,
            instructions=(
                f"Transfer {_as_amount(amount)} {tier.currency} and quote {invoice.reference} as "
                f"the reference. Your plan starts once we confirm the payment."
            ),
        )

    async def invoices(self, organization_id: uuid.UUID) -> list[InvoiceOut]:
        rows = await self._session.scalars(
            select(Invoice)
            .where(Invoice.organization_id == organization_id)
            .order_by(Invoice.issued_on.desc())
        )
        today = dt.date.today()
        return [_invoice_out(i, today=today) for i in rows.all()]

    async def outstanding(self) -> list[InvoiceOut]:
        rows = await self._session.scalars(
            select(Invoice).where(Invoice.status == InvoiceStatus.ISSUED).order_by(Invoice.due_on)
        )
        today = dt.date.today()
        return [_invoice_out(i, today=today) for i in rows.all()]

    async def confirm_payment(
        self, invoice_id: uuid.UUID, confirmation: PaymentConfirmation
    ) -> InvoiceOut:
        """Mark a bill settled, and start the subscription it paid for."""
        invoice = await self._session.get(Invoice, invoice_id)
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
