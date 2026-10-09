"""The watershed boundary: reading it, testing containment, simplifying, masking the grid."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from ai_drews.geo.watershed import (
    Boundary,
    grid_mask,
    load_boundary,
    read_shapefile,
    simplify_ring,
    write_geojson,
)

#: Anchored to the repository root so the tests find the data wherever pytest is launched from.
REPO_ROOT = Path(__file__).resolve().parents[2]
SHAPEFILE = REPO_ROOT / "docs/research/cmw/cmw_max_boundary_wgs.shp"
GEOJSON = REPO_ROOT / "data/geo/choke_watershed.geojson"

#: A unit square with a square hole in the middle, for geometry that is easy to reason about.
SQUARE = [(0.0, 0.0), (10.0, 0.0), (10.0, 10.0), (0.0, 10.0), (0.0, 0.0)]
HOLE = [(4.0, 4.0), (6.0, 4.0), (6.0, 6.0), (4.0, 6.0), (4.0, 4.0)]


@pytest.fixture
def square() -> Boundary:
    return Boundary(name="square", rings=[SQUARE])


@pytest.fixture
def ring_with_hole() -> Boundary:
    return Boundary(name="holed", rings=[SQUARE, HOLE])


class TestContainment:
    @pytest.mark.parametrize("point", [(5.0, 5.0), (0.5, 0.5), (9.5, 9.5), (1.0, 9.0)])
    def test_interior_points_are_inside(self, square, point):
        assert square.contains(*point)

    @pytest.mark.parametrize("point", [(-1.0, 5.0), (11.0, 5.0), (5.0, -1.0), (5.0, 11.0)])
    def test_exterior_points_are_outside(self, square, point):
        assert not square.contains(*point)

    def test_a_hole_is_not_inside(self, ring_with_hole):
        assert ring_with_hole.contains(2.0, 2.0), "still inside the outer ring"
        assert not ring_with_hole.contains(5.0, 5.0), "the hole must be excluded"

    def test_bbox_and_centroid(self, square):
        assert square.bbox == (0.0, 0.0, 10.0, 10.0)
        assert square.centroid == pytest.approx((5.0, 5.0), abs=1.0)


class TestArea:
    def test_a_degree_square_near_the_equator_is_about_12000_km2(self):
        one_degree = Boundary(name="deg", rings=[[(0, 0), (1, 0), (1, 1), (0, 1), (0, 0)]])
        assert one_degree.computed_area_km2() == pytest.approx(12_300, rel=0.05)

    def test_a_hole_is_subtracted(self, square, ring_with_hole):
        assert ring_with_hole.computed_area_km2() < square.computed_area_km2()


class TestSimplify:
    def test_collinear_points_are_dropped(self):
        straight = [(0.0, 0.0), (1.0, 0.0), (2.0, 0.0), (3.0, 0.0), (3.0, 3.0), (0.0, 0.0)]
        assert len(simplify_ring(straight, 0.01)) < len(straight)

    def test_a_simplified_ring_stays_closed(self):
        assert simplify_ring(SQUARE, 0.1)[0] == simplify_ring(SQUARE, 0.1)[-1]

    def test_a_tight_tolerance_keeps_the_shape(self, square):
        assert len(simplify_ring(SQUARE, 1e-9)) == len(SQUARE)

    def test_a_degenerate_ring_is_returned_unchanged(self):
        assert simplify_ring([(0.0, 0.0), (1.0, 1.0)], 0.5) == [(0.0, 0.0), (1.0, 1.0)]


class TestGridMask:
    def test_every_cell_of_a_square_basin_is_inside(self, square):
        mask = grid_mask(square, 4, 4)
        assert mask.cells_inside == 16 and mask.coverage == 1.0

    def test_cells_over_a_hole_are_excluded(self, ring_with_hole):
        mask = grid_mask(ring_with_hole, 10, 10)
        assert 0 < mask.cells_inside < 100
        # Row 0 is the northern-most: the hole sits in the middle rows.
        assert mask.inside[0][0] is True
        assert mask.inside[5][5] is False

    def test_row_zero_is_the_northern_most(self):
        north_half = Boundary(name="n", rings=[[(0, 5), (10, 5), (10, 10), (0, 10), (0, 5)]])
        mask = grid_mask(north_half, 4, 4, bbox=(0, 0, 10, 10))
        assert all(mask.inside[0]), "the top row should fall in the northern polygon"
        assert not any(mask.inside[3]), "the bottom row should not"

    def test_the_mask_serialises_for_a_client(self, square):
        payload = grid_mask(square, 3, 3).to_dict()
        assert payload["rows"] == 3 and payload["cells_inside"] == 9
        assert json.dumps(payload), "must be JSON-serialisable"


@pytest.mark.skipif(not GEOJSON.exists(), reason="the converted boundary is not present")
class TestChokeWatershed:
    """Guards the real survey boundary the platform is configured against."""

    @pytest.fixture
    def choke(self) -> Boundary:
        return load_boundary(GEOJSON)

    def test_it_matches_the_surveyed_extent(self, choke):
        lon_min, lat_min, lon_max, lat_max = choke.bbox
        assert (round(lon_min, 2), round(lat_min, 2)) == (37.01, 9.84)
        assert (round(lon_max, 2), round(lat_max, 2)) == (38.53, 11.26)

    def test_the_computed_area_agrees_with_the_survey(self, choke):
        assert choke.area_km2 == pytest.approx(18_948, abs=1)
        assert choke.computed_area_km2() == pytest.approx(choke.area_km2, rel=0.01), (
            "an independent area calculation should agree with the shapefile's own attribute"
        )

    def test_places_inside_and_outside_the_basin(self, choke):
        assert choke.contains(*choke.centroid)
        assert not choke.contains(38.74, 9.03), "Addis Ababa is far outside"
        assert not choke.contains(39.60, 13.49), "Mekelle is far outside"

    def test_the_old_placeholder_box_was_wrong(self, choke):
        """The placeholder spanned 0.8 deg; the basin spans nearly twice that."""
        lon_min, lat_min, lon_max, lat_max = choke.bbox
        assert lon_max - lon_min > 1.4
        assert lon_min < 37.6, "the placeholder missed the whole western side"

    def test_a_rectangular_grid_overhangs_the_basin(self, choke):
        """A square grid over a non-square catchment always contains cells that are not in it."""
        mask = grid_mask(choke, 8, 8)
        assert mask.cells_inside < 64, "if every cell were inside, the mask would be pointless"
        assert mask.coverage > 0.5, "but most of the grid should still be real"

    def test_display_simplification_is_faithful_but_small(self, choke):
        simplified = simplify_ring(choke.outer, 0.004)
        assert len(simplified) < len(choke.outer) / 10, "a browser should not download 6,700 points"
        reduced = Boundary(name="s", rings=[simplified])
        assert reduced.computed_area_km2() == pytest.approx(choke.computed_area_km2(), rel=0.02)
        assert reduced.contains(*choke.centroid)

    def test_round_trip_through_geojson(self, choke, tmp_path):
        path = write_geojson(choke, tmp_path / "out.geojson")
        again = load_boundary(path)
        assert again.bbox == pytest.approx(choke.bbox)
        assert again.area_km2 == choke.area_km2


@pytest.mark.skipif(not SHAPEFILE.exists(), reason="the source shapefile is not present")
def test_the_shapefile_still_reads_the_same_way():
    """The GeoJSON in the repo must stay faithful to the survey file it came from."""
    from_shape = read_shapefile(SHAPEFILE)
    from_json = load_boundary(GEOJSON)
    assert from_shape.bbox == pytest.approx(from_json.bbox, abs=1e-4)
    assert from_shape.area_km2 == from_json.area_km2


def test_grid_geojson_agrees_with_the_mask():
    """The map and the mask must mark the same cells, or the choropleth shows readings for
    land the basin does not contain."""
    from ai_drews.config import DEFAULT_CONFIG
    from ai_drews.geo.watershed import grid_geojson, grid_mask, load_boundary

    survey = REPO_ROOT / "data" / "geo" / "choke_watershed.geojson"
    if not survey.exists():
        pytest.skip("surveyed outline not present")
    boundary = load_boundary(survey)

    mask = grid_mask(boundary, DEFAULT_CONFIG.rows, DEFAULT_CONFIG.cols, DEFAULT_CONFIG.bbox)
    features = grid_geojson(DEFAULT_CONFIG.rows, DEFAULT_CONFIG.cols, DEFAULT_CONFIG.bbox, boundary)[
        "features"
    ]

    assert len(features) == DEFAULT_CONFIG.rows * DEFAULT_CONFIG.cols
    for feature in features:
        row, col = feature["properties"]["row"], feature["properties"]["col"]
        assert feature["properties"]["in_watershed"] == mask.inside[row][col], (
            f"cell ({row},{col}) disagrees with the grid mask"
        )


def test_grid_cells_tile_the_bounding_box_without_gaps():
    from ai_drews.geo.watershed import grid_geojson

    features = grid_geojson(2, 2, (37.0, 10.0, 38.0, 11.0))["features"]
    rings = [f["geometry"]["coordinates"][0] for f in features]
    assert all(ring[0] == ring[-1] for ring in rings), "every ring must be closed"

    lons = sorted({round(x, 6) for ring in rings for x, _ in ring})
    lats = sorted({round(y, 6) for ring in rings for _, y in ring})
    assert lons == [37.0, 37.5, 38.0]
    assert lats == [10.0, 10.5, 11.0]


def test_row_zero_is_the_northern_most_row():
    """The grid, the mask and every forecast array share this convention."""
    from ai_drews.geo.watershed import cell_id, grid_geojson

    features = {f["properties"]["cell"]: f for f in grid_geojson(2, 2, (37.0, 10.0, 38.0, 11.0))["features"]}
    north = features[cell_id(0, 0)]["geometry"]["coordinates"][0]
    south = features[cell_id(1, 0)]["geometry"]["coordinates"][0]
    assert max(y for _, y in north) > max(y for _, y in south)
