"""Map geometry, served unauthenticated so a BI tool can fetch it.

A choropleth needs the polygons as a file the mapping tool downloads for itself, and Metabase
fetches a custom GeoJSON without sending any credential. That is acceptable here because these
files are pure geometry: the catchment outline and the forecast grid. They carry no reading, no
account and no plot — nothing that is not already on the public watershed map.

Anything with a number in it stays behind the authenticated endpoints.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Request, Response

from agriminds_api.api.deps import SettingsDep
from agriminds_api.core.exceptions import AppError
from agriminds_api.schemas.common import ErrorResponse

router = APIRouter(prefix="/geo", tags=["Geography"])

#: Only these names resolve, so the route cannot be walked into the rest of the data directory.
_FILES = {
    "watershed": ("choke_watershed.geojson", "The surveyed catchment outline."),
    "grid": ("choke_grid.geojson", "The forecast grid, one polygon per cell, for choropleths."),
}


class GeometryMissingError(AppError):
    status_code = 404
    code = "geometry_not_found"


@router.get(
    "/{name}.geojson",
    summary="Map geometry (public)",
    description=(
        "`watershed` is the surveyed catchment outline; `grid` is one polygon per forecast cell, "
        "keyed by `cell` (r{row}c{col}) so a BI tool can join it to a forecast. Geometry only: "
        "these carry no readings. Generate the grid with `ai-drews grid-geojson`."
    ),
    response_class=Response,
    responses={
        200: {"content": {"application/geo+json": {}}, "description": "A GeoJSON document"},
        404: {"model": ErrorResponse, "description": "Unknown or ungenerated geometry"},
    },
)
@router.head(
    "/{name}.geojson",
    include_in_schema=False,
)
def geometry(name: str, settings: SettingsDep, request: Request) -> Response:
    entry = _FILES.get(name)
    if entry is None:
        raise GeometryMissingError(f"no geometry called {name!r}; try: {', '.join(sorted(_FILES))}")
    path = Path(settings.data_dir) / "geo" / entry[0]
    if not path.is_file():
        raise GeometryMissingError(
            f"{entry[0]} has not been generated on this deployment (run `ai-drews grid-geojson` for the grid)"
        )
    content = b"" if request.method == "HEAD" else path.read_bytes()
    return Response(
        content=content,
        media_type="application/geo+json",
        # Geometry changes only when the grid or the survey does, which is a deployment event.
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Cache-Control": "public, max-age=3600",
            "Content-Disposition": f'inline; filename="{entry[0]}"',
        },
    )
