from __future__ import annotations

from agriminds_api.core.exceptions import InvalidLocationError
from agriminds_api.domain.geo import Cell, GridSpec
from agriminds_api.domain.risk import (
    CITATION,
    CLASSIFICATION_VERSION,
    pdsi_category,
    pdsi_is_drought,
    risk_level,
)
from agriminds_api.schemas.drought import (
    CellRiskQuery,
    CellRiskResponse,
    DroughtMapResponse,
    GridCellRisk,
    ObservedConditions,
    WatershedBoundary,
    WatershedGrid,
)
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

    def _cell_risk(self, cube: RiskCube, lead_month: int, cell: Cell, pdsi=None) -> GridCellRisk:
        p = float(cube.probs[lead_month - 1, cell.row, cell.col])
        lat, lon = self._grid.centroid(cell)
        observed = None if pdsi is None else round(float(pdsi[cell.row, cell.col]), 2)
        return GridCellRisk(
            row=cell.row,
            col=cell.col,
            latitude=lat,
            longitude=lon,
            probability=round(p, 3),
            risk_level=risk_level(p),
            pdsi=observed,
            pdsi_category=None if observed is None else pdsi_category(observed),
            in_watershed=self._grid.in_watershed(cell),
        )

    def _conditions(self, cube: RiskCube, pdsi) -> ObservedConditions | None:
        """Summarise how dry the ground already is, independently of the forecast."""
        if pdsi is None:
            return None
        values = [float(v) for v in pdsi.ravel()]
        mean = sum(values) / len(values)
        driest = min(values)
        return ObservedConditions(
            as_of=cube.issued.strftime("%B %Y"),
            mean=round(mean, 2),
            category=pdsi_category(mean),
            driest_category=pdsi_category(driest),
            cells_in_drought=sum(1 for v in values if pdsi_is_drought(v)),
            classification_version=CLASSIFICATION_VERSION,
            citation=CITATION,
            method_note=(
                "Self-calibrated Palmer index. Calibration pins the 2nd and 98th percentiles of "
                "the training period to -4 and +4; it is not the NCAR scPDSI implementation."
            ),
        )

    def map(self, lead_month: int) -> DroughtMapResponse:
        cube = self._inference.risk_cube()
        pdsi = self._inference.observed_pdsi()
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
            cells=[self._cell_risk(cube, lead_month, c, pdsi) for c in self._grid.cells()],
            conditions=self._conditions(cube, pdsi),
            provenance=cube.provenance(),
        )

    def boundary(self, simplify_tolerance: float = 0.004) -> WatershedBoundary | None:
        """The surveyed outline plus the grid mask, or None when no boundary is configured."""
        outline = self._grid.boundary
        if outline is None:
            return None
        feature = outline.to_geojson(simplify_tolerance)
        return WatershedBoundary(
            name=outline.name,
            source=outline.source,
            area_km2=outline.area_km2,
            bbox=self._grid.bbox,
            geometry=feature["geometry"],
            grid=WatershedGrid(
                rows=self._grid.rows,
                cols=self._grid.cols,
                cells_inside=self._grid.cells_in_watershed(),
                inside=[
                    [self._grid.in_watershed(Cell(r, c)) for c in range(self._grid.cols)]
                    for r in range(self._grid.rows)
                ],
            ),
        )

    def cell(self, query: CellRiskQuery) -> CellRiskResponse:
        cube = self._inference.risk_cube()
        cell = self.resolve_cell(query.row, query.col, query.latitude, query.longitude)
        base = self._cell_risk(cube, query.lead_month, cell, self._inference.observed_pdsi())
        return CellRiskResponse(
            **base.model_dump(), lead_month=query.lead_month, provenance=cube.provenance()
        )
