"""Role dashboards.

The ministry figures are produced by grouping farms per grid cell in SQL (at most rows x cols
groups) and then attaching the model's risk to each group in Python. That keeps the query cost
flat as the number of registered farms grows, and keeps model output out of the database.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pandas as pd
from sqlalchemy import Select, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from agriminds_api.core.exceptions import ModelUnavailableError
from agriminds_api.db.models import AdvisoryRecord, Crop, Farm, RiskLevel, User, UserRole, Woreda, Zone
from agriminds_api.domain.geo import GridSpec
from agriminds_api.domain.risk import risk_level
from agriminds_api.schemas.advisory import AdvisoryRequest
from agriminds_api.schemas.auth import UserOut
from agriminds_api.schemas.dashboard import (
    AdvisoryDelivery,
    CoverageStats,
    CropMixEntry,
    FarmerDashboard,
    MinistryDashboard,
    RiskBucket,
    RiskExposure,
    WoredaRisk,
)
from agriminds_api.services.advisory import AdvisoryService
from agriminds_api.services.enso import EnsoService
from agriminds_api.services.farm import FarmService
from agriminds_api.services.inference import InferenceService, RiskCube

AT_RISK = ("High", "Severe")
LEVEL_ORDER = ("Low", "Moderate", "High", "Severe")


class DashboardService:
    def __init__(
        self,
        session: AsyncSession,
        grid: GridSpec,
        inference: InferenceService,
        farms: FarmService,
        advisory: AdvisoryService,
        enso: EnsoService,
    ) -> None:
        self._session = session
        self._grid = grid
        self._inference = inference
        self._farms = farms
        self._advisory = advisory
        self._enso = enso

    def _cube(self) -> RiskCube | None:
        try:
            return self._inference.risk_cube()
        except ModelUnavailableError:
            return None

    # ================================================================== farmer
    async def farmer(self, user: User, lead_month: int = 1) -> FarmerDashboard:
        farms = await self._farms.list_for_owner(user, lead_month)
        cube = self._cube()
        dashboard = FarmerDashboard(user=UserOut.model_validate(user), farms=farms)
        if cube is not None:
            dashboard.provenance = cube.provenance()

        # Advise on the plot that needs attention first.
        rated = [f for f in farms if f.risk is not None]
        if rated:
            target = max(rated, key=lambda f: f.risk.probability)  # type: ignore[union-attr]
            dashboard.advisory_farm_id = target.id
            dashboard.advisory = self._advisory.evaluate(
                AdvisoryRequest(
                    crop=target.primary_crop,
                    lead_month=lead_month,
                    row=target.grid_row,
                    col=target.grid_col,
                )
            )
            await self.record_advisory(user, target.id, dashboard.advisory)

        try:
            outlook = self._enso.outlook()
            dashboard.enso_state = outlook.current_state
            dashboard.enso_summary = outlook.teleconnection_summary
        except ModelUnavailableError:
            pass
        return dashboard

    async def record_advisory(self, user: User, farm_id: uuid.UUID, advisory) -> None:
        """Log that this advisory was shown, once per plot, issue month, lead and crop."""
        issued = pd.Timestamp(advisory.provenance.issued_date).date()
        target = pd.Timestamp(advisory.target_date).date()
        exists = await self._session.scalar(
            select(AdvisoryRecord.id).where(
                AdvisoryRecord.farm_id == farm_id,
                AdvisoryRecord.issued_date == issued,
                AdvisoryRecord.lead_month == advisory.lead_month,
                AdvisoryRecord.crop == Crop(advisory.crop),
            )
        )
        if exists:
            return
        self._session.add(
            AdvisoryRecord(
                farm_id=farm_id,
                user_id=user.id,
                crop=Crop(advisory.crop),
                lead_month=advisory.lead_month,
                issued_date=issued,
                target_month=target,
                raw_probability=advisory.raw_probability,
                adjusted_probability=advisory.adjusted_probability,
                risk_level=RiskLevel(advisory.risk_level),
                model_version=advisory.provenance.model_version,
                rules_version=advisory.rules_version,
                data_source=advisory.provenance.data_source,
            )
        )
        await self._session.flush()

    # ================================================================== ministry
    def _scoped(self, stmt: Select, woreda_id: uuid.UUID | None, column) -> Select:
        return stmt.where(column == woreda_id) if woreda_id else stmt

    async def ministry(self, user: User, lead_month: int = 1) -> MinistryDashboard:
        # An agent only ever sees the district they are posted to.
        woreda_id = user.woreda_id if user.role is UserRole.AGENT else None
        now = datetime.now(UTC)
        since = now - timedelta(days=30)
        cube = self._cube()

        coverage = await self._coverage(woreda_id)
        by_cell = await self._farms_by_cell(woreda_id)
        exposure = await self._exposure(cube, by_cell, lead_month, woreda_id) if cube else None
        by_woreda = await self._by_woreda(cube, lead_month, woreda_id)
        crop_mix = await self._crop_mix(cube, lead_month, woreda_id)
        advisories = await self._advisory_delivery(since, woreda_id)

        scope = "Choke Mountain watershed"
        if woreda_id:
            woreda = await self._session.get(Woreda, woreda_id)
            scope = f"{woreda.name_en} woreda" if woreda else "Assigned woreda"

        return MinistryDashboard(
            generated_at=now,
            scope=scope,
            coverage=coverage,
            exposure=exposure,
            by_woreda=by_woreda,
            crop_mix=crop_mix,
            advisories=advisories,
            provenance=cube.provenance() if cube else None,
        )

    async def _coverage(self, woreda_id: uuid.UUID | None) -> CoverageStats:
        since = datetime.now(UTC) - timedelta(days=30)

        role_counts = dict(
            (
                await self._session.execute(
                    self._scoped(
                        select(User.role, func.count()).group_by(User.role), woreda_id, User.woreda_id
                    )
                )
            ).all()
        )
        active = await self._session.scalar(
            self._scoped(
                select(func.count()).select_from(User).where(
                    User.role == UserRole.FARMER, User.last_login_at >= since
                ),
                woreda_id,
                User.woreda_id,
            )
        )
        farms, hectares, covered = (
            await self._session.execute(
                self._scoped(
                    select(
                        func.count(Farm.id),
                        func.coalesce(func.sum(Farm.area_hectares), 0.0),
                        func.count(distinct(Farm.woreda_id)),
                    ),
                    woreda_id,
                    Farm.woreda_id,
                )
            )
        ).one()
        total_woredas = await self._session.scalar(select(func.count()).select_from(Woreda))

        return CoverageStats(
            farmers=int(role_counts.get(UserRole.FARMER, 0)),
            agents=int(role_counts.get(UserRole.AGENT, 0)),
            active_farmers_30d=int(active or 0),
            farms=int(farms or 0),
            hectares=round(float(hectares or 0.0), 2),
            woredas_covered=int(covered or 0),
            woredas_total=int(total_woredas or 0),
        )

    async def _farms_by_cell(self, woreda_id: uuid.UUID | None) -> list[tuple[int, int, int, float]]:
        rows = await self._session.execute(
            self._scoped(
                select(
                    Farm.grid_row,
                    Farm.grid_col,
                    func.count(Farm.id),
                    func.coalesce(func.sum(Farm.area_hectares), 0.0),
                ).group_by(Farm.grid_row, Farm.grid_col),
                woreda_id,
                Farm.woreda_id,
            )
        )
        return [(int(r), int(c), int(n), float(ha)) for r, c, n, ha in rows.all()]

    async def _exposure(
        self,
        cube: RiskCube,
        by_cell: list[tuple[int, int, int, float]],
        lead_month: int,
        woreda_id: uuid.UUID | None,
    ) -> RiskExposure:
        tally: dict[str, dict[str, float]] = {lvl: {"farms": 0, "hectares": 0.0} for lvl in LEVEL_ORDER}
        at_risk_cells: list[tuple[int, int]] = []
        for row, col, farms, hectares in by_cell:
            level = risk_level(float(cube.probs[lead_month - 1, row, col]))
            tally[level]["farms"] += farms
            tally[level]["hectares"] += hectares
            if level in AT_RISK:
                at_risk_cells.append((row, col))

        farmers_per_level = await self._farmers_per_level(cube, lead_month, woreda_id)
        farmers_at_risk = await self._distinct_owners_in_cells(at_risk_cells, woreda_id)

        buckets = [
            RiskBucket(
                risk_level=lvl,
                farms=int(tally[lvl]["farms"]),
                farmers=farmers_per_level.get(lvl, 0),
                hectares=round(tally[lvl]["hectares"], 2),
            )
            for lvl in LEVEL_ORDER
        ]
        return RiskExposure(
            lead_month=lead_month,
            target_date=cube.target(lead_month).strftime("%B %Y"),
            buckets=buckets,
            farms_at_risk=sum(b.farms for b in buckets if b.risk_level in AT_RISK),
            farmers_at_risk=farmers_at_risk,
            hectares_at_risk=round(sum(b.hectares for b in buckets if b.risk_level in AT_RISK), 2),
        )

    async def _farmers_per_level(
        self, cube: RiskCube, lead_month: int, woreda_id: uuid.UUID | None
    ) -> dict[str, int]:
        """Owners are counted once per level, even when they hold several plots in it."""
        cells_by_level: dict[str, list[tuple[int, int]]] = {lvl: [] for lvl in LEVEL_ORDER}
        for row in range(self._grid.rows):
            for col in range(self._grid.cols):
                cells_by_level[risk_level(float(cube.probs[lead_month - 1, row, col]))].append((row, col))
        return {
            lvl: await self._distinct_owners_in_cells(cells, woreda_id)
            for lvl, cells in cells_by_level.items()
        }

    async def _distinct_owners_in_cells(
        self, cells: list[tuple[int, int]], woreda_id: uuid.UUID | None
    ) -> int:
        if not cells:
            return 0
        pairs = [(r, c) for r, c in cells]
        stmt = select(func.count(distinct(Farm.owner_id))).where(
            func.row(Farm.grid_row, Farm.grid_col).in_([func.row(r, c) for r, c in pairs])
        )
        return int(await self._session.scalar(self._scoped(stmt, woreda_id, Farm.woreda_id)) or 0)

    async def _by_woreda(
        self, cube: RiskCube | None, lead_month: int, woreda_id: uuid.UUID | None
    ) -> list[WoredaRisk]:
        rows = (
            await self._session.execute(
                self._scoped(
                    select(
                        Woreda.id,
                        Woreda.name_en,
                        Woreda.name_am,
                        Woreda.name_om,
                        Zone.name_en,
                        Farm.grid_row,
                        Farm.grid_col,
                        func.count(Farm.id),
                        func.coalesce(func.sum(Farm.area_hectares), 0.0),
                        func.count(distinct(Farm.owner_id)),
                    )
                    .join(Farm, Farm.woreda_id == Woreda.id)
                    .join(Zone, Zone.id == Woreda.zone_id)
                    .group_by(
                        Woreda.id, Woreda.name_en, Woreda.name_am, Woreda.name_om, Zone.name_en,
                        Farm.grid_row, Farm.grid_col,
                    ),
                    woreda_id,
                    Farm.woreda_id,
                )
            )
        ).all()

        acc: dict[uuid.UUID, dict] = {}
        for wid, en, am, om, zone, row, col, farms, hectares, owners in rows:
            entry = acc.setdefault(
                wid,
                {
                    "names": (en, am, om, zone),
                    "farms": 0,
                    "hectares": 0.0,
                    "owners": 0,
                    "weighted": 0.0,
                    "worst": 0.0,
                },
            )
            entry["farms"] += int(farms)
            entry["hectares"] += float(hectares)
            entry["owners"] = max(entry["owners"], int(owners))
            if cube is not None:
                p = float(cube.probs[lead_month - 1, int(row), int(col)])
                entry["weighted"] += p * int(farms)
                entry["worst"] = max(entry["worst"], p)

        out = []
        for wid, e in acc.items():
            en, am, om, zone = e["names"]
            mean = e["weighted"] / e["farms"] if cube is not None and e["farms"] else 0.0
            out.append(
                WoredaRisk(
                    woreda_id=wid,
                    name_en=en,
                    name_am=am,
                    name_om=om,
                    zone_name_en=zone,
                    farmers=e["owners"],
                    farms=e["farms"],
                    hectares=round(e["hectares"], 2),
                    mean_probability=round(mean, 3),
                    worst_risk_level=risk_level(e["worst"]) if cube is not None else "Low",
                )
            )
        out.sort(key=lambda w: w.mean_probability, reverse=True)
        return out

    async def _crop_mix(
        self, cube: RiskCube | None, lead_month: int, woreda_id: uuid.UUID | None
    ) -> list[CropMixEntry]:
        rows = (
            await self._session.execute(
                self._scoped(
                    select(
                        Farm.primary_crop,
                        Farm.grid_row,
                        Farm.grid_col,
                        func.count(Farm.id),
                        func.coalesce(func.sum(Farm.area_hectares), 0.0),
                    ).group_by(Farm.primary_crop, Farm.grid_row, Farm.grid_col),
                    woreda_id,
                    Farm.woreda_id,
                )
            )
        ).all()

        acc: dict[str, dict[str, float]] = {}
        for crop, row, col, farms, hectares in rows:
            key = crop.value if hasattr(crop, "value") else str(crop)
            entry = acc.setdefault(key, {"farms": 0, "hectares": 0.0, "at_risk": 0})
            entry["farms"] += int(farms)
            entry["hectares"] += float(hectares)
            if cube is not None and risk_level(float(cube.probs[lead_month - 1, int(row), int(col)])) in AT_RISK:
                entry["at_risk"] += int(farms)

        return sorted(
            (
                CropMixEntry(
                    crop=crop,
                    farms=int(e["farms"]),
                    hectares=round(e["hectares"], 2),
                    farms_at_risk=int(e["at_risk"]),
                )
                for crop, e in acc.items()
            ),
            key=lambda c: c.hectares,
            reverse=True,
        )

    async def _advisory_delivery(self, since: datetime, woreda_id: uuid.UUID | None) -> AdvisoryDelivery:
        base = select(func.count(AdvisoryRecord.id))
        if woreda_id:
            base = base.join(Farm, Farm.id == AdvisoryRecord.farm_id).where(Farm.woreda_id == woreda_id)
        total = int(await self._session.scalar(base) or 0)
        recent = int(await self._session.scalar(base.where(AdvisoryRecord.created_at >= since)) or 0)
        acked = int(
            await self._session.scalar(
                base.where(
                    AdvisoryRecord.created_at >= since, AdvisoryRecord.acknowledged_at.is_not(None)
                )
            )
            or 0
        )
        return AdvisoryDelivery(
            issued_total=total,
            issued_30d=recent,
            acknowledged_30d=acked,
            acknowledgement_rate=round(acked / recent, 3) if recent else None,
        )
