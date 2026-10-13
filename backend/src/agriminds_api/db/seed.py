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
    Organization,
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


MINISTRY_NAME = "FDRE Ministry of Agriculture"


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

    # The demo staff belong to an institutional account, because billing is scoped to one: a user
    # with no organisation is correctly told there is nothing to subscribe, which makes the plans
    # and invoices pages unreachable in a demonstration. The platform administrator stays
    # unattached on purpose -- they operate the platform, they are not a customer of it.
    ministry = await session.scalar(
        select(Organization).where(
            Organization.name.in_((MINISTRY_NAME, "Ministry of Agriculture (demo account)"))
        )
    )
    if ministry is None:
        ministry = Organization(
            name=MINISTRY_NAME,
            stakeholder=StakeholderType.FEDERAL_MINISTRY,
            contact_email="minister@moa.gov.et",
        )
        session.add(ministry)
        await session.flush()
    elif ministry.name != MINISTRY_NAME:
        ministry.name = MINISTRY_NAME
        await session.flush()

    staff = [
        dict(
            email="minister@moa.gov.et",
            phone=None,
            full_name="Ministry of Agriculture (demo account)",
            role=UserRole.MINISTER,
            locale=Locale.EN,
            woreda_id=None,
            organization_id=ministry.id,
        ),
        dict(
            email="agent.sinan@moa.gov.et",
            phone=None,
            full_name="Development Agent, Sinan (demo account)",
            role=UserRole.AGENT,
            locale=Locale.AM,
            woreda_id=by_code["SNN"].id,
            organization_id=ministry.id,
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
        elif spec.get("organization_id") and spec["email"]:
            # The account already exists from an earlier seed, and `ensure_user` leaves it alone.
            # The organisation link has to be applied anyway, or a database seeded before billing
            # existed keeps staff who can never reach their own plans -- and reseeding, the one
            # thing anybody would try, would not fix it.
            existing = await session.scalar(select(User).where(User.email == spec["email"]))
            if existing is not None and existing.organization_id is None:
                existing.organization_id = spec["organization_id"]

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

#: The agreed commercial model, in santim. (stakeholder, label, unit, one-off, annual, monthly,
#: daily, api quota, strategy, value note).
#:
#: No perpetual licence: the model sells subscriptions. A zero period means the segment is not
#: sold on that term — a farmer buys a season, not a day.
#:
#: Migration 0008 installs the same figures and keeps its own copy, because a migration is a
#: frozen record of what the schema held then and must not shift when the price list does.
PRICING_TIERS: tuple[tuple, ...] = (
    (
        "federal_ministry",
        "Federal ministries",
        "per ministry",
        0,
        60_000_000,
        5_000_000,
        164_400,
        1_000_000,
        "National or multi-region annual licenses.",
        "Compare costs with improved drought preparedness.",
    ),
    (
        "international_partner",
        "Government agencies, NGOs & development partners",
        "per organisation",
        0,
        30_000_000,
        2_500_000,
        82_200,
        500_000,
        "Annual contracts, sponsored farmer access and funded pilot projects.",
        "Potential losses avoided across the programmes they fund.",
    ),
    (
        "insurer_lender",
        "Insurers, microfinance & agricultural lenders",
        "per institution",
        0,
        18_000_000,
        1_500_000,
        49_300,
        100_000,
        "Paid analytics, licensed dashboards and data services.",
        "Compare fees with potential savings on claims and defaults.",
    ),
    (
        "development_agent",
        "Agricultural offices & extension agents",
        "per woreda",
        0,
        6_000_000,
        500_000,
        16_400,
        25_000,
        "Institutional service contracts and annual licenses.",
        "Shared across many farmers, reducing the cost per farmer.",
    ),
    (
        "research",
        "Research institutes & universities",
        "per institution",
        0,
        3_000_000,
        250_000,
        8_200,
        50_000,
        "Affordable annual research licenses.",
        "Supports climate research and risk analysis at modest cost.",
    ),
    (
        "cooperative",
        "Cooperatives & farmer unions",
        "per cooperative",
        0,
        2_400_000,
        200_000,
        6_600,
        10_000,
        "Group subscriptions and sponsored member access.",
        "Shared subscription costs improve affordability for members.",
    ),
    (
        "farmer_premium",
        "Farmers (premium)",
        "per farmer",
        0,
        46_500,
        0,
        0,
        0,
        "Free basic alerts; affordable premium subscription.",
        "ETB 70,000 in avoided losses covers the annual subscription cost.",
    ),
)


async def seed_pricing_tiers(session: AsyncSession, effective_from: date | None = None) -> int:
    """Install the opening rate card for any stakeholder that has no price in force.

    Idempotent: a stakeholder already priced is left exactly as it is, because overwriting a rate
    an administrator set would restate what somebody is being charged.
    """
    priced = set(
        (
            await session.scalars(select(PricingTier.stakeholder).where(PricingTier.effective_to.is_(None)))
        ).all()
    )
    start = effective_from or date.today()
    added = 0
    for key, label, unit, one_time, annual, monthly, daily, quota, strategy, value_note in PRICING_TIERS:
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
                strategy=strategy,
                value_note=value_note,
                effective_from=start,
            )
        )
        added += 1
    if added:
        await session.commit()
        log.info("seeded %d pricing tier(s)", added)
    return added
