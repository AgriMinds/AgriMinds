"""Record whether the catchment actually contains each forecast cell.

The forecast grid is a rectangle over a basin that is not one: 15 of its 64 cells fall outside
the surveyed catchment. The API has always marked them, but ``risk_snapshots`` did not, so any
BI tool reading the analytics schema would shade those cells as if they were readings for land
the basin does not contain.

Existing rows are backfilled from the catchment outline where it is available. When it is not,
they are left ``true`` and a warning is printed rather than guessing: marking a real cell as
outside would hide a genuine warning.

Revision ID: 0003_in_watershed
Revises: 0002_analytics
Create Date: 2026-10-09
"""

from __future__ import annotations

import logging
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_in_watershed"
down_revision: str | None = "0002_analytics"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

log = logging.getLogger("alembic.runtime.migration")

#: `in_watershed` is appended rather than slotted in beside the other geometry columns:
#: PostgreSQL's CREATE OR REPLACE VIEW may only add columns at the end, and dropping the view
#: would revoke the grants and break anything holding a reference to it.
_FACT_RISK = """
SELECT s.id                        AS risk_key,
       s.issued_date,
       s.target_month,
       s.lead_month,
       s.grid_row,
       s.grid_col,
       s.latitude,
       s.longitude,
       s.probability,
       s.risk_level::text          AS risk_level,
       s.pdsi,
       s.pdsi_category::text       AS pdsi_category,
       s.model_version,
       s.data_source,
       s.in_watershed
FROM risk_snapshots s
"""

_FACT_RISK_WITHOUT = """
SELECT s.id                        AS risk_key,
       s.issued_date,
       s.target_month,
       s.lead_month,
       s.grid_row,
       s.grid_col,
       s.latitude,
       s.longitude,
       s.probability,
       s.risk_level::text          AS risk_level,
       s.pdsi,
       s.pdsi_category::text       AS pdsi_category,
       s.model_version,
       s.data_source
FROM risk_snapshots s
"""


def _mask() -> list[list[bool]] | None:
    """The catchment mask, if this deployment carries the surveyed outline."""
    try:
        from ai_drews.config import DEFAULT_CONFIG, DataPaths
        from ai_drews.geo.watershed import grid_mask, load_boundary

        paths = DataPaths.from_env()
        if not paths.watershed_geojson.exists():
            return None
        boundary = load_boundary(paths.watershed_geojson)
        return grid_mask(boundary, DEFAULT_CONFIG.rows, DEFAULT_CONFIG.cols, DEFAULT_CONFIG.bbox).inside
    except Exception as exc:  # noqa: BLE001 - a backfill must never block the schema change
        log.warning("could not load the catchment outline to backfill in_watershed: %s", exc)
        return None


def upgrade() -> None:
    op.add_column(
        "risk_snapshots",
        sa.Column("in_watershed", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.create_index("ix_risk_snapshots_in_watershed", "risk_snapshots", ["in_watershed"])

    inside = _mask()
    if inside is None:
        log.warning(
            "no catchment outline available: existing risk rows keep in_watershed = true. "
            "Re-run `make snapshot` once the outline is present to correct them."
        )
    else:
        outside = [(r, c) for r, row in enumerate(inside) for c, ok in enumerate(row) if not ok]
        if outside:
            op.execute(
                sa.text(
                    "UPDATE risk_snapshots SET in_watershed = false WHERE (grid_row, grid_col) IN :cells"
                ).bindparams(sa.bindparam("cells", value=outside, expanding=True))
            )
            log.info("marked %d of %d cells as outside the catchment", len(outside), sum(map(len, inside)))

    op.execute(f"CREATE OR REPLACE VIEW analytics.fact_risk AS {_FACT_RISK}")
    op.execute("GRANT SELECT ON analytics.fact_risk TO agriminds_bi")


def downgrade() -> None:
    # Dropping a column from a view needs a full replace, not CREATE OR REPLACE.
    op.execute("DROP VIEW IF EXISTS analytics.fact_risk")
    op.execute(f"CREATE VIEW analytics.fact_risk AS {_FACT_RISK_WITHOUT}")
    op.execute("GRANT SELECT ON analytics.fact_risk TO agriminds_bi")
    op.drop_index("ix_risk_snapshots_in_watershed", table_name="risk_snapshots")
    op.drop_column("risk_snapshots", "in_watershed")
