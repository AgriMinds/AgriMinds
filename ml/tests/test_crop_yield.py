"""The crop-yield model: loading the published artifact, and what it may be asked for.

The artifact is produced outside the pipeline (``ml/research/crop_yield/run_training.py``) and
needs xgboost to unpickle, so these tests skip rather than fail where either is absent — the
point of the extra is that an installation without it still serves everything else.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from ai_drews.config import DataPaths
from ai_drews.crop_yield import (
    CROP_LABELS,
    CROPS,
    ZONES,
    CropYieldUnavailableError,
    enso_phase,
    load_crop_yield_model,
)

#: Anchored to the repository root so the tests find the artifact wherever pytest is launched from.
REPO_ROOT = Path(__file__).resolve().parents[2]
REPO_PATHS = DataPaths(REPO_ROOT / "data")

pytestmark = pytest.mark.filterwarnings("ignore::DeprecationWarning")

requires_artifact = pytest.mark.skipif(
    not REPO_PATHS.has_crop_yield_artifacts(),
    reason="crop-yield artifact not published; run ml/research/crop_yield/run_training.py",
)


@pytest.fixture(scope="module")
def model():
    pytest.importorskip("xgboost", reason='needs pip install -e "ml[crop-yield]"')
    if not REPO_PATHS.has_crop_yield_artifacts():
        pytest.skip("crop-yield artifact not published")
    return load_crop_yield_model(REPO_PATHS)


class TestPhaseLabels:
    """The cut-offs are a fitted feature of the model, so they are pinned, boundaries included."""

    @pytest.mark.parametrize(
        ("index", "phase"),
        [
            (2.5, "El Nino"),
            (0.5, "El Nino"),
            (0.49, "Neutral"),
            (0.0, "Neutral"),
            (-0.49, "Neutral"),
            (-0.5, "La Nina"),
            (-2.9, "La Nina"),
        ],
    )
    def test_bands(self, index: float, phase: str) -> None:
        assert enso_phase(index) == phase


class TestMissingArtifact:
    def test_absent_files_raise(self, paths: DataPaths) -> None:
        with pytest.raises(CropYieldUnavailableError, match="missing"):
            load_crop_yield_model(paths)

    def test_message_names_the_training_script(self, paths: DataPaths) -> None:
        with pytest.raises(CropYieldUnavailableError, match="run_training.py"):
            load_crop_yield_model(paths)


@requires_artifact
class TestPublishedMetadata:
    def test_every_crop_zone_series_has_its_lags(self) -> None:
        meta = json.loads(REPO_PATHS.crop_yield_meta_json.read_text())
        for crop in CROPS:
            for zone in ZONES:
                series = meta["baseline"]["series"][f"{CROP_LABELS[crop]}|{zone}"]
                assert series["yield_lag1"] > 0
                assert series["yield_rolling3_mean"] > 0

    def test_carries_its_own_caveats(self) -> None:
        meta = json.loads(REPO_PATHS.crop_yield_meta_json.read_text())
        assert meta["caveats"], "a client cannot present this model honestly without them"
        assert meta["dataset"]["test_rows"] == 63


class TestInference:
    def test_predicts_a_plausible_yield_for_every_crop_and_zone(self, model) -> None:
        for crop in CROPS:
            for zone in ZONES:
                q = model.predict(model.inputs_for(crop, zone))
                assert 0 < q < 120, f"{crop}/{zone} -> {q} q/ha is outside anything observed"

    def test_defaults_come_from_the_last_observed_season(self, model) -> None:
        inputs = model.inputs_for("tef", "Midland")
        temp, precip, index = model.baseline_climate
        assert inputs.year == model.baseline_year + 1
        assert (inputs.temperature_c, inputs.precipitation_mm, inputs.enso_index) == (temp, precip, index)
        assert inputs.yield_lag1 == model.last_observed_yield("tef", "Midland")

    def test_an_explicit_scenario_overrides_only_what_it_names(self, model) -> None:
        inputs = model.inputs_for("maize", "Lowland", enso_index=1.4)
        temp, precip, _ = model.baseline_climate
        assert inputs.enso_index == 1.4
        assert inputs.enso_phase == "El Nino"
        assert (inputs.temperature_c, inputs.precipitation_mm) == (temp, precip)

    def test_pt_ratio_is_derived_not_supplied(self, model) -> None:
        inputs = model.inputs_for("wheat", "Highland", temperature_c=20.0, precipitation_mm=80.0)
        assert inputs.pt_ratio == pytest.approx(80.0 / (20.0 + 1e-5))

    def test_unknown_zone_is_refused(self, model) -> None:
        with pytest.raises(KeyError):
            model.zone_profile("Mountaintop")  # type: ignore[arg-type]

    def test_holding_climate_fixed_isolates_the_enso_term(self, model) -> None:
        """The ENSO response is small by construction; this pins that it is not zero either."""
        neutral = model.predict(model.inputs_for("tef", "Lowland", enso_index=0.0))
        el_nino = model.predict(model.inputs_for("tef", "Lowland", enso_index=1.4))
        assert neutral != el_nino
        assert abs(el_nino - neutral) / neutral < 0.5
