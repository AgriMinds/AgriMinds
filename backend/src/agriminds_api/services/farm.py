"""Farm plots: ownership-checked CRUD plus the current risk for each plot."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from agriminds_api.core.exceptions import InvalidLocationError, ModelUnavailableError, NotFoundError
from agriminds_api.db.models import Crop, Farm, User, Woreda
from agriminds_api.domain.geo import GridSpec
from agriminds_api.domain.risk import risk_level
from agriminds_api.schemas.farm import FarmCreate, FarmOut, FarmRisk, FarmUpdate
from agriminds_api.services.inference import InferenceService, RiskCube


class FarmService:
    def __init__(self, session: AsyncSession, grid: GridSpec, inference: InferenceService) -> None:
        self._session = session
        self._grid = grid
        self._inference = inference

    # ------------------------------------------------------------------ helpers
    def _locate(self, latitude: float, longitude: float):
        try:
            return self._grid.cell_for(latitude, longitude)
        except ValueError as exc:
            raise InvalidLocationError(
                "That location is outside the Choke Mountain watershed covered by this forecast."
            ) from exc

    def _cube(self) -> RiskCube | None:
        try:
            return self._inference.risk_cube()
        except ModelUnavailableError:
            return None

    def to_out(self, farm: Farm, cube: RiskCube | None, lead_month: int = 1) -> FarmOut:
        out = FarmOut.model_validate(farm)
        if cube is not None:
            p = float(cube.probs[lead_month - 1, farm.grid_row, farm.grid_col])
            out.risk = FarmRisk(lead_month=lead_month, probability=round(p, 3), risk_level=risk_level(p))
        return out

    # ------------------------------------------------------------------ queries
    async def list_for_owner(self, owner: User, lead_month: int = 1) -> list[FarmOut]:
        farms = (
            await self._session.scalars(
                select(Farm)
                .where(Farm.owner_id == owner.id)
                .order_by(Farm.created_at)
                .options(selectinload(Farm.woreda))
            )
        ).all()
        cube = self._cube()
        return [self.to_out(f, cube, lead_month) for f in farms]

    async def get_owned(self, owner: User, farm_id: uuid.UUID) -> Farm:
        farm = await self._session.scalar(
            select(Farm).where(Farm.id == farm_id).options(selectinload(Farm.woreda))
        )
        # A farm belonging to someone else is reported as missing, not forbidden, so the
        # endpoint cannot be used to discover which plot ids exist.
        if farm is None or farm.owner_id != owner.id:
            raise NotFoundError("That plot does not exist.")
        return farm

    # ------------------------------------------------------------------ mutations
    async def create(self, owner: User, payload: FarmCreate, lead_month: int = 1) -> FarmOut:
        cell = self._locate(payload.latitude, payload.longitude)
        woreda_id = payload.woreda_id or owner.woreda_id
        if woreda_id is not None and not await self._session.get(Woreda, woreda_id):
            raise NotFoundError("That woreda does not exist.")
        farm = Farm(
            owner_id=owner.id,
            woreda_id=woreda_id,
            name=payload.name.strip(),
            latitude=payload.latitude,
            longitude=payload.longitude,
            grid_row=cell.row,
            grid_col=cell.col,
            area_hectares=payload.area_hectares,
            primary_crop=Crop(payload.primary_crop),
        )
        self._session.add(farm)
        await self._session.flush()
        await self._session.refresh(farm, ["woreda"])
        return self.to_out(farm, self._cube(), lead_month)

    async def update(
        self, owner: User, farm_id: uuid.UUID, payload: FarmUpdate, lead_month: int = 1
    ) -> FarmOut:
        farm = await self.get_owned(owner, farm_id)
        data = payload.model_dump(exclude_unset=True)
        if "name" in data and data["name"]:
            farm.name = data["name"].strip()
        if "area_hectares" in data and data["area_hectares"]:
            farm.area_hectares = data["area_hectares"]
        if "primary_crop" in data and data["primary_crop"]:
            farm.primary_crop = Crop(data["primary_crop"])
        if "woreda_id" in data:
            if data["woreda_id"] is not None and not await self._session.get(Woreda, data["woreda_id"]):
                raise NotFoundError("That woreda does not exist.")
            farm.woreda_id = data["woreda_id"]
        lat = data.get("latitude", farm.latitude)
        lon = data.get("longitude", farm.longitude)
        if lat != farm.latitude or lon != farm.longitude:
            cell = self._locate(lat, lon)
            farm.latitude, farm.longitude = lat, lon
            farm.grid_row, farm.grid_col = cell.row, cell.col
        await self._session.flush()
        await self._session.refresh(farm, ["woreda"])
        return self.to_out(farm, self._cube(), lead_month)

    async def delete(self, owner: User, farm_id: uuid.UUID) -> None:
        farm = await self.get_owned(owner, farm_id)
        await self._session.delete(farm)
        await self._session.flush()
