"""Reference data and an optional demonstration dataset.

``seed_geography`` and ``seed_pricing_tiers`` are reference data every deployment needs and are
safe to re-run.
``seed_demo`` creates sample accounts and plots; it refuses to run in production because the
passwords it sets are published in the README.
"""

from __future__ import annotations

import logging
import random
from dataclasses import dataclass
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from agriminds_api.core.config import Settings
from agriminds_api.core.security import hash_password, normalise_phone
from agriminds_api.db.models import (
    Crop,
    Farm,
    Locale,
    PricingTier,
    Region,
    StakeholderType,
    User,
    UserRole,
    Woreda,
    Zone,
)
from agriminds_api.domain.geo import GridSpec

log = logging.getLogger(__name__)

DEMO_PASSWORD = "AgriMinds#2026"


@dataclass(frozen=True)
class WoredaSeed:
    code: str
    en: str
    am: str
    om: str
    lat: float
    lon: float


# Woredas of the Choke Mountain watershed, East Gojjam zone, Amhara region.
# Coordinates are representative district points inside the modelled bounding box
# (37.6-38.4 E, 10.4-11.2 N); replace them with official centroids before operational use.
WOREDAS: tuple[WoredaSeed, ...] = (
    WoredaSeed("SNN", "Sinan", "ሲናን", "Sinan", 10.95, 37.95),
    WoredaSeed("MCK", "Machakel", "ማቻከል", "Machakel", 10.72, 37.72),
    WoredaSeed("GZM", "Gozamin", "ጎዛምን", "Gozamin", 10.55, 37.78),
    WoredaSeed("DBT", "Debay Tilatgen", "ደባይ ጥላትግን", "Debay Tilatgen", 10.80, 38.15),
    WoredaSeed("ENW", "Enarj Enawga", "እናርጅ እናውጋ", "Enarj Enawga", 10.70, 38.25),
    WoredaSeed("HEE", "Hulet Eju Enese", "ሁለት እጁ እነሴ", "Hulet Eju Enese", 10.90, 38.30),
    WoredaSeed("BSL", "Baso Liben", "ባሶ ሊበን", "Baso Liben", 10.48, 38.05),
    WoredaSeed("AND", "Aneded", "አነደድ", "Aneded", 10.60, 38.00),
)


async def seed_geography(session: AsyncSession) -> dict[str, Woreda]:
    """Create or update Amhara / East Gojjam / Choke woredas. Idempotent."""
    region = await session.scalar(select(Region).where(Region.code == "ET-AM"))
    if region is None:
        region = Region(code="ET-AM", name_en="Amhara", name_am="አማራ", name_om="Amaaraa")
        session.add(region)
        await session.flush()

    zone = await session.scalar(select(Zone).where(Zone.region_id == region.id, Zone.code == "EGJ"))
    if zone is None:
        zone = Zone(
            region_id=region.id,
            code="EGJ",
            name_en="East Gojjam",
            name_am="ምሥራቅ ጎጃም",
            name_om="Gojjaam Bahaa",
        )
        session.add(zone)
        await session.flush()

    existing = {
        w.code: w for w in (await session.scalars(select(Woreda).where(Woreda.zone_id == zone.id))).all()
    }
    for seed in WOREDAS:
        woreda = existing.get(seed.code)
        if woreda is None:
            woreda = Woreda(zone_id=zone.id, code=seed.code)
            session.add(woreda)
            existing[seed.code] = woreda
        woreda.name_en, woreda.name_am, woreda.name_om = seed.en, seed.am, seed.om
        woreda.latitude, woreda.longitude = seed.lat, seed.lon
    await session.flush()
    log.info("geography ready: 1 region, 1 zone, %d woredas", len(existing))
    return existing


# ------------------------------------------------------------------ demo dataset
FARMER_NAMES = (
    "Abebe Kebede",
    "Almaz Tesfaye",
    "Birhanu Alemu",
    "Chaltu Negash",
    "Dawit Haile",
    "Emebet Girma",
    "Fikadu Tadesse",
    "Genet Worku",
    "Hailu Mekonnen",
    "Kidist Assefa",
    "Lemma Desta",
    "Meseret Yilma",
)
PLOT_NAMES = ("Upper field", "Lower field", "Home plot", "River plot", "Hillside plot")


async def seed_demo(session: AsyncSession, settings: Settings, password: str = DEMO_PASSWORD) -> dict:
    """Create demonstration accounts and plots. Safe to re-run: existing accounts are left alone."""
    if settings.is_production:
        raise RuntimeError(
            "Refusing to seed demonstration accounts in production: their passwords are public."
        )

    woredas = await seed_geography(session)
    grid = GridSpec.from_bbox(settings.grid_rows, settings.grid_cols, settings.bbox)
    by_code = {code: w for code, w in woredas.items()}
    hashed = hash_password(password)  # hash once: argon2 is deliberately slow
    rng = random.Random(42)  # deterministic dataset across runs
    created_users = 0
    created_farms = 0

    async def ensure_user(**kwargs) -> User | None:
        """Return the new user, or None when an account with that identifier already exists."""
        clause = User.email == kwargs["email"] if kwargs.get("email") else User.phone == kwargs["phone"]
        if await session.scalar(select(User).where(clause)):
            return None
        user = User(hashed_password=hashed, **kwargs)
        session.add(user)
        await session.flush()
        return user

    staff = [
        dict(
            email="minister@moa.gov.et",
            phone=None,
            full_name="Ministry of Agriculture (demo account)",
            role=UserRole.MINISTER,
            locale=Locale.EN,
            woreda_id=None,
        ),
        dict(
            email="agent.sinan@moa.gov.et",
            phone=None,
            full_name="Development Agent, Sinan (demo account)",
            role=UserRole.AGENT,
            locale=Locale.AM,
            woreda_id=by_code["SNN"].id,
        ),
        dict(
            email="admin@agriminds.et",
            phone=None,
            full_name="Platform Administrator (demo account)",
            role=UserRole.ADMIN,
            locale=Locale.EN,
            woreda_id=None,
        ),
    ]
    for spec in staff:
        if await ensure_user(**spec):
            created_users += 1

    codes = [s.code for s in WOREDAS]
    for index, name in enumerate(FARMER_NAMES):
        woreda = by_code[codes[index % len(codes)]]
        farmer = await ensure_user(
            email=None,
            phone=normalise_phone(f"09120000{index + 1:02d}"),
            full_name=name,
            role=UserRole.FARMER,
            locale=Locale.AM if index % 3 else Locale.EN,
            woreda_id=woreda.id,
        )
        if farmer is None:
            continue
        created_users += 1

        for plot in range(rng.randint(1, 3)):
            # Scatter plots a few kilometres around the district point, clamped to the modelled box.
            lat = min(max(woreda.latitude + rng.uniform(-0.06, 0.06), grid.lat_min), grid.lat_max)
            lon = min(max(woreda.longitude + rng.uniform(-0.06, 0.06), grid.lon_min), grid.lon_max)
            cell = grid.cell_for(lat, lon)
            session.add(
                Farm(
                    owner_id=farmer.id,
                    woreda_id=woreda.id,
                    name=PLOT_NAMES[plot % len(PLOT_NAMES)],
                    latitude=round(lat, 5),
                    longitude=round(lon, 5),
                    grid_row=cell.row,
                    grid_col=cell.col,
                    area_hectares=round(rng.uniform(0.25, 3.0), 2),
                    primary_crop=rng.choice(list(Crop)),
                )
            )
            created_farms += 1
    await session.flush()

    totals = {
        "users_created": created_users,
        "farms_created": created_farms,
        "users_total": int(await session.scalar(select(func.count()).select_from(User)) or 0),
        "farms_total": int(await session.scalar(select(func.count()).select_from(Farm)) or 0),
    }
    log.info("demo data: %s", totals)
    return totals


# ---------------------------------------------------------------------------- pricing

#: The rate card, in santim (1/100 birr), as (stakeholder, label, unit, rates..., api quota).
#:
#: Birr rather than dollars: Ethiopian institutions budget in birr, and a price list is a local
#: commercial decision rather than an exchange-rate calculation. Migration 0005 installs the same
#: figures and deliberately keeps its own copy — a migration is a frozen record of what the schema
#: held then, so it must not import this module and start changing retroactively when prices move.
PRICING_TIERS: tuple[tuple[str, str, str, int, int, int, int, int], ...] = (
    ("federal_ministry", "Federal ministry", "per ministry",
     1_800_000_000, 450_000_000, 45_000_000, 1_233_000, 1_000_000),
    ("international_partner", "International partner / NGO", "per organisation",
     1_200_000_000, 300_000_000, 30_000_000, 822_000, 500_000),
    ("regional_government", "Regional / zonal government", "per bureau",
     720_000_000, 180_000_000, 18_000_000, 493_000, 250_000),
    ("private_sector", "Private sector", "per company",
     480_000_000, 120_000_000, 12_000_000, 329_000, 100_000),
    ("development_agent", "Development agent", "per woreda",
     48_000_000, 12_000_000, 1_200_000, 33_000, 25_000),
    ("research", "Research / university", "per institution",
     0, 6_000_000, 600_000, 16_500, 50_000),
    ("cooperative", "Cooperative", "per cooperative",
     12_000_000, 3_000_000, 300_000, 8_200, 10_000),
    ("farmer_premium", "Farmer (premium)", "per farmer", 0, 15_000, 1_500, 41, 0),
)


async def seed_pricing_tiers(session: AsyncSession, effective_from: date | None = None) -> int:
    """Install the opening rate card for any stakeholder that has no price in force.

    Idempotent: a stakeholder already priced is left exactly as it is, because overwriting a rate
    an administrator set would restate what somebody is being charged.
    """
    priced = set(
        (
            await session.scalars(
                select(PricingTier.stakeholder).where(PricingTier.effective_to.is_(None))
            )
        ).all()
    )
    start = effective_from or date.today()
    added = 0
    for key, label, unit, one_time, annual, monthly, daily, quota in PRICING_TIERS:
        stakeholder = StakeholderType(key)
        if stakeholder in priced:
            continue
        session.add(
            PricingTier(
                stakeholder=stakeholder,
                label=label,
                unit=unit,
                currency="ETB",
                one_time_cents=one_time,
                annual_cents=annual,
                monthly_cents=monthly,
                daily_cents=daily,
                api_quota_monthly=quota,
                effective_from=start,
            )
        )
        added += 1
    if added:
        await session.commit()
        log.info("seeded %d pricing tier(s)", added)
    return added
