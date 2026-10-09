"""Persisted forecast snapshots.

Drought probabilities come from the model, not the database, so without this table a reporting
tool can describe who is registered but not what they are exposed to. One row per grid cell per
lead per model run makes the forecast joinable, keeps a history of what was issued when, and lets
Metabase (or any SQL client) read risk without loading PyTorch.
"""

from __future__ import annotations

import enum
from datetime import date

from sqlalchemy import Date, Enum, Float, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from agriminds_api.db.base import Base, Timestamps, UUIDPrimaryKey
from agriminds_api.db.models.advisory import RiskLevel, risk_level_enum


class PdsiCategory(enum.StrEnum):
    """Seven-band Sc-PDSI drought intensity, Table 2 of the study."""

    EXTREMELY_WET = "Extremely wet"
    VERY_WET = "Very wet"
    MODERATELY_WET = "Moderately wet"
    NORMAL = "Normal"
    MODERATELY_DRY = "Moderately dry"
    VERY_DRY = "Very dry"
    EXTREMELY_DRY = "Extremely dry"


pdsi_category_enum = Enum(PdsiCategory, name="pdsi_category", values_callable=lambda e: [m.value for m in e])


class RiskSnapshot(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "risk_snapshots"
    __table_args__ = (
        # One row per cell per lead per run. Expressed as a unique index rather than a named
        # constraint: five columns would overrun PostgreSQL's 63-character identifier limit under
        # the metadata naming convention, and a truncated name drifts from the migration forever.
        Index(
            "uq_risk_snapshots_run_cell",
            "issued_date",
            "model_version",
            "lead_month",
            "grid_row",
            "grid_col",
            unique=True,
        ),
        Index("ix_risk_snapshots_issued_lead", "issued_date", "lead_month"),
        Index("ix_risk_snapshots_cell", "grid_row", "grid_col"),
    )

    issued_date: Mapped[date] = mapped_column(Date, index=True)
    target_month: Mapped[date] = mapped_column(Date)
    model_version: Mapped[str] = mapped_column(String(64))
    data_source: Mapped[str] = mapped_column(String(32))  # 'real' | 'synthetic' | 'unknown'
    lead_month: Mapped[int] = mapped_column(Integer)
    grid_row: Mapped[int] = mapped_column(Integer)
    grid_col: Mapped[int] = mapped_column(Integer)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    probability: Mapped[float] = mapped_column(Float)
    risk_level: Mapped[RiskLevel] = mapped_column(risk_level_enum, index=True)
    # Observed ground dryness for the issue month; absent when the record has no mean temperature.
    pdsi: Mapped[float | None] = mapped_column(Float)
    pdsi_category: Mapped[PdsiCategory | None] = mapped_column(pdsi_category_enum)
