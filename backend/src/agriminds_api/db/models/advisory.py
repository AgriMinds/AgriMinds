"""A record of every advisory the platform put in front of a farmer.

This table is what makes the ministry dashboard honest: delivery and acknowledgement figures
are counted from real rows, never estimated.
"""

from __future__ import annotations

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from agriminds_api.db.base import Base, Timestamps, UUIDPrimaryKey
from agriminds_api.db.models.farm import Crop, crop_enum


class RiskLevel(enum.StrEnum):
    LOW = "Low"
    MODERATE = "Moderate"
    HIGH = "High"
    SEVERE = "Severe"


risk_level_enum = Enum(RiskLevel, name="risk_level", values_callable=lambda e: [m.value for m in e])


class AdvisoryRecord(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "advisory_records"
    __table_args__ = (
        Index("ix_advisory_records_farm_issued", "farm_id", "issued_date"),
        Index("ix_advisory_records_created", "created_at"),
    )

    farm_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("farms.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    crop: Mapped[Crop] = mapped_column(crop_enum)
    lead_month: Mapped[int] = mapped_column(Integer)
    issued_date: Mapped[date] = mapped_column(Date)  # last month of input data the model used
    target_month: Mapped[date] = mapped_column(Date)  # month the forecast is about
    raw_probability: Mapped[float] = mapped_column(Float)
    adjusted_probability: Mapped[float] = mapped_column(Float)
    risk_level: Mapped[RiskLevel] = mapped_column(risk_level_enum, index=True)
    model_version: Mapped[str] = mapped_column(String(64))
    rules_version: Mapped[str] = mapped_column(String(64))
    data_source: Mapped[str] = mapped_column(String(32))  # 'real' | 'synthetic' | 'unknown'
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    farm: Mapped["Farm"] = relationship()  # noqa: F821
