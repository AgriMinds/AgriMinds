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
