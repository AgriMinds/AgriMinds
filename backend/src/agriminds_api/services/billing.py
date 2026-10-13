"""The pricing catalogue: reads the rate card, and versions it when an administrator changes it.

A price is never edited. Changing a tier closes the row in force and opens a new one, so a
subscription or invoice that referenced the old rate still resolves to what was actually charged.
The partial unique index on the table enforces that only one row per stakeholder is open-ended,
which means a concurrent double-submit fails at the database rather than leaving two live prices.
"""

from __future__ import annotations

import datetime as dt
import logging

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from agriminds_api.core.exceptions import ConflictError, NotFoundError
from agriminds_api.db.models import PricingTier, StakeholderType
from agriminds_api.schemas.billing import (
    PricingCatalogue,
    PricingTierChange,
    PricingTierOut,
    TierRates,
    _as_amount,
)

log = logging.getLogger(__name__)


def _out(tier: PricingTier) -> PricingTierOut:
    return PricingTierOut(
        id=str(tier.id),
        stakeholder=tier.stakeholder.value,
        label=tier.label,
        unit=tier.unit,
        currency=tier.currency,
        rates=TierRates.of(tier.one_time_cents, tier.annual_cents, tier.monthly_cents, tier.daily_cents),
        api_quota_monthly=tier.api_quota_monthly,
        effective_from=tier.effective_from,
        effective_to=tier.effective_to,
        is_current=tier.effective_to is None,
        notes=tier.notes,
    )


class BillingService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def catalogue(self, *, include_history: bool = False) -> PricingCatalogue:
        stmt = select(PricingTier)
        if not include_history:
            stmt = stmt.where(PricingTier.effective_to.is_(None))
        stmt = stmt.order_by(PricingTier.annual_cents.desc(), PricingTier.effective_from.desc())
        tiers = list((await self._session.scalars(stmt)).all())

        current = [t for t in tiers if t.effective_to is None]
        total = sum(t.annual_cents for t in current)
        return PricingCatalogue(
            currency=current[0].currency if current else "USD",
            as_of=dt.date.today(),
            tiers=[_out(t) for t in tiers],
            annual_total_cents=total,
            annual_total=_as_amount(total),
        )

    async def history(self, stakeholder: StakeholderType) -> list[PricingTierOut]:
        rows = await self._session.scalars(
            select(PricingTier)
            .where(PricingTier.stakeholder == stakeholder)
            .order_by(PricingTier.effective_from.desc())
        )
        tiers = [_out(t) for t in rows.all()]
        if not tiers:
            raise NotFoundError(f"No pricing recorded for {stakeholder.value}.")
        return tiers

    async def current(self, stakeholder: StakeholderType) -> PricingTier:
        tier = await self._session.scalar(
            select(PricingTier).where(
                PricingTier.stakeholder == stakeholder, PricingTier.effective_to.is_(None)
            )
        )
        if tier is None:
            raise NotFoundError(f"No current price for {stakeholder.value}.")
        return tier

    async def change(self, stakeholder: StakeholderType, req: PricingTierChange) -> PricingTierOut:
        """Close the price in force and open a new one. The old row is kept, never rewritten."""
        live = await self.current(stakeholder)
        if req.effective_from <= live.effective_from:
            raise ConflictError(
                f"{stakeholder.value} has been priced from {live.effective_from} already; a new "
                f"price must start after that, not on {req.effective_from}."
            )

        live.effective_to = req.effective_from
        successor = PricingTier(
            stakeholder=stakeholder,
            label=req.label or live.label,
            unit=req.unit or live.unit,
            currency=live.currency,
            one_time_cents=req.one_time_cents,
            annual_cents=req.annual_cents,
            monthly_cents=req.monthly_cents,
            daily_cents=req.daily_cents,
            # Carried forward when the caller does not restate it: a price change is usually
            # about money, and silently zeroing a customer's API allowance is not a price change.
            api_quota_monthly=req.api_quota_monthly or live.api_quota_monthly,
            effective_from=req.effective_from,
            effective_to=None,
            notes=req.notes,
        )
        self._session.add(successor)
        try:
            await self._session.flush()
        except IntegrityError as exc:
            # The partial unique index caught a second open-ended row for this stakeholder.
            await self._session.rollback()
            raise ConflictError(
                f"{stakeholder.value} was repriced by someone else; re-read the catalogue first."
            ) from exc

        log.info(
            "repriced %s from %s: annual %s -> %s cents",
            stakeholder.value,
            req.effective_from,
            live.annual_cents,
            req.annual_cents,
        )
        return _out(successor)
