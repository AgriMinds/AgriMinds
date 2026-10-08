"""Watershed grid geometry: the ONLY place that converts between (row, col) and (lat, lon).

Row 0 is the northern-most row (largest latitude); column 0 is the western-most column.

The grid is a rectangle laid over a catchment that is not one. When the surveyed boundary is
loaded, roughly a quarter of the cells fall outside it, and a drought probability for those is a
number about somewhere else. ``in_watershed`` marks them so neither the API nor the map presents
them as part of the basin.
"""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass, field

from ai_drews.geo.watershed import Boundary


@dataclass(frozen=True)
class Cell:
    row: int
    col: int


@dataclass(frozen=True)
class GridSpec:
    rows: int
    cols: int
    lon_min: float
    lat_min: float
    lon_max: float
    lat_max: float
    #: Surveyed catchment outline. Without it the grid falls back to its bounding box, which
    #: accepts points that are near the watershed but not in it.
    boundary: Boundary | None = field(default=None, compare=False)

    @classmethod
    def from_bbox(
        cls,
        rows: int,
        cols: int,
        bbox: tuple[float, float, float, float],
        boundary: Boundary | None = None,
    ) -> GridSpec:
        lon_min, lat_min, lon_max, lat_max = bbox
        if lon_max <= lon_min or lat_max <= lat_min or rows < 1 or cols < 1:
            raise ValueError("invalid grid specification")
        return cls(rows, cols, lon_min, lat_min, lon_max, lat_max, boundary)

    @classmethod
    def from_boundary(cls, rows: int, cols: int, boundary: Boundary) -> GridSpec:
        """Fit the grid to the surveyed extent, so the rectangle follows the catchment."""
        return cls.from_bbox(rows, cols, boundary.bbox, boundary)

    @property
    def has_boundary(self) -> bool:
        return self.boundary is not None

    @property
    def bbox(self) -> tuple[float, float, float, float]:
        return (self.lon_min, self.lat_min, self.lon_max, self.lat_max)

    @property
    def lat_step(self) -> float:
        return (self.lat_max - self.lat_min) / self.rows

    @property
    def lon_step(self) -> float:
        return (self.lon_max - self.lon_min) / self.cols

    @property
    def centre(self) -> Cell:
        return Cell(self.rows // 2, self.cols // 2)

    def contains(self, latitude: float, longitude: float) -> bool:
        """Inside the catchment itself when a boundary is loaded, otherwise inside its box."""
        in_box = self.lat_min <= latitude <= self.lat_max and self.lon_min <= longitude <= self.lon_max
        if not in_box or self.boundary is None:
            return in_box
        return bool(self.boundary.contains(longitude, latitude))

    def in_watershed(self, cell: Cell) -> bool:
        """Whether this cell's centre falls inside the catchment.

        True for every cell when no boundary is loaded: without one there is nothing to exclude,
        and silently marking cells as outside would be worse than saying nothing.
        """
        if self.boundary is None:
            return True
        latitude, longitude = self.centroid(cell)
        return bool(self.boundary.contains(longitude, latitude))

    def cells_in_watershed(self) -> int:
        return sum(1 for c in self.cells() if self.in_watershed(c))

    def clamp(self, cell: Cell) -> Cell:
        return Cell(min(max(0, cell.row), self.rows - 1), min(max(0, cell.col), self.cols - 1))

    def cell_for(self, latitude: float, longitude: float) -> Cell:
        """Cell containing a coordinate. Raises ValueError when outside the bounding box."""
        if not self.contains(latitude, longitude):
            where = "catchment" if self.boundary is not None else f"bounding box {self.bbox}"
            raise ValueError(f"({latitude}, {longitude}) is outside the watershed {where}")
        row = int((self.lat_max - latitude) / self.lat_step)
        col = int((longitude - self.lon_min) / self.lon_step)
        return self.clamp(Cell(row, col))  # clamp handles the lat == lat_min / lon == lon_max edge

    def centroid(self, cell: Cell) -> tuple[float, float]:
        """(latitude, longitude) of a cell centre, rounded to 4 decimals (~11 m)."""
        lat = self.lat_max - (cell.row + 0.5) * self.lat_step
        lon = self.lon_min + (cell.col + 0.5) * self.lon_step
        return round(lat, 4), round(lon, 4)

    def cells(self) -> Iterator[Cell]:
        for r in range(self.rows):
            for c in range(self.cols):
                yield Cell(r, c)
