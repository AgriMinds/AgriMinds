"""How the forecast grid is built, in one place.

The API and the `snapshot-risk` command both need it, and they must agree: when the CLI built
its own bounding-box grid, every snapshot row was written as if the catchment contained it, so
the analytics schema reported readings for the 15 cells that lie outside the basin.
"""

from __future__ import annotations

import logging

from agriminds_api.core.config import Settings
from agriminds_api.domain.geo import GridSpec

log = logging.getLogger(__name__)


def build_grid(settings: Settings) -> GridSpec:
    """Fit the grid to the surveyed catchment when its outline is available.

    Without the boundary the grid falls back to a bounding box, which accepts points that are
    near the watershed but not in it. That is a worse answer, so it is logged rather than passed
    over in silence.
    """
    from ai_drews.config import DataPaths
    from ai_drews.geo.watershed import load_boundary

    path = DataPaths.from_env(settings.data_dir).watershed_geojson
    if path.exists():
        try:
            boundary = load_boundary(path)
            grid = GridSpec.from_boundary(settings.grid_rows, settings.grid_cols, boundary)
            log.info(
                "watershed boundary loaded: %s, %s km2, %d of %d grid cells inside",
                boundary.name,
                f"{boundary.area_km2:,.0f}" if boundary.area_km2 else "unknown",
                grid.cells_in_watershed(),
                grid.rows * grid.cols,
            )
            return grid
        except Exception as exc:  # noqa: BLE001 - a bad outline must not stop the API
            log.error(
                "could not read %s (%s); falling back to the bounding box", path, exc.__class__.__name__
            )
    else:
        log.warning("no catchment outline at %s; the grid will accept its whole bounding box", path)
    return GridSpec.from_bbox(settings.grid_rows, settings.grid_cols, settings.bbox)
