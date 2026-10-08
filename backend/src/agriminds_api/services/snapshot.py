"""Persisting a model run so it can be read with SQL.

The forecast is produced by PyTorch and cached in memory. Reporting tools speak SQL, and a
ministry needs to look back at what was issued last season, not only at what is current. This
writes one row per grid cell per lead for a given run, idempotently: re-running for the same
issue month and model version updates in place rather than duplicating.
"""

from __future__ import annotations

import logging
from datetime import date

import pandas as pd
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from agriminds_api.db.models import PdsiCategory, RiskLevel, RiskSnapshot
from agriminds_api.domain.geo import GridSpec
from agriminds_api.domain.risk import pdsi_category, risk_level
from agriminds_api.services.inference import InferenceService

log = logging.getLogger(__name__)


async def write_risk_snapshot(session: AsyncSession, inference: InferenceService, grid: GridSpec) -> dict:
    """Write the current risk cube to ``risk_snapshots``. Returns a summary."""
    cube = inference.risk_cube()
    observed = inference.observed_pdsi()
    issued = pd.Timestamp(cube.issued_date).date()

    rows = []
    for lead in range(1, cube.probs.shape[0] + 1):
        target = cube.target(lead).date().replace(day=1)
        for cell in grid.cells():
            probability = float(cube.probs[lead - 1, cell.row, cell.col])
            latitude, longitude = grid.centroid(cell)
            value = None if observed is None else round(float(observed[cell.row, cell.col]), 2)
            rows.append(
                {
                    "issued_date": issued,
                    "target_month": target,
                    "model_version": cube.model_version,
                    "data_source": cube.data_source,
                    "lead_month": lead,
                    "grid_row": cell.row,
                    "grid_col": cell.col,
                    "latitude": latitude,
                    "longitude": longitude,
                    "probability": round(probability, 4),
                    "risk_level": RiskLevel(risk_level(probability)),
                    "pdsi": value,
                    "pdsi_category": None if value is None else PdsiCategory(pdsi_category(value)),
                }
            )

    statement = insert(RiskSnapshot).values(rows)
    # Re-running the same model for the same month corrects the row rather than duplicating it.
    statement = statement.on_conflict_do_update(
        # Targeting the columns rather than a constraint name keeps this working regardless of
        # how the index ends up named.
        index_elements=["issued_date", "model_version", "lead_month", "grid_row", "grid_col"],
        set_={
            "probability": statement.excluded.probability,
            "risk_level": statement.excluded.risk_level,
            "pdsi": statement.excluded.pdsi,
            "pdsi_category": statement.excluded.pdsi_category,
            "target_month": statement.excluded.target_month,
            "data_source": statement.excluded.data_source,
        },
    )
    await session.execute(statement)
    await session.flush()

    summary = {
        "issued_date": str(issued),
        "model_version": cube.model_version,
        "data_source": cube.data_source,
        "rows": len(rows),
        "leads": int(cube.probs.shape[0]),
        "cells": grid.rows * grid.cols,
        "pdsi": "included" if observed is not None else "unavailable",
    }
    log.info("risk snapshot written: %s", summary)
    return summary


async def latest_snapshot_date(session: AsyncSession) -> date | None:
    return await session.scalar(
        select(RiskSnapshot.issued_date).order_by(RiskSnapshot.issued_date.desc()).limit(1)
    )
