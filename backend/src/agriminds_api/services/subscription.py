"""Signed agreements, and the revenue they add up to.

Revenue is counted from subscriptions that are live on the day asked about — not from the price
list. The two are different questions and the platform keeps them apart: the catalogue total says
what one of everything would fetch, this says what is actually owed.
"""

from __future__ import annotations

import datetime as dt
import logging
import uuid
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from agriminds_api.core.exceptions import NotFoundError, ValidationError
from agriminds_api.db.models import (
    BillingPeriod,
    Organization,
    PricingTier,
    Subscription,
    SubscriptionStatus,
)
from agriminds_api.schemas.billing import _as_amount
from agriminds_api.schemas.subscription import (
    RevenueByStakeholder,
    RevenueSummary,
    SubscriptionCreate,
    SubscriptionOut,
)

log = logging.getLogger(__name__)

#: How far ahead a renewal is worth warning about. A quarter is long enough for a government
#: procurement cycle to start, which is the thing the warning is for.
RENEWAL_HORIZON_DAYS = 90

#: Which column of the rate card each billing period is sold from.
PRICE_COLUMN = {
    BillingPeriod.ANNUAL: "annual_cents",
    BillingPeriod.MONTHLY: "monthly_cents",
    BillingPeriod.DAILY: "daily_cents",
    BillingPeriod.PERPETUAL: "one_time_cents",
}


def _out(sub: Subscription, *, today: dt.date) -> SubscriptionOut:
    return SubscriptionOut(
        id=str(sub.id),
        organization_id=str(sub.organization_id),
        organization_name=sub.organization.name,
        stakeholder=sub.organization.stakeholder.value,
        billing_period=sub.billing_period.value,
        status=sub.status.value,
        currency=sub.currency,
        quantity=sub.quantity,
        unit_price_cents=sub.unit_price_cents,
        unit_price=_as_amount(sub.unit_price_cents),
        annualised_cents=sub.annualised_cents,
        annualised=_as_amount(sub.annualised_cents),
        started_on=sub.started_on,
        ends_on=sub.ends_on,
        days_to_renewal=(sub.ends_on - today).days if sub.ends_on else None,
        notes=sub.notes,
    )


class SubscriptionService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def _current_tier(self, stakeholder) -> PricingTier:
        tier = await self._session.scalar(
            select(PricingTier).where(
                PricingTier.stakeholder == stakeholder, PricingTier.effective_to.is_(None)
            )
        )
        if tier is None:
            raise NotFoundError(f"No price in force for {stakeholder.value}.")
        return tier

    async def create(self, req: SubscriptionCreate) -> SubscriptionOut:
        org = await self._session.get(Organization, uuid.UUID(req.organization_id))
        if org is None:
            raise NotFoundError("No such organization.")

        period = BillingPeriod(req.billing_period)
        tier = await self._current_tier(org.stakeholder)
        listed = getattr(tier, PRICE_COLUMN[period])
        price = req.unit_price_cents if req.unit_price_cents is not None else listed
        if price == 0 and req.unit_price_cents is None:
            raise ValidationError(
                f"The {org.stakeholder.value.replace('_', ' ')} tier has no "
                f"{req.billing_period} rate. Choose another period or name a negotiated price."
            )

        sub = Subscription(
            organization_id=org.id,
            # The version signed against, so a later reprice cannot restate this agreement.
            pricing_tier_id=tier.id,
            billing_period=period,
            unit_price_cents=price,
            currency=tier.currency,
            quantity=req.quantity,
            started_on=req.started_on,
            ends_on=req.ends_on,
            status=SubscriptionStatus.ACTIVE,
            notes=req.notes,
        )
        self._session.add(sub)
        await self._session.flush()
        await self._session.refresh(sub, ["organization"])
        log.info(
            "subscription for %s: %s %s x%d from %s",
            org.name,
            period.value,
            price,
            req.quantity,
            req.started_on,
        )
        return _out(sub, today=dt.date.today())

    async def list(self, *, organization_id: uuid.UUID | None = None) -> list[SubscriptionOut]:
        stmt = (
            select(Subscription)
            .options(selectinload(Subscription.organization))
            .order_by(Subscription.started_on.desc())
        )
        if organization_id is not None:
            stmt = stmt.where(Subscription.organization_id == organization_id)
        rows = (await self._session.scalars(stmt)).all()
        today = dt.date.today()
        return [_out(s, today=today) for s in rows]

    async def end(self, subscription_id: uuid.UUID, on: dt.date) -> SubscriptionOut:
        sub = await self._session.get(
            Subscription, subscription_id, options=[selectinload(Subscription.organization)]
        )
        if sub is None:
            raise NotFoundError("No such subscription.")
        if on < sub.started_on:
            raise ValidationError("A subscription cannot end before it started.")
        sub.ends_on = on
        sub.status = SubscriptionStatus.ENDED
        await self._session.flush()
        return _out(sub, today=dt.date.today())

    async def revenue(self, *, as_of: dt.date | None = None) -> RevenueSummary:
        today = as_of or dt.date.today()
        rows = (
            await self._session.scalars(select(Subscription).options(selectinload(Subscription.organization)))
        ).all()

        live = [s for s in rows if s.is_live(today)]
        arr = sum(s.annualised_cents for s in live)
        perpetual = sum(
            s.unit_price_cents * s.quantity for s in live if s.billing_period is BillingPeriod.PERPETUAL
        )

        grouped: dict[str, list[Subscription]] = defaultdict(list)
        for s in live:
            grouped[s.organization.stakeholder.value].append(s)

        by_stakeholder = sorted(
            (
                RevenueByStakeholder(
                    stakeholder=key,
                    label=subs[0].organization.stakeholder.value.replace("_", " ").title(),
                    subscriptions=len(subs),
                    annualised_cents=sum(s.annualised_cents for s in subs),
                    annualised=_as_amount(sum(s.annualised_cents for s in subs)),
                )
                for key, subs in grouped.items()
            ),
            key=lambda r: r.annualised_cents,
            reverse=True,
        )

        horizon = today + dt.timedelta(days=RENEWAL_HORIZON_DAYS)
        renewals = [s for s in live if s.ends_on and today <= s.ends_on <= horizon]
        # Still marked active but already past their end date: revenue nobody has chased.
        lapsed = [
            s for s in rows if s.status is SubscriptionStatus.ACTIVE and s.ends_on and s.ends_on < today
        ]

        return RevenueSummary(
            as_of=today,
            currency=live[0].currency if live else "ETB",
            active_subscriptions=len(live),
            arr_cents=arr,
            arr=_as_amount(arr),
            mrr_cents=arr // 12,
            mrr=_as_amount(arr // 12),
            perpetual_cents=perpetual,
            perpetual=_as_amount(perpetual),
            by_stakeholder=by_stakeholder,
            renewals_due=sorted(
                (_out(s, today=today) for s in renewals), key=lambda r: r.days_to_renewal or 0
            ),
            lapsed=[_out(s, today=today) for s in lapsed],
        )
