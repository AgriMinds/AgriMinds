import pytest

from agriminds_api.domain.geo import Cell, GridSpec

GRID = GridSpec.from_bbox(8, 8, (37.6, 10.4, 38.4, 11.2))


def test_corners_map_to_corner_cells():
    assert GRID.cell_for(11.2, 37.6) == Cell(0, 0)  # north-west
    assert GRID.cell_for(10.4, 38.4) == Cell(7, 7)  # south-east (edge clamped)
    assert GRID.cell_for(11.2, 38.4) == Cell(0, 7)


def test_centroid_roundtrip():
    for cell in GRID.cells():
        lat, lon = GRID.centroid(cell)
        assert GRID.cell_for(lat, lon) == cell


def test_outside_bbox_rejected():
    with pytest.raises(ValueError):
        GRID.cell_for(9.0, 38.0)  # Addis Ababa latitude, outside Choke


def test_clamp_and_centre():
    assert GRID.clamp(Cell(-3, 99)) == Cell(0, 7)
    assert GRID.centre == Cell(4, 4)


def test_invalid_spec():
    with pytest.raises(ValueError):
        GridSpec.from_bbox(8, 8, (38.4, 10.4, 37.6, 11.2))


class TestSurveyedBoundary:
    """With the real catchment loaded, the grid stops treating its bounding box as the basin."""

    @pytest.fixture
    def boundary(self):
        from pathlib import Path

        from ai_drews.geo.watershed import load_boundary

        path = Path(__file__).resolve().parents[3] / "data/geo/choke_watershed.geojson"
        if not path.exists():
            pytest.skip("the converted catchment outline is not present")
        return load_boundary(path)

    @pytest.fixture
    def fitted(self, boundary):
        return GridSpec.from_boundary(8, 8, boundary)

    def test_the_grid_fits_the_surveyed_extent(self, fitted, boundary):
        assert fitted.bbox == boundary.bbox
        assert fitted.has_boundary

    def test_part_of_the_rectangle_is_not_in_the_catchment(self, fitted):
        inside = fitted.cells_in_watershed()
        assert 0 < inside < fitted.rows * fitted.cols, (
            "a rectangle over a non-rectangular catchment must have cells outside it"
        )

    def test_a_point_inside_the_box_but_outside_the_catchment_is_refused(self, fitted):
        """This is the case a bounding box alone gets wrong."""
        outside = next(c for c in fitted.cells() if not fitted.in_watershed(c))
        latitude, longitude = fitted.centroid(outside)
        assert fitted.lat_min <= latitude <= fitted.lat_max
        assert fitted.lon_min <= longitude <= fitted.lon_max
        assert not fitted.contains(latitude, longitude), "inside the box is not inside the basin"
        with pytest.raises(ValueError, match="catchment"):
            fitted.cell_for(latitude, longitude)

    def test_a_point_in_the_catchment_is_accepted_and_located(self, fitted):
        inside = next(c for c in fitted.cells() if fitted.in_watershed(c))
        latitude, longitude = fitted.centroid(inside)
        assert fitted.contains(latitude, longitude)
        assert fitted.cell_for(latitude, longitude) == inside

    def test_without_a_boundary_every_cell_counts_as_inside(self):
        """Marking cells as outside with nothing to go on would be worse than saying nothing."""
        plain = GridSpec.from_bbox(8, 8, (37.0, 9.8, 38.5, 11.3))
        assert not plain.has_boundary
        assert plain.cells_in_watershed() == 64
        assert all(plain.in_watershed(c) for c in plain.cells())
