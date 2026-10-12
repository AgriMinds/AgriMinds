"""The crop-yield endpoints: what they predict, what they refuse, and what they admit to."""

from __future__ import annotations

import pytest
from ai_drews.crop_yield import CROPS, ZONES

CELLS = len(CROPS) * len(ZONES)

pytest.importorskip("xgboost", reason='crop-yield artifact needs pip install -e "ml[crop-yield]"')


@pytest.fixture
def outlook(client):
    res = client.get("/api/v1/crop-yield/outlook")
    if res.status_code == 503:
        pytest.skip("no crop-yield artifact published in data/models")
    assert res.status_code == 200, res.text
    return res.json()


class TestOutlook:
    def test_covers_every_crop_and_belt_once(self, outlook) -> None:
        pairs = {(c["crop"], c["zone"]) for c in outlook["cells"]}
        assert len(outlook["cells"]) == CELLS
        assert pairs == {(crop, zone) for crop in CROPS for zone in ZONES}

    def test_yields_are_in_quintals_per_hectare_not_fractions(self, outlook) -> None:
        for cell in outlook["cells"]:
            assert 0 < cell["predicted_yield_q_ha"] < 120
            assert 0 < cell["last_observed_yield_q_ha"] < 120

    def test_every_number_shows_what_it_was_computed_from(self, outlook) -> None:
        for cell in outlook["cells"]:
            inputs = cell["inputs"]
            assert inputs["year"] == outlook["year"]
            assert inputs["enso_index"] == outlook["enso_index"]
            assert inputs["yield_lag1"] == cell["last_observed_yield_q_ha"]

    def test_names_where_the_enso_value_came_from(self, outlook) -> None:
        # The test fixture trains the ENSO head, so a lead-free request reads the last observation.
        assert outlook["enso_basis"] in {"forecast", "observed", "dataset"}
        assert outlook["lead_month"] is None

    def test_a_lead_month_uses_the_platform_forecast(self, client, outlook) -> None:
        res = client.get("/api/v1/crop-yield/outlook?lead_month=3")
        assert res.status_code == 200
        body = res.json()
        assert body["enso_basis"] == "forecast"
        assert body["lead_month"] == 3

    def test_carries_the_caveats_a_client_must_show(self, outlook) -> None:
        assert outlook["caveats"]
        assert any("persistence" in c for c in outlook["caveats"])

    def test_provenance_names_the_spreadsheet_and_the_holdout_error(self, outlook) -> None:
        p = outlook["provenance"]
        assert p["dataset_file"].endswith(".xlsx")
        assert p["record_years"] == [1990, 2023]
        assert p["test_rmse_q_ha"] > 0

    def test_an_explicit_year_is_honoured(self, client, outlook) -> None:
        body = client.get("/api/v1/crop-yield/outlook?year=2030").json()
        assert body["year"] == 2030
        assert all(c["inputs"]["year"] == 2030 for c in body["cells"])

    def test_refuses_a_year_outside_the_allowed_range(self, client) -> None:
        assert client.get("/api/v1/crop-yield/outlook?year=1800").status_code == 422


class TestEnsoTerm:
    def test_the_neutral_column_isolates_the_enso_response(self, client, outlook) -> None:
        body = client.get("/api/v1/crop-yield/outlook?year=2024").json()
        for cell in body["cells"]:
            # A La Niña or El Niño row must differ from its own neutral counterpart, and the
            # delta must be the one the response reports.
            if cell["inputs"]["enso_phase"] == "Neutral":
                continue
            delta = (cell["predicted_yield_q_ha"] - cell["neutral_yield_q_ha"]) / cell["neutral_yield_q_ha"]
            assert cell["enso_delta_pct"] == pytest.approx(delta * 100, abs=0.02)


class TestSimulate:
    def test_a_named_scenario_changes_the_answer(self, client, outlook) -> None:
        dry = client.post(
            "/api/v1/crop-yield/simulate",
            json={
                "crop": "maize",
                "zone": "Midland",
                "temperature_c": 21.0,
                "precipitation_mm": 40.0,
                "enso_index": 1.6,
            },
        )
        assert dry.status_code == 200, dry.text
        cell = dry.json()["cell"]
        assert cell["crop"] == "maize"
        assert cell["inputs"]["enso_phase"] == "El Nino"
        assert cell["inputs"]["precipitation_mm"] == 40.0
        assert cell["predicted_yield_q_ha"] > 0

    def test_unnamed_inputs_fall_back_to_the_observed_season(self, client, outlook) -> None:
        body = client.post("/api/v1/crop-yield/simulate", json={"crop": "tef", "zone": "Lowland"}).json()
        baseline = next(c for c in outlook["cells"] if c["crop"] == "tef" and c["zone"] == "Lowland")
        assert body["cell"]["inputs"]["temperature_c"] == baseline["inputs"]["temperature_c"]
        assert body["cell"]["inputs"]["yield_lag1"] == baseline["inputs"]["yield_lag1"]

    def test_refuses_a_crop_it_was_never_fitted_on(self, client) -> None:
        res = client.post("/api/v1/crop-yield/simulate", json={"crop": "barley", "zone": "Midland"})
        assert res.status_code == 422

    def test_refuses_an_impossible_enso_index(self, client) -> None:
        res = client.post(
            "/api/v1/crop-yield/simulate", json={"crop": "tef", "zone": "Midland", "enso_index": 9.0}
        )
        assert res.status_code == 422

    def test_a_belt_must_be_named_in_the_models_own_vocabulary(self, client) -> None:
        """The local name is "Dega"; the model was fitted on "Highland"."""
        res = client.post("/api/v1/crop-yield/simulate", json={"crop": "tef", "zone": "Dega"})
        assert res.status_code == 422


class TestModelCard:
    def test_scores_every_candidate_and_marks_the_one_in_use(self, client, outlook) -> None:
        card = client.get("/api/v1/crop-yield/model").json()
        assert len(card["candidates"]) == 5
        selected = [c for c in card["candidates"] if c["selected"]]
        assert len(selected) == 1
        assert selected[0]["model"] == card["provenance"]["model_name"]
        # Ordered by holdout error, so the table reads best-first.
        assert card["candidates"] == sorted(card["candidates"], key=lambda c: c["test_rmse"])

    def test_reports_what_the_model_leans_on(self, client, outlook) -> None:
        card = client.get("/api/v1/crop-yield/model").json()
        top = card["feature_importance"][0]
        assert top["feature"] == "yield_lag1"
        assert top["importance"] > 0.4

    def test_names_the_upstream_repository_it_came_from(self, client, outlook) -> None:
        card = client.get("/api/v1/crop-yield/model").json()
        assert card["upstream_repo"] == "aykgeh/Chokye_Water_Shield"
        assert card["test_rows"] == 63
        assert card["train_years"] == [1990, 2016]


class TestUnavailable:
    """No artifact: 503 with the platform's error envelope, never an invented number."""

    @pytest.mark.parametrize("path", ["/api/v1/crop-yield/outlook", "/api/v1/crop-yield/model"])
    def test_reports_itself_unavailable(self, empty_client, path: str) -> None:
        res = empty_client.get(path)
        assert res.status_code == 503
        assert res.json()["error"]["code"] == "model_unavailable"

    def test_simulate_is_unavailable_too(self, empty_client) -> None:
        res = empty_client.post("/api/v1/crop-yield/simulate", json={"crop": "tef", "zone": "Midland"})
        assert res.status_code == 503


class TestEnsoImpact:
    """What the record shows, kept apart from what the model predicts."""

    @pytest.fixture
    def impact(self, client):
        res = client.get("/api/v1/crop-yield/enso-impact")
        if res.status_code == 503:
            pytest.skip("no crop-yield artifact published in data/models")
        assert res.status_code == 200, res.text
        return res.json()

    def test_measures_every_crop_and_belt(self, impact) -> None:
        assert len(impact["cells"]) == CELLS
        assert {(c["crop"], c["zone"]) for c in impact["cells"]} == {
            (crop, zone) for crop in CROPS for zone in ZONES
        }

    def test_every_cell_carries_its_p_value_and_sample_sizes(self, impact) -> None:
        for cell in impact["cells"]:
            assert 0 <= cell["p_value"] <= 1
            assert cell["significant"] == (cell["p_value"] < 0.05)
            assert cell["n_el_nino"] + cell["n_other"] == 34

    def test_names_the_el_nino_years_it_used(self, impact) -> None:
        assert len(impact["el_nino_years"]) == impact["cells"][0]["n_el_nino"]
        assert impact["record_years"] == [1990, 2023]
        assert "detrended" in impact["method"]

    def test_recommends_one_crop_per_belt_from_the_same_table(self, impact) -> None:
        assert {r["zone"] for r in impact["recommendations"]} == set(ZONES)
        for rec in impact["recommendations"]:
            best = max(
                (c for c in impact["cells"] if c["zone"] == rec["zone"]), key=lambda c: c["effect_pct"]
            )
            assert (rec["crop"], rec["effect_pct"]) == (best["crop"], best["effect_pct"])

    def test_a_recommended_crop_that_still_loses_is_flagged_as_such(self, impact) -> None:
        for rec in impact["recommendations"]:
            assert rec["still_negative"] == (rec["effect_pct"] < 0)

    def test_cautions_are_the_worst_pairings_worst_first(self, impact) -> None:
        worst = sorted(impact["cells"], key=lambda c: c["effect_pct"])[: len(impact["cautions"])]
        assert [c["crop"] for c in impact["cautions"]] == [c["crop"] for c in worst]
        assert impact["cautions"][0]["effect_pct"] <= impact["cautions"][-1]["effect_pct"]

    def test_the_impact_table_is_not_the_models_enso_term(self, client, impact) -> None:
        """Two different claims: the record's effect, and the regressor's response."""
        outlook = client.get("/api/v1/crop-yield/outlook").json()
        measured = {(c["crop"], c["zone"]): c["effect_pct"] for c in impact["cells"]}
        predicted = {(c["crop"], c["zone"]): c["enso_delta_pct"] for c in outlook["cells"]}
        assert measured != predicted

    def test_unavailable_without_an_artifact(self, empty_client) -> None:
        res = empty_client.get("/api/v1/crop-yield/enso-impact")
        assert res.status_code == 503


@pytest.fixture
def timeline(client):
    res = client.get("/api/v1/crop-yield/timeline")
    if res.status_code == 503:
        pytest.skip("no crop-yield artifact published in data/models")
    assert res.status_code == 200, res.text
    return res.json()


class TestTimeline:
    """The record and what follows it. The point of this endpoint is the boundaries."""

    def test_observed_yields_cover_the_whole_training_record(self, timeline) -> None:
        years = [y["year"] for y in timeline["observed"]]
        assert years == sorted(years)
        assert years[0] == timeline["first_year"]
        assert years[-1] == timeline["yields_observed_through"]

    def test_enso_is_observed_past_the_end_of_the_crop_record(self, timeline) -> None:
        # The crop panel stops years before the ENSO panel does. A client that assumed one
        # boundary would project over observations it already has.
        assert timeline["enso_observed_through"] > timeline["yields_observed_through"]
        assert {e["basis"] for e in timeline["enso"]} == {"observed"}

    def test_every_scenario_agrees_while_enso_is_still_observed(self, timeline) -> None:
        """Seasons before the branch are driven by the ENSO that happened, not by an assumption."""
        shared = timeline["enso_observed_through"]
        by_scenario = {
            s["key"]: {y["year"]: y["wheat_q_ha"] for y in s["years"]} for s in timeline["scenarios"]
        }
        for year in range(timeline["yields_observed_through"] + 1, shared + 1):
            values = {s[year] for s in by_scenario.values()}
            assert len(values) == 1, f"scenarios disagree in {year}, before ENSO stops being observed"

    def test_scenarios_diverge_once_enso_is_only_assumed(self, timeline) -> None:
        last = timeline["through_year"]
        values = {
            s["key"]: next(y["wheat_q_ha"] for y in s["years"] if y["year"] == last)
            for s in timeline["scenarios"]
        }
        assert len(set(values.values())) > 1, "an assumed ENSO state must change something"

    def test_names_the_three_states_and_their_indices(self, timeline) -> None:
        states = {s["key"]: s["enso_index"] for s in timeline["scenarios"]}
        assert states == {"el_nino": 1.0, "neutral": 0.0, "la_nina": -1.0}
        phases = {s["key"]: s["enso_phase"] for s in timeline["scenarios"]}
        assert phases == {"el_nino": "El Nino", "neutral": "Neutral", "la_nina": "La Nina"}

    def test_projected_yields_stay_in_quintals_per_hectare(self, timeline) -> None:
        for scenario in timeline["scenarios"]:
            for year in scenario["years"]:
                for crop in ("tef_q_ha", "wheat_q_ha", "maize_q_ha"):
                    assert 0 < year[crop] < 120

    def test_declares_how_far_ahead_enso_is_worth_anything(self, timeline) -> None:
        assert 1 <= timeline["enso_forecast_limit_months"] <= 12
        assert timeline["caveats"]

    def test_refuses_a_horizon_outside_the_allowed_range(self, client) -> None:
        assert client.get("/api/v1/crop-yield/timeline?through_year=1800").status_code == 422
