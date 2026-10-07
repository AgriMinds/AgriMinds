from __future__ import annotations

from agriminds_api.core.exceptions import InvalidLocationError
from agriminds_api.domain.geo import Cell, GridSpec
from agriminds_api.domain.risk import risk_level
from agriminds_api.schemas.drought import CellRiskQuery, CellRiskResponse, DroughtMapResponse, GridCellRisk
from agriminds_api.services.inference import InferenceService, RiskCube


class DroughtService:
    def __init__(self, inference: InferenceService, grid: GridSpec) -> None:
        self._inference = inference
        self._grid = grid

    def resolve_cell(
        self, row: int | None, col: int | None, latitude: float | None, longitude: float | None
    ) -> Cell:
        if row is not None and col is not None:
            cell = Cell(row, col)
            if cell != self._grid.clamp(cell):
                raise InvalidLocationError(
                    f"row/col must be within 0..{self._grid.rows - 1} / 0..{self._grid.cols - 1}"
                )
            return cell
        if latitude is not None and longitude is not None:
            try:
                return self._grid.cell_for(latitude, longitude)
            except ValueError as exc:
                raise InvalidLocationError(str(exc)) from exc
        return self._grid.centre

    def _cell_risk(self, cube: RiskCube, lead_month: int, cell: Cell) -> GridCellRisk:
        p = float(cube.probs[lead_month - 1, cell.row, cell.col])
        lat, lon = self._grid.centroid(cell)
        return GridCellRisk(
            row=cell.row,
            col=cell.col,
            latitude=lat,
            longitude=lon,
            probability=round(p, 3),
            risk_level=risk_level(p),
        )

    def map(self, lead_month: int) -> DroughtMapResponse:
        cube = self._inference.risk_cube()
        grid = cube.probs[lead_month - 1]
        return DroughtMapResponse(
            lead_month=lead_month,
            target_date=cube.target(lead_month).strftime("%B %Y"),
            issued_date=cube.issued.strftime("%B %Y"),
            grid_shape=(self._grid.rows, self._grid.cols),
            bbox=self._grid.bbox,
            mean_probability=round(float(grid.mean()), 3),
            min_probability=round(float(grid.min()), 3),
            max_probability=round(float(grid.max()), 3),
            probabilities=[[round(float(v), 3) for v in row] for row in grid],
            cells=[self._cell_risk(cube, lead_month, c) for c in self._grid.cells()],
            provenance=cube.provenance(),
        )

    def cell(self, query: CellRiskQuery) -> CellRiskResponse:
        cube = self._inference.risk_cube()
        cell = self.resolve_cell(query.row, query.col, query.latitude, query.longitude)
        base = self._cell_risk(cube, query.lead_month, cell)
        return CellRiskResponse(
            **base.model_dump(), lead_month=query.lead_month, provenance=cube.provenance()
        )
