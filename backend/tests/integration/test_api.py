import numpy as np


def test_health_healthy(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "healthy"
    assert body["model"]["loaded"] is True
    assert body["model"]["source"] == "model"
    assert body["model"]["data_source"] == "synthetic"
    assert body["cache"]["backend"] == "memory"
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
    assert len(body["forecast_series"]) == 3
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


def test_unavailable_when_no_artifacts(empty_client):
    health = empty_client.get("/api/v1/health")
    assert health.status_code == 200 and health.json()["status"] == "unavailable"
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
