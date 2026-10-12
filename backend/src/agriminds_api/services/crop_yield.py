"""Owns the crop-yield artifact and turns it into responses.

Loaded and reported independently of the drought model: a deployment can have one, the other,
both or neither, and each endpoint says which. There is no fallback — without the artifact the
endpoints return 503 rather than a number nobody fitted.

The one thing it borrows from the drought side is the Niño 3.4 value: an outlook asked for a
lead month uses the platform's own CNN-LSTM forecast, so the two models tell one story instead
of two. When that pipeline is untrained, the last year of the crop record is used and the
response says so.
"""

from __future__ import annotations

import logging

from ai_drews.config import DataPaths
from ai_drews.crop_yield import (
    CROPS,
    ZONES,
    AgroZone,
    Crop,
    CropYieldModel,
    CropYieldUnavailableError,
    load_crop_yield_model,
)

from agriminds_api.core.config import Settings
from agriminds_api.core.exceptions import ModelUnavailableError
from agriminds_api.schemas.crop_yield import (
    CropYieldCandidate,
    CropYieldCell,
    CropYieldFeature,
    CropYieldInputs,
    CropYieldModelCard,
    CropYieldOutlook,
    CropYieldProvenance,
    CropYieldScenario,
    CropYieldScenarioRequest,
    CropYieldZone,
    EnsoBasis,
)
from agriminds_api.services.inference import InferenceService

log = logging.getLogger(__name__)

#: Shown in the model card; the full list is long and the tail is all but zero.
TOP_FEATURES = 10


def _pct(value: float, reference: float) -> float:
    """Percentage change, or 0.0 when there is nothing to compare against."""
    if reference == 0:
        return 0.0
    return round((value - reference) / reference * 100, 2)


class CropYieldService:
    def __init__(self, settings: Settings, inference: InferenceService) -> None:
        self._settings = settings
        self._inference = inference
        self._paths = DataPaths.from_env(settings.data_dir)
        self._model: CropYieldModel | None = None

    # ---- lifecycle -----------------------------------------------------------------------
    def load(self) -> None:
        try:
            self._model = load_crop_yield_model(self._paths)
        except CropYieldUnavailableError as exc:
            log.warning("crop-yield model unavailable: %s", exc)
            self._model = None
            return
        log.info(
            "loaded crop-yield model %s %s (trained %s, record to %s)",
            self._model.model_name,
            self._model.model_version,
            self._model.trained_at,
            self._model.baseline_year,
        )

    @property
    def available(self) -> bool:
        return self._model is not None

    @property
    def model(self) -> CropYieldModel:
        if self._model is None:
            raise ModelUnavailableError(
                "The crop-yield model is not available on this server. "
                "Train it with ml/research/crop_yield/run_training.py and restart the API."
            )
        return self._model

    # ---- the ENSO value a prediction is conditioned on -----------------------------------
    def _enso(self, lead_month: int | None) -> tuple[float, EnsoBasis]:
        art = self._inference.artifacts
        if art is None:
            _, _, index = self.model.baseline_climate
            return index, "dataset"
        if lead_month is not None:
            forecast = art.latest_enso_forecast()
            if forecast is not None and lead_month - 1 < len(forecast):
                return float(forecast[lead_month - 1]), "forecast"
        return float(art.nino_history[-1]), "observed"

    # ---- responses -----------------------------------------------------------------------
    def _cell(
        self,
        crop: Crop,
        zone: AgroZone,
        *,
        year: int | None,
        temperature_c: float | None,
        precipitation_mm: float | None,
        enso_index: float,
    ) -> CropYieldCell:
        model = self.model
        inputs = model.inputs_for(
            crop,
            zone,
            year=year,
            temperature_c=temperature_c,
            precipitation_mm=precipitation_mm,
            enso_index=enso_index,
        )
        predicted = model.predict(inputs)
        # Same row with the ENSO anomaly removed: the difference is the model's whole ENSO
        # response, which is the only honest way to show it next to the headline number.
        neutral = model.predict(
            model.inputs_for(
                crop,
                zone,
                year=inputs.year,
                temperature_c=inputs.temperature_c,
                precipitation_mm=inputs.precipitation_mm,
                enso_index=0.0,
            )
        )
        observed = model.last_observed_yield(crop, zone)
        profile = model.zone_profile(zone)
        return CropYieldCell(
            crop=crop,
            zone=zone,
            zone_local_name=profile.local_name,
            altitude_approx_m=profile.altitude_approx_m,
            predicted_yield_q_ha=round(predicted, 2),
            neutral_yield_q_ha=round(neutral, 2),
            enso_delta_pct=_pct(predicted, neutral),
            last_observed_yield_q_ha=round(observed, 2),
            change_vs_last_observed_pct=_pct(predicted, observed),
            inputs=CropYieldInputs(
                year=inputs.year,
                temperature_c=round(inputs.temperature_c, 2),
                precipitation_mm=round(inputs.precipitation_mm, 2),
                enso_index=round(inputs.enso_index, 3),
                enso_phase=inputs.enso_phase,
                yield_lag1=round(inputs.yield_lag1, 2),
                yield_rolling3_mean=round(inputs.yield_rolling3_mean, 2),
            ),
        )

    def outlook(self, *, year: int | None = None, lead_month: int | None = None) -> CropYieldOutlook:
        model = self.model
        index, basis = self._enso(lead_month)
        cells = [
            self._cell(
                crop,
                zone,
                year=year,
                temperature_c=None,
                precipitation_mm=None,
                enso_index=index,
            )
            for crop in CROPS
            for zone in ZONES
        ]
        first = cells[0]
        return CropYieldOutlook(
            year=first.inputs.year,
            enso_index=round(index, 3),
            enso_phase=first.inputs.enso_phase,
            enso_basis=basis,
            lead_month=lead_month if basis == "forecast" else None,
            baseline_year=model.baseline_year,
            cells=cells,
            caveats=model.caveats,
            provenance=self._provenance(),
        )

    def simulate(self, req: CropYieldScenarioRequest) -> CropYieldScenario:
        model = self.model
        index = req.enso_index
        if index is None:
            index, _ = self._enso(None)
        cell = self._cell(
            req.crop,
            req.zone,
            year=req.year,
            temperature_c=req.temperature_c,
            precipitation_mm=req.precipitation_mm,
            enso_index=index,
        )
        return CropYieldScenario(cell=cell, caveats=model.caveats, provenance=self._provenance())

    def _provenance(self) -> CropYieldProvenance:
        model = self.model
        dataset = model.dataset
        metrics = model.selected_metrics
        return CropYieldProvenance(
            model_name=model.model_name,
            model_version=model.model_version,
            trained_at=model.trained_at,
            dataset_file=str(dataset.get("file", "unknown")),
            record_years=[int(dataset.get("first_year", 0)), int(dataset.get("last_year", 0))],
            test_rmse_q_ha=float(metrics.get("test_rmse", 0.0)),
            test_r2=float(metrics.get("test_r2", 0.0)),
        )

    def model_card(self) -> CropYieldModelCard:
        model = self.model
        dataset = model.dataset
        selected = model.model_name
        candidates = [
            CropYieldCandidate(
                model=name,
                train_rmse=float(m.get("train_rmse", 0.0)),
                test_rmse=float(m.get("test_rmse", 0.0)),
                test_mae=float(m.get("test_mae", 0.0)),
                test_r2=float(m.get("test_r2", 0.0)),
                test_mape=float(m.get("test_mape", 0.0)),
                selected=name == selected,
            )
            for name, m in model.metrics.items()
        ]
        return CropYieldModelCard(
            provenance=self._provenance(),
            upstream_repo=str(model.meta.get("upstream", {}).get("repo", "unknown")),
            upstream_revision=str(model.meta.get("upstream", {}).get("revision", "unknown")),
            record_rows=int(dataset.get("rows", 0)),
            train_years=[int(y) for y in dataset.get("train_years", [])],
            test_years=[int(y) for y in dataset.get("test_years", [])],
            test_rows=int(dataset.get("test_rows", 0)),
            mean_yield_q_ha=float(dataset.get("mean_yield_q_ha", 0.0)),
            candidates=sorted(candidates, key=lambda c: c.test_rmse),
            feature_importance=[
                CropYieldFeature(feature=name, importance=weight)
                for name, weight in model.feature_importance[:TOP_FEATURES]
            ],
            zones=[
                CropYieldZone(
                    zone=z.zone,
                    local_name=z.local_name,
                    altitude_approx_m=z.altitude_approx_m,
                    altitude_min_m=z.altitude_min_m,
                    altitude_max_m=z.altitude_max_m,
                )
                for z in model.zones
            ],
            caveats=model.caveats,
        )
