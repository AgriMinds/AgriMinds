"""Selling and spending advisory-delivery credits.

The balance is derived on every read: bundles bought, less messages charged. Storing a running
total would be faster and would eventually disagree with the rows that justify it, which for
something a customer is billed on is the wrong trade.

A failed message is not charged for — the farmer did not receive their advisory, so the credit
goes back. That is why `used` counts queued and sent rather than every row.
"""

from __future__ import annotations

import datetime as dt
import logging
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from agriminds_api.core.exceptions import ConflictError, NotFoundError
from agriminds_api.core.security import normalise_phone
from agriminds_api.db.models import (
    DeliveryChannel,
    DeliveryStatus,
    MessageBundle,
    MessageDelivery,
    Organization,
)
from agriminds_api.schemas.billing import _as_amount
from agriminds_api.schemas.messaging import (
    BundleOut,
    BundlePurchase,
    CreditBalance,
    DeliveryOut,
    DeliveryRequest,
)

log = logging.getLogger(__name__)

#: No aggregator is wired in. Deliveries are recorded and queued; nothing leaves the building.
#: A visibly undrained queue is honest where a `sent` nobody sent would not be.
PROVIDER = "none"


def _bundle_out(bundle: MessageBundle, *, today: dt.date) -> BundleOut:
    return BundleOut(
        id=str(bundle.id),
        messages=bundle.messages,
        unit_price_cents=bundle.unit_price_cents,
        unit_price=_as_amount(bundle.unit_price_cents),
        value_cents=bundle.value_cents,
        value=_as_amount(bundle.value_cents),
        currency=bundle.currency,
        purchased_on=bundle.purchased_on,
        expires_on=bundle.expires_on,
        expired=bool(bundle.expires_on and bundle.expires_on < today),
    )


def _delivery_out(row: MessageDelivery) -> DeliveryOut:
    return DeliveryOut(
        id=str(row.id),
        recipient=row.recipient,
        locale=row.locale,
        channel=row.channel.value,
        status=row.status.value,
        body=row.body,
        created_at=row.created_at,
        sent_at=row.sent_at,
        failure_reason=row.failure_reason,
    )


class MessagingService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def _organization(self, organization_id: uuid.UUID) -> Organization:
        org = await self._session.get(Organization, organization_id)
        if org is None:
            raise NotFoundError("No such organization.")
        return org

    async def purchase(self, req: BundlePurchase) -> BundleOut:
        org = await self._organization(uuid.UUID(req.organization_id))
        today = dt.date.today()
        bundle = MessageBundle(
            organization_id=org.id,
            messages=req.messages,
            unit_price_cents=req.unit_price_cents,
            currency="ETB",
            purchased_on=req.purchased_on or today,
            expires_on=req.expires_on,
            notes=req.notes,
        )
        self._session.add(bundle)
        await self._session.flush()
        log.info("%s bought %d message credits", org.name, req.messages)
        return _bundle_out(bundle, today=today)

    async def balance(self, organization_id: uuid.UUID) -> CreditBalance:
        org = await self._organization(organization_id)
        today = dt.date.today()

        bundles = list(
            (
                await self._session.scalars(
                    select(MessageBundle)
                    .where(MessageBundle.organization_id == org.id)
                    .order_by(MessageBundle.purchased_on.desc())
                )
            ).all()
        )
        purchased = sum(b.messages for b in bundles if not (b.expires_on and b.expires_on < today))
        used = int(
            await self._session.scalar(
                select(func.count())
                .select_from(MessageDelivery)
                .where(
                    MessageDelivery.organization_id == org.id,
                    MessageDelivery.status != DeliveryStatus.FAILED,
                )
            )
            or 0
        )
        return CreditBalance(
            organization_id=str(org.id),
            organization_name=org.name,
            currency=bundles[0].currency if bundles else "ETB",
            purchased=purchased,
            used=used,
            remaining=max(purchased - used, 0),
            bundles=[_bundle_out(b, today=today) for b in bundles],
            provider=PROVIDER,
            deliverable=PROVIDER != "none",
        )

    async def queue(self, req: DeliveryRequest) -> DeliveryOut:
        org = await self._organization(uuid.UUID(req.organization_id))
        balance = await self.balance(org.id)
        if balance.remaining <= 0:
            raise ConflictError(
                f"{org.name} has no message credits left. "
                f"{balance.used} of {balance.purchased} used — buy a bundle to continue."
            )

        delivery = MessageDelivery(
            organization_id=org.id,
            channel=DeliveryChannel(req.channel),
            recipient=normalise_phone(req.recipient),
            body=req.body,
            locale=req.locale,
            status=DeliveryStatus.QUEUED,
        )
        self._session.add(delivery)
        await self._session.flush()
        return _delivery_out(delivery)

    async def deliveries(self, organization_id: uuid.UUID, limit: int = 50) -> list[DeliveryOut]:
        rows = await self._session.scalars(
            select(MessageDelivery)
            .where(MessageDelivery.organization_id == organization_id)
            .order_by(MessageDelivery.created_at.desc())
            .limit(limit)
        )
        return [_delivery_out(r) for r in rows.all()]
