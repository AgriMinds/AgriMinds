"""Ethiopian administrative hierarchy: region -> zone -> woreda.

Names are stored in all three interface languages so every client can label a place
without a translation table lookup.
"""

from __future__ import annotations

import uuid

from sqlalchemy import Float, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from agriminds_api.db.base import Base, Timestamps, UUIDPrimaryKey


class Region(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "regions"

    code: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    name_en: Mapped[str] = mapped_column(String(128))
    name_am: Mapped[str] = mapped_column(String(128))
    name_om: Mapped[str] = mapped_column(String(128))

    zones: Mapped[list[Zone]] = relationship(back_populates="region", cascade="all, delete-orphan")


class Zone(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "zones"
    __table_args__ = (UniqueConstraint("region_id", "code"),)

    region_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("regions.id", ondelete="CASCADE"), index=True)
    code: Mapped[str] = mapped_column(String(16), index=True)
    name_en: Mapped[str] = mapped_column(String(128))
    name_am: Mapped[str] = mapped_column(String(128))
    name_om: Mapped[str] = mapped_column(String(128))

    region: Mapped[Region] = relationship(back_populates="zones")
    woredas: Mapped[list[Woreda]] = relationship(back_populates="zone", cascade="all, delete-orphan")


class Woreda(UUIDPrimaryKey, Timestamps, Base):
    """District. The smallest unit the platform assigns users and farms to."""

    __tablename__ = "woredas"
    __table_args__ = (UniqueConstraint("zone_id", "code"),)

    zone_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("zones.id", ondelete="CASCADE"), index=True)
    code: Mapped[str] = mapped_column(String(16), index=True)
    name_en: Mapped[str] = mapped_column(String(128))
    name_am: Mapped[str] = mapped_column(String(128))
    name_om: Mapped[str] = mapped_column(String(128))
    # Representative point, used to centre maps and to pre-fill a new farm's location.
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)

    zone: Mapped[Zone] = relationship(back_populates="woredas")

    def name(self, locale: str) -> str:
        return {"am": self.name_am, "or": self.name_om}.get(locale, self.name_en)
