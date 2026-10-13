"""Organizations, API credentials and metering.

The quota check runs on every metered request, so it must not cost a full aggregate each time.
The durable record is ``api_usage_daily`` in PostgreSQL — that is what an invoice is computed
from — and the cache holds the month-to-date total for sixty seconds purely to keep the check
cheap. The consequence is stated rather than hidden: a customer can overshoot their quota by at
most the requests they make inside one cache window. For a monthly quota that tolerance is
irrelevant, and the alternative is an aggregate query per request.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import logging
import secrets

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from agriminds_api.core.cache import Cache
from agriminds_api.core.exceptions import ConflictError, NotFoundError
from agriminds_api.db.models import ApiKey, ApiUsageDaily, Organization, PricingTier, StakeholderType

log = logging.getLogger(__name__)

#: Keys are recognisable on sight so a leaked one can be spotted in a log or a repository.
KEY_PREFIX = "agm_"
#: Seconds the month-to-date count may be stale. See the module docstring.
USAGE_CACHE_TTL = 60


def hash_key(presented: str) -> str:
    """SHA-256 of the key as presented. No salt: the key is already 256 bits of entropy, so a
    rainbow table is not a threat, and a deterministic hash is what makes lookup possible."""
    return hashlib.sha256(presented.encode("utf-8")).hexdigest()


def _month_start(today: dt.date) -> dt.date:
    return today.replace(day=1)


class CommerceService:
    def __init__(self, session: AsyncSession, cache: Cache | None = None) -> None:
        self._session = session
        self._cache = cache

    # ---- organizations -------------------------------------------------------------------
    async def create_organization(
        self, *, name: str, stakeholder: StakeholderType, contact_email: str | None, woreda_id=None
    ) -> Organization:
        existing = await self._session.scalar(select(Organization).where(Organization.name == name))
        if existing is not None:
            raise ConflictError(f"An organization called {name!r} already exists.")
        org = Organization(
            name=name, stakeholder=stakeholder, contact_email=contact_email, woreda_id=woreda_id
        )
        self._session.add(org)
        await self._session.flush()
        return org

    async def organization(self, organization_id) -> Organization:
        org = await self._session.get(Organization, organization_id)
        if org is None:
            raise NotFoundError("No such organization.")
        return org

    async def organizations(self) -> list[Organization]:
        return list((await self._session.scalars(select(Organization).order_by(Organization.name))).all())

    async def quota_for(self, stakeholder: StakeholderType) -> int:
        """The API allowance of the tier in force. Zero when the tier carries no API access."""
        quota = await self._session.scalar(
            select(PricingTier.api_quota_monthly).where(
                PricingTier.stakeholder == stakeholder, PricingTier.effective_to.is_(None)
            )
        )
        return int(quota or 0)

    # ---- credentials ---------------------------------------------------------------------
    async def issue_key(self, organization_id, label: str) -> tuple[ApiKey, str]:
        """Create a key and return it with its plaintext, which is never recoverable again."""
        org = await self.organization(organization_id)
        plaintext = f"{KEY_PREFIX}{secrets.token_urlsafe(32)}"
        key = ApiKey(
            organization_id=org.id,
            label=label,
            key_hash=hash_key(plaintext),
            last_four=plaintext[-4:],
        )
        self._session.add(key)
        await self._session.flush()
        log.info("issued API key %s for organization %s", key.last_four, org.name)
        return key, plaintext

    async def revoke_key(self, organization_id, key_id) -> ApiKey:
        key = await self._session.get(ApiKey, key_id)
        if key is None or key.organization_id != organization_id:
            raise NotFoundError("No such API key for this organization.")
        if key.revoked_at is None:
            key.revoked_at = dt.datetime.now(dt.UTC)
            await self._session.flush()
        return key

    async def keys_for(self, organization_id) -> list[ApiKey]:
        return list(
            (
                await self._session.scalars(
                    select(ApiKey)
                    .where(ApiKey.organization_id == organization_id)
                    .order_by(ApiKey.created_at.desc())
                )
            ).all()
        )

    async def active_key_count(self, organization_id) -> int:
        return int(
            await self._session.scalar(
                select(func.count())
                .select_from(ApiKey)
                .where(ApiKey.organization_id == organization_id, ApiKey.revoked_at.is_(None))
            )
            or 0
        )

    async def resolve_key(self, presented: str) -> tuple[Organization, ApiKey] | None:
        """The organization behind a presented key, or None when it is unknown or revoked."""
        key = await self._session.scalar(
            select(ApiKey).where(ApiKey.key_hash == hash_key(presented), ApiKey.revoked_at.is_(None))
        )
        if key is None:
            return None
        org = await self._session.get(Organization, key.organization_id)
        if org is None or not org.is_active:
            return None
        return org, key

    # ---- metering ------------------------------------------------------------------------
    def _usage_cache_key(self, organization_id, month: dt.date) -> str:
        return f"apiusage:{organization_id}:{month:%Y-%m}"

    async def month_to_date(self, organization_id, *, today: dt.date | None = None) -> int:
        day = today or dt.date.today()
        start = _month_start(day)
        cache_key = self._usage_cache_key(organization_id, start)
        if self._cache is not None:
            cached = self._cache.get(cache_key)
            if cached is not None:
                return int(cached)
        total = int(
            await self._session.scalar(
                select(func.coalesce(func.sum(ApiUsageDaily.requests), 0)).where(
                    ApiUsageDaily.organization_id == organization_id, ApiUsageDaily.day >= start
                )
            )
            or 0
        )
        if self._cache is not None:
            self._cache.set(cache_key, str(total).encode(), USAGE_CACHE_TTL)
        return total

    async def record_request(self, organization_id, *, today: dt.date | None = None) -> None:
        """Count one metered call. The upsert is the billing record; the cache just follows it."""
        day = today or dt.date.today()
        stmt = (
            pg_insert(ApiUsageDaily)
            .values(organization_id=organization_id, day=day, requests=1)
            .on_conflict_do_update(
                constraint="uq_api_usage_org_day",
                set_={"requests": ApiUsageDaily.__table__.c.requests + 1},
            )
        )
        await self._session.execute(stmt)
        if self._cache is not None:
            key = self._usage_cache_key(organization_id, _month_start(day))
            cached = self._cache.get(key)
            if cached is not None:
                self._cache.set(key, str(int(cached) + 1).encode(), USAGE_CACHE_TTL)

    async def daily_usage(self, organization_id, *, today: dt.date | None = None) -> list[ApiUsageDaily]:
        day = today or dt.date.today()
        return list(
            (
                await self._session.scalars(
                    select(ApiUsageDaily)
                    .where(
                        ApiUsageDaily.organization_id == organization_id,
                        ApiUsageDaily.day >= _month_start(day),
                    )
                    .order_by(ApiUsageDaily.day)
                )
            ).all()
        )
