"""Watershed grid geometry: the ONLY place that converts between (row, col) and (lat, lon).

Row 0 is the northern-most row (largest latitude); column 0 is the western-most column.
"""

from __future__ import annotations

from dataclasses import dataclass


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

    @classmethod
    def from_bbox(cls, rows: int, cols: int, bbox: tuple[float, float, float, float]) -> GridSpec:
        lon_min, lat_min, lon_max, lat_max = bbox
        if lon_max <= lon_min or lat_max <= lat_min or rows < 1 or cols < 1:
            raise ValueError("invalid grid specification")
        return cls(rows, cols, lon_min, lat_min, lon_max, lat_max)

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
        return self.lat_min <= latitude <= self.lat_max and self.lon_min <= longitude <= self.lon_max

    def clamp(self, cell: Cell) -> Cell:
        return Cell(min(max(0, cell.row), self.rows - 1), min(max(0, cell.col), self.cols - 1))

    def cell_for(self, latitude: float, longitude: float) -> Cell:
        """Cell containing a coordinate. Raises ValueError when outside the bounding box."""
        if not self.contains(latitude, longitude):
            raise ValueError(f"({latitude}, {longitude}) is outside the watershed bounding box {self.bbox}")
        row = int((self.lat_max - latitude) / self.lat_step)
        col = int((longitude - self.lon_min) / self.lon_step)
        return self.clamp(Cell(row, col))  # clamp handles the lat == lat_min / lon == lon_max edge

    def centroid(self, cell: Cell) -> tuple[float, float]:
        """(latitude, longitude) of a cell centre, rounded to 4 decimals (~11 m)."""
        lat = self.lat_max - (cell.row + 0.5) * self.lat_step
        lon = self.lon_min + (cell.col + 0.5) * self.lon_step
        return round(lat, 4), round(lon, 4)

    def cells(self):
        for r in range(self.rows):
            for c in range(self.cols):
                yield Cell(r, c)
