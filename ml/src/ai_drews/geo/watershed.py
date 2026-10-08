"""The Choke Mountain Watershed boundary.

The platform shipped with a placeholder bounding box while no survey boundary was available.
This module reads the real one (an ESRI shapefile in WGS84, ``cmw_max_boundary_wgs``) and turns
it into two plain-JSON artifacts the rest of the system can use without any geospatial library:

* ``data/geo/choke_watershed.geojson`` -- the polygon, for masking and for drawing the real shape
  instead of a bare rectangle.
* a grid mask -- which cells of the forecast grid actually fall inside the basin. A rectangular
  grid over a non-rectangular catchment always contains cells that are not in it; reporting a
  drought probability for those is reporting a number about somewhere else.

Reading the shapefile needs ``pyshp`` and is a one-off conversion step. Everything downstream
reads the GeoJSON.
"""

from __future__ import annotations

import json
import logging
import math
from dataclasses import dataclass, field
from pathlib import Path

log = logging.getLogger(__name__)

Ring = list[tuple[float, float]]

#: Mean Earth radius used for the spherical area calculation, in kilometres.
_EARTH_RADIUS_KM = 6371.0088


@dataclass(frozen=True)
class Boundary:
    """A watershed outline in WGS84 degrees."""

    name: str
    rings: list[Ring]  # first ring is the outer boundary; any others are holes
    source: str = ""
    area_km2: float | None = None

    @property
    def outer(self) -> Ring:
        return self.rings[0]

    @property
    def bbox(self) -> tuple[float, float, float, float]:
        """(lon_min, lat_min, lon_max, lat_max)."""
        lons = [p[0] for p in self.outer]
        lats = [p[1] for p in self.outer]
        return (min(lons), min(lats), max(lons), max(lats))

    @property
    def centroid(self) -> tuple[float, float]:
        lons = [p[0] for p in self.outer]
        lats = [p[1] for p in self.outer]
        return (sum(lons) / len(lons), sum(lats) / len(lats))

    def contains(self, longitude: float, latitude: float) -> bool:
        """Ray casting: is the point inside the outer ring and outside every hole?"""
        if not _ring_contains(self.outer, longitude, latitude):
            return False
        return not any(_ring_contains(hole, longitude, latitude) for hole in self.rings[1:])

    def computed_area_km2(self) -> float:
        """Spherical polygon area, so it can be checked against the surveyed figure."""
        return _spherical_area_km2(self.outer) - sum(_spherical_area_km2(h) for h in self.rings[1:])

    def to_geojson(self, simplify_tolerance: float | None = None) -> dict:
        rings = self.rings
        if simplify_tolerance:
            rings = [simplify_ring(r, simplify_tolerance) for r in rings]
        return {
            "type": "Feature",
            "properties": {
                "name": self.name,
                "source": self.source,
                "area_km2": self.area_km2,
                "points": sum(len(r) for r in rings),
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[round(x, 5), round(y, 5)] for x, y in r] for r in rings],
            },
        }


def _ring_contains(ring: Ring, x: float, y: float) -> bool:
    """Standard crossing-number test. Points exactly on an edge may fall either way."""
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def _spherical_area_km2(ring: Ring) -> float:
    """Area of a lon/lat ring on a sphere, by the standard spherical-excess formula."""
    if len(ring) < 4:
        return 0.0
    total = 0.0
    for i in range(len(ring) - 1):
        lon1, lat1 = math.radians(ring[i][0]), math.radians(ring[i][1])
        lon2, lat2 = math.radians(ring[i + 1][0]), math.radians(ring[i + 1][1])
        total += (lon2 - lon1) * (2 + math.sin(lat1) + math.sin(lat2))
    return abs(total * _EARTH_RADIUS_KM**2 / 2.0)


def simplify_ring(ring: Ring, tolerance_deg: float) -> Ring:
    """Ramer-Douglas-Peucker. A 6,700-point outline is wasted bandwidth in a browser."""
    if len(ring) < 3:
        return list(ring)
    closed = ring[0] == ring[-1]
    points = ring[:-1] if closed else list(ring)
    kept = _rdp(points, tolerance_deg)
    if closed and kept[0] != kept[-1]:
        kept.append(kept[0])
    return kept


def _rdp(points: Ring, tolerance: float) -> Ring:
    if len(points) < 3:
        return list(points)
    start, end = points[0], points[-1]
    index, worst = 0, 0.0
    for i in range(1, len(points) - 1):
        d = _perpendicular_distance(points[i], start, end)
        if d > worst:
            index, worst = i, d
    if worst <= tolerance:
        return [start, end]
    left = _rdp(points[: index + 1], tolerance)
    right = _rdp(points[index:], tolerance)
    return left[:-1] + right


def _perpendicular_distance(point, start, end) -> float:
    (x, y), (x1, y1), (x2, y2) = point, start, end
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return math.hypot(x - x1, y - y1)
    return abs(dy * x - dx * y + x2 * y1 - y2 * x1) / math.hypot(dx, dy)


@dataclass(frozen=True)
class GridMask:
    """Which cells of a rows x cols grid lie inside the basin."""

    rows: int
    cols: int
    bbox: tuple[float, float, float, float]
    inside: list[list[bool]] = field(default_factory=list)

    @property
    def cells_inside(self) -> int:
        return sum(sum(1 for v in row if v) for row in self.inside)

    @property
    def coverage(self) -> float:
        return self.cells_inside / (self.rows * self.cols)

    def to_dict(self) -> dict:
        return {
            "rows": self.rows,
            "cols": self.cols,
            "bbox": list(self.bbox),
            "inside": self.inside,
            "cells_inside": self.cells_inside,
        }


def grid_mask(
    boundary: Boundary, rows: int, cols: int, bbox: tuple[float, float, float, float] | None = None
) -> GridMask:
    """Mark each cell whose centre falls inside the watershed.

    Row 0 is the northern-most, matching the forecast grid's own ordering.
    """
    lon_min, lat_min, lon_max, lat_max = bbox or boundary.bbox
    lat_step = (lat_max - lat_min) / rows
    lon_step = (lon_max - lon_min) / cols
    inside = [
        [
            boundary.contains(
                lon_min + (c + 0.5) * lon_step,
                lat_max - (r + 0.5) * lat_step,
            )
            for c in range(cols)
        ]
        for r in range(rows)
    ]
    return GridMask(rows=rows, cols=cols, bbox=(lon_min, lat_min, lon_max, lat_max), inside=inside)


# ------------------------------------------------------------------ I/O
def read_shapefile(path: str | Path, name: str = "Choke Mountain Watershed") -> Boundary:
    """Read an ESRI polygon shapefile. Requires the optional `geo` extra (pyshp)."""
    try:
        import shapefile
    except ModuleNotFoundError as exc:  # pragma: no cover - depends on the install
        raise ModuleNotFoundError(
            "Reading a shapefile needs the optional extra: pip install -e 'ml[geo]'"
        ) from exc

    reader = shapefile.Reader(str(path))
    if not len(reader):
        raise ValueError(f"{path} contains no features")
    shape = reader.shape(0)
    record = reader.record(0).as_dict() if reader.fields[1:] else {}

    # A shapefile polygon stores every ring end-to-end; `parts` gives the split points.
    starts = list(shape.parts) + [len(shape.points)]
    rings = [
        [(float(x), float(y)) for x, y in shape.points[starts[i] : starts[i + 1]]]
        for i in range(len(starts) - 1)
    ]
    rings = [r if r[0] == r[-1] else [*r, r[0]] for r in rings if len(r) >= 3]
    area = record.get("area_km2")
    return Boundary(
        name=name,
        rings=rings,
        source=Path(path).name,
        area_km2=float(area) if area is not None else None,
    )


def load_boundary(path: str | Path) -> Boundary:
    """Read a boundary back from the GeoJSON this module writes. No geospatial library needed."""
    payload = json.loads(Path(path).read_text())
    feature = payload["features"][0] if payload.get("type") == "FeatureCollection" else payload
    props = feature.get("properties", {})
    rings = [[(float(x), float(y)) for x, y in ring] for ring in feature["geometry"]["coordinates"]]
    return Boundary(
        name=props.get("name", "watershed"),
        rings=rings,
        source=props.get("source", ""),
        area_km2=props.get("area_km2"),
    )


def write_geojson(boundary: Boundary, path: str | Path, simplify_tolerance: float | None = None) -> Path:
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(boundary.to_geojson(simplify_tolerance), separators=(",", ":")))
    return out
