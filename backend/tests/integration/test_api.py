import numpy as np
import pytest
from tests.conftest import TEST_CFG


def test_health_healthy(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "healthy"
    assert body["model"]["loaded"] is True
    assert body["model"]["source"] == "model"
    assert body["model"]["data_source"] == "synthetic"
    assert body["cache"]["backend"] == "memory"
    assert body["database"] == {"configured": True, "reachable": True}
    assert "X-Request-ID" in r.headers


def test_drought_map(client):
    r = client.get("/api/v1/drought/map", params={"lead_month": 2})
    assert r.status_code == 200
    body = r.json()
    assert body["lead_month"] == 2
    assert body["grid_shape"] == [8, 8]
    probs = np.array(body["probabilities"])
    assert probs.shape == (8, 8)
    assert ((probs >= 0) & (probs <= 1)).all()
    assert len(body["cells"]) == 64
    assert body["provenance"]["source"] == "model"
    assert body["provenance"]["model_version"].startswith("superhybrid-")


def test_map_is_cached_and_stable(client):
    a = client.get("/api/v1/drought/map").json()["probabilities"]
    b = client.get("/api/v1/drought/map").json()["probabilities"]
    assert a == b


def test_cell_by_rowcol_and_by_gps_agree(client):
    by_rc = client.get("/api/v1/drought/cell", params={"row": 3, "col": 4}).json()
    by_gps = client.get(
        "/api/v1/drought/cell", params={"latitude": by_rc["latitude"], "longitude": by_rc["longitude"]}
    ).json()
    assert by_gps["row"] == 3 and by_gps["col"] == 4
    assert by_gps["probability"] == by_rc["probability"]


def test_cell_post_and_validation(client):
    assert client.post("/api/v1/drought/cell", json={"lead_month": 2, "row": 2, "col": 5}).status_code == 200
    assert client.post("/api/v1/drought/cell", json={"row": 2}).status_code == 422  # col missing
    r = client.get("/api/v1/drought/cell", params={"row": 9, "col": 0})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "invalid_location"
    r = client.get("/api/v1/drought/cell", params={"latitude": 9.0, "longitude": 38.0})
    assert r.status_code == 422


def test_advisory_for_each_crop(client):
    for crop in ("tef", "wheat", "maize"):
        r = client.post(
            "/api/v1/advisories/evaluate",
            json={"crop": crop, "lead_month": 1, "row": 4, "col": 4, "iek_agrees": True},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["crop"] == crop
        assert body["risk_level"] in {"Low", "Moderate", "High", "Severe"}
        assert body["confidence_level"].startswith("HIGH")
        assert body["rules_version"]
        assert body["provenance"]["data_source"] == "synthetic"


def test_advisory_defaults_to_centre_cell(client):
    body = client.post("/api/v1/advisories/evaluate", json={"crop": "tef"}).json()
    assert (body["row"], body["col"]) == (4, 4)


def test_enso_outlook(client):
    body = client.get("/api/v1/enso/outlook").json()
    assert body["current_state"] in {"El Niño", "La Niña", "Neutral"}
    assert len(body["historical_series"]) == 36
    # The ENSO horizon is configuration, not a constant: pinning it is what broke when the
    # forecast was extended from three months to a full year.
    assert len(body["forecast_series"]) == TEST_CFG.enso_leads
    assert all(p["is_forecast"] for p in body["forecast_series"])


def test_openapi_served(client):
    assert client.get("/api/v1/openapi.json").status_code == 200


def test_api_key_required_when_configured(auth_client):
    assert auth_client.get("/api/v1/health").status_code == 200  # health is public
    r = auth_client.get("/api/v1/drought/map")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "unauthorized"
    assert auth_client.get("/api/v1/drought/map", headers={"X-API-Key": "wrong"}).status_code == 401
    assert auth_client.get("/api/v1/drought/map", headers={"X-API-Key": "secret-key"}).status_code == 200


def test_degraded_when_no_artifacts(empty_client):
    """The database is up but the model is missing: degraded, and readiness fails."""
    health = empty_client.get("/api/v1/health")
    assert health.status_code == 200 and health.json()["status"] == "degraded"
    assert health.json()["model"]["source"] == "unavailable"
    assert empty_client.get("/api/v1/health/ready").status_code == 503
    r = empty_client.get("/api/v1/drought/map")
    assert r.status_code == 503
    assert r.json()["error"]["code"] == "model_unavailable"


def test_degraded_with_precomputed_raster(precomputed_client):
    health = precomputed_client.get("/api/v1/health").json()
    assert health["status"] == "degraded"
    assert health["model"]["source"] == "precomputed"
    body = precomputed_client.get("/api/v1/drought/map").json()
    assert body["provenance"]["source"] == "precomputed"
    enso = precomputed_client.get("/api/v1/enso/outlook").json()
    assert enso["forecast_series"] == []


class TestTable2Classification:
    """Table 2 of the study, surfaced through the API (Megbar & Tadesse 2016; Menberu & Addisu 2018)."""

    def test_enso_outlook_carries_the_five_way_band(self, client):
        body = client.get("/api/v1/enso/outlook").json()
        assert body["current_category"] in {
            "High El Niño",
            "Moderate El Niño",
            "Neutral",
            "Moderate La Niña",
            "High La Niña",
        }
        assert isinstance(body["is_extreme"], bool)
        assert body["classification_version"]
        assert "Megbar" in body["citation"] and "Menberu" in body["citation"]

    def test_the_fine_band_never_contradicts_the_coarse_phase(self, client):
        body = client.get("/api/v1/enso/outlook").json()
        coarse = {
            "High El Niño": "El Niño",
            "Moderate El Niño": "El Niño",
            "Neutral": "Neutral",
            "Moderate La Niña": "La Niña",
            "High La Niña": "La Niña",
        }
        assert coarse[body["current_category"]] == body["current_state"]

    def test_every_series_point_is_classified(self, client):
        body = client.get("/api/v1/enso/outlook").json()
        points = body["historical_series"] + body["forecast_series"]
        assert points, "the outlook should carry a series"
        assert all(p["category"] for p in points)

    def test_only_the_high_bands_are_flagged_extreme(self, client):
        body = client.get("/api/v1/enso/outlook").json()
        assert body["is_extreme"] == body["current_category"].startswith("High")

    def test_drought_map_reports_observed_soil_dryness(self, client):
        body = client.get("/api/v1/drought/map").json()
        conditions = body["conditions"]
        assert conditions is not None, "the test artifacts include mean temperature, so Sc-PDSI applies"
        assert conditions["index"] == "scpdsi"
        assert conditions["category"] in {
            "Extremely wet",
            "Very wet",
            "Moderately wet",
            "Normal",
            "Moderately dry",
            "Very dry",
            "Extremely dry",
        }
        assert 0 <= conditions["cells_in_drought"] <= len(body["cells"])
        assert "not the NCAR scPDSI" in conditions["method_note"]

    def test_every_cell_carries_its_own_index_and_band(self, client):
        cells = client.get("/api/v1/drought/map").json()["cells"]
        assert all(c["pdsi"] is not None and c["pdsi_category"] for c in cells)
        # The forecast probability and the observed index are different quantities and must not
        # be conflated: one is a likelihood for next season, the other today's soil state.
        assert any(c["pdsi"] != c["probability"] for c in cells)

    def test_single_cell_query_matches_the_map(self, client):
        cell = next(c for c in client.get("/api/v1/drought/map").json()["cells"] if c["row"] == 3)
        one = client.get("/api/v1/drought/cell", params={"row": cell["row"], "col": cell["col"]}).json()
        assert one["pdsi"] == cell["pdsi"]
        assert one["pdsi_category"] == cell["pdsi_category"]

    def test_advisory_reports_the_band_not_just_the_phase(self, client):
        body = client.post("/api/v1/advisories/evaluate", json={"crop": "tef", "lead_month": 1}).json()
        assert body["enso_category"] in {
            "High El Niño",
            "Moderate El Niño",
            "Neutral",
            "Moderate La Niña",
            "High La Niña",
        }

    def test_without_the_model_there_are_no_observed_conditions(self, precomputed_client):
        """A precomputed raster carries no climate record, so dryness must be reported as absent."""
        body = precomputed_client.get("/api/v1/drought/map").json()
        assert body["conditions"] is None
        assert all(c["pdsi"] is None and c["pdsi_category"] is None for c in body["cells"])


class TestCatchmentBoundary:
    """The surveyed outline, so a map can draw the catchment instead of a rectangle."""

    def test_the_outline_is_served_with_its_grid_mask(self, client):
        r = client.get("/api/v1/drought/watershed")
        if r.status_code == 404:
            pytest.skip("no catchment outline configured in this test deployment")
        assert r.status_code == 200
        body = r.json()
        assert body["geometry"]["type"] == "Polygon"
        assert body["area_km2"] == pytest.approx(18_948, abs=1)
        assert len(body["bbox"]) == 4
        grid = body["grid"]
        assert len(grid["inside"]) == grid["rows"]
        assert all(len(row) == grid["cols"] for row in grid["inside"])
        assert 0 < grid["cells_inside"] < grid["rows"] * grid["cols"]

    def test_the_outline_is_small_enough_for_a_browser(self, client):
        r = client.get("/api/v1/drought/watershed")
        if r.status_code == 404:
            pytest.skip("no catchment outline configured in this test deployment")
        points = len(r.json()["geometry"]["coordinates"][0])
        assert points < 1000, f"{points} points is too many to send to a phone"
        assert points > 20, "simplified past the point of being the right shape"

    def test_map_cells_say_whether_they_are_in_the_catchment(self, client):
        cells = client.get("/api/v1/drought/map").json()["cells"]
        assert all("in_watershed" in c for c in cells)
        watershed = client.get("/api/v1/drought/watershed")
        if watershed.status_code == 200:
            grid = watershed.json()["grid"]
            assert sum(1 for c in cells if c["in_watershed"]) == grid["cells_inside"], (
                "the map and the mask must agree on which cells are in the basin"
            )


class TestDataSourceInventory:
    """What the forecast is built from, reported from disk rather than from a fixed list."""

    def test_it_reports_the_study_s_five_inputs(self, client, minister_headers):
        body = client.get("/api/v1/system/data-sources", headers=minister_headers).json()
        keys = [s["key"] for s in body["sources"]]
        assert keys == ["nino34", "era5", "chirps_emi", "csa_crops", "scpdsi"]
        assert body["total"] == 5
        assert body["connected"] == sum(1 for s in body["sources"] if s["status"] == "connected")

    def test_synthetic_training_data_is_declared_not_hidden(self, client, minister_headers):
        body = client.get("/api/v1/system/data-sources", headers=minister_headers).json()
        assert body["data_source"] == "synthetic"
        assert body["caveat"] and "not a statement about real drought risk" in body["caveat"]
        for key in ("nino34", "era5"):
            entry = next(s for s in body["sources"] if s["key"] == key)
            assert entry["status"] == "synthetic", f"{key} must not claim to be observed data"

    def test_unwired_sources_say_so_rather_than_implying_coverage(self, client, minister_headers):
        body = client.get("/api/v1/system/data-sources", headers=minister_headers).json()
        for key in ("chirps_emi", "csa_crops"):
            entry = next(s for s in body["sources"] if s["key"] == key)
            assert entry["status"] == "not_connected"
            assert entry["detail"]

    def test_scpdsi_is_connected_because_mean_temperature_is_present(self, client, minister_headers):
        entry = next(
            s
            for s in client.get("/api/v1/system/data-sources", headers=minister_headers).json()["sources"]
            if s["key"] == "scpdsi"
        )
        assert entry["status"] == "connected"
        # The study lists the water-balance terms; the detail should name them.
        for term in ("evapotranspiration", "recharge", "runoff", "loss"):
            assert term in entry["detail"]

    def test_a_farmer_cannot_read_the_inventory(self, client, farmer_headers):
        assert client.get("/api/v1/system/data-sources", headers=farmer_headers).status_code == 403


class TestIngestedSourcesAreReported:
    """Once a connector has run, its manifest — not the file's presence — makes it connected."""

    @pytest.fixture
    def ingested(self, artifacts_dir):
        """Write manifests as the connectors would, then remove them again."""
        from ai_drews.ingest.base import Manifest, manifests_dir, write_manifest

        written = {
            "nino34": Manifest.now(
                key="nino34",
                provider="NOAA Physical Sciences Laboratory",
                source_url="https://psl.noaa.gov/data/correlation/nina34.anom.data",
                citation="NOAA PSL climate indices",
                records=945,
                coverage=("1948-01-01", "2026-09-01"),
                variables=("nino34", "nino12", "nino4", "soi"),
            ),
            "era5": Manifest.now(
                key="era5",
                provider="ERA5 reanalysis (ECMWF), served by the Open-Meteo archive",
                source_url="https://archive-api.open-meteo.com/v1/archive",
                citation="Hersbach et al. (2020)",
                records=20224,
                coverage=("2000-01-01", "2026-05-01"),
                variables=("rain", "tmax", "tmean", "soilm", "pet_fao"),
            ),
            "validation": Manifest.now(
                key="validation",
                provider="CHIRPS v2.0 and the Ethiopian Meteorological Institute",
                source_url="https://climateserv.servirglobal.net/",
                citation="Funk et al. (2015)",
                records=317,
                coverage=("2000-01-01", "2026-05-01"),
                variables=("correlation", "bias_mm", "mae_mm"),
                notes="Over 317 months ERA5 tracks CHIRPS at r=0.91, running 8.0 mm/month wetter.",
            ),
            "crops": Manifest.now(
                key="crops",
                provider="FAOSTAT, compiling Ethiopia's official agricultural statistics",
                source_url="https://bulks-faostat.fao.org/production/",
                citation="FAO (2026), FAOSTAT Crops and livestock products",
                records=96,
                coverage=("1993", "2024"),
                variables=("area_ha", "yield_kg_ha", "production_t"),
                notes="Area, yield and production for maize, tef, wheat.",
            ),
        }
        for manifest in written.values():
            write_manifest(artifacts_dir, manifest)
        yield written
        for path in manifests_dir(artifacts_dir).glob("*.json"):
            path.unlink()

    def test_every_downloaded_source_is_reported_connected(self, client, minister_headers, ingested):
        body = client.get("/api/v1/system/data-sources", headers=minister_headers).json()
        statuses = {s["key"]: s["status"] for s in body["sources"]}
        assert statuses == {
            "nino34": "connected",
            "era5": "connected",
            "chirps_emi": "connected",
            "csa_crops": "connected",
            "scpdsi": "connected",
        }
        assert body["connected"] == 5

    def test_coverage_and_retrieval_time_reach_the_client(self, client, minister_headers, ingested):
        entry = next(
            s
            for s in client.get("/api/v1/system/data-sources", headers=minister_headers).json()["sources"]
            if s["key"] == "nino34"
        )
        assert entry["records"] == 945
        assert entry["coverage_start"] == "1948-01-01"
        assert entry["coverage_end"] == "2026-09-01"
        assert entry["retrieved_at"] and entry["citation"]
        assert entry["provider"] == "NOAA Physical Sciences Laboratory"

    def test_a_connected_source_does_not_clear_the_synthetic_model_caveat(
        self, client, minister_headers, ingested
    ):
        """Downloading inputs is not the same as having retrained on them."""
        body = client.get("/api/v1/system/data-sources", headers=minister_headers).json()
        assert body["data_source"] == "synthetic"
        assert body["caveat"] and "not a statement about real drought risk" in body["caveat"]

    def test_the_validation_entry_states_what_the_comparison_found(self, client, minister_headers, ingested):
        entry = next(
            s
            for s in client.get("/api/v1/system/data-sources", headers=minister_headers).json()["sources"]
            if s["key"] == "chirps_emi"
        )
        assert "r=0.91" in entry["detail"]

    def test_removing_a_manifest_takes_the_source_back_to_unconnected(
        self, client, minister_headers, ingested, artifacts_dir
    ):
        from ai_drews.ingest.base import manifests_dir

        (manifests_dir(artifacts_dir) / "crops.json").unlink()
        entry = next(
            s
            for s in client.get("/api/v1/system/data-sources", headers=minister_headers).json()["sources"]
            if s["key"] == "csa_crops"
        )
        assert entry["status"] == "not_connected"


class TestRetrainIsVisible:
    """A refit model must reach the API. Version and issue month both survive a retrain, so a
    cache keyed only on those serves the old weights until it expires."""

    def test_the_cache_key_changes_when_the_model_is_refitted(self, artifacts_dir):
        from tests.conftest import _settings

        from agriminds_api.core.cache import MemoryCache
        from agriminds_api.services.inference import InferenceService

        service = InferenceService(_settings(artifacts_dir.root), MemoryCache())
        service.load()
        artifacts = service.artifacts
        assert artifacts is not None

        before = artifacts.trained_at
        artifacts.meta["trained_at"] = "2099-01-01T00:00:00+00:00"
        assert artifacts.trained_at != before, "trained_at must come from the metadata"

    def test_a_refit_model_is_not_served_from_the_previous_cube(self, artifacts_dir):
        import numpy as np
        from tests.conftest import _settings

        from agriminds_api.core.cache import MemoryCache
        from agriminds_api.services.inference import InferenceService

        service = InferenceService(_settings(artifacts_dir.root), MemoryCache())
        service.load()
        first = service.risk_cube().probs.copy()

        # Stand in for a retrain: same version, same issue month, different weights.
        artifacts = service.artifacts
        assert artifacts is not None
        artifacts.meta["trained_at"] = "2099-01-01T00:00:00+00:00"
        with np.errstate(all="ignore"):
            for parameter in artifacts.model.parameters():
                parameter.data.mul_(0.0)

        second = service.risk_cube().probs
        assert not np.array_equal(first, second), (
            "the refitted model returned the cached cube; the cache key has lost trained_at"
        )


class TestAtRiskIsOneDefinition:
    """Two pages reporting a different number of exposed cells for the same forecast is worse
    than either number being wrong: it makes both untrustworthy."""

    def test_the_horizon_and_the_dashboard_count_the_same_cells(self):
        from agriminds_api.domain.risk import AT_RISK, is_at_risk, risk_level

        assert AT_RISK == ("High", "Severe")
        for probability in [v / 100 for v in range(0, 101)]:
            assert is_at_risk(probability) == (risk_level(probability) in AT_RISK)

    def test_the_boundary_is_a_real_band_edge_not_a_round_number(self):
        """It was 0.2 once, which is not an edge of anything."""
        from agriminds_api.domain.risk import is_at_risk

        assert is_at_risk(0.20) is False
        assert is_at_risk(0.44) is False
        assert is_at_risk(0.45) is True
        assert is_at_risk(0.99) is True
