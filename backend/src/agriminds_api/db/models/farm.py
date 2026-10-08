"""Farm plots owned by a farmer and located on the watershed grid."""

from __future__ import annotations

import enum
import uuid

from sqlalchemy import CheckConstraint, Enum, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from agriminds_api.db.base import Base, Timestamps, UUIDPrimaryKey


class Crop(enum.StrEnum):
    TEF = "tef"
    WHEAT = "wheat"
    MAIZE = "maize"


crop_enum = Enum(Crop, name="crop", values_callable=lambda e: [m.value for m in e])


class Farm(UUIDPrimaryKey, Timestamps, Base):
    """A plot of land.

    ``grid_row``/``grid_col`` are derived from the coordinates by ``domain.geo.GridSpec`` when the
    farm is created or moved, so risk lookups never recompute geometry at read time.
    """

    __tablename__ = "farms"
    __table_args__ = (
        CheckConstraint("area_hectares > 0 AND area_hectares <= 10000", name="area_positive"),
        CheckConstraint("grid_row >= 0 AND grid_col >= 0", name="grid_non_negative"),
        Index("ix_farms_grid", "grid_row", "grid_col"),
    )

    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    woreda_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("woredas.id", ondelete="SET NULL"), index=True
    )
    name: Mapped[str] = mapped_column(String(120))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    grid_row: Mapped[int] = mapped_column(Integer)
    grid_col: Mapped[int] = mapped_column(Integer)
    area_hectares: Mapped[float] = mapped_column(Float)
    primary_crop: Mapped[Crop] = mapped_column(crop_enum, default=Crop.TEF, index=True)

    owner: Mapped[User] = relationship(back_populates="farms")  # noqa: F821
    woreda: Mapped[Woreda | None] = relationship(lazy="joined")  # noqa: F821
