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
    enso_phase,
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
    CropYieldScenarioSeries,
    CropYieldTimeline,
    CropYieldYear,
    CropYieldZone,
    EnsoBasis,
    EnsoImpactCell,
    EnsoImpactGroup,
    EnsoImpactResponse,
    EnsoYear,
    ZoneRecommendation,
)
from agriminds_api.services.inference import InferenceService

log = logging.getLogger(__name__)

#: Shown in the model card; the full list is long and the tail is all but zero.
TOP_FEATURES = 10


def _at(values: list | None, index: int) -> float | None:
    """One element of a published series, or None where the artifact does not carry it."""
    if not values or index >= len(values):
        return None
    return round(float(values[index]), 3)


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

    #: The ENSO states a projection branches into once observation runs out. Centres of the
    #: study's phase bands: |index| >= 0.5 is a phase, anything inside it is Neutral.
    TIMELINE_SCENARIOS: tuple[tuple[str, str, float], ...] = (
        ("el_nino", "El Niño", 1.0),
        ("neutral", "Neutral", 0.0),
        ("la_nina", "La Niña", -1.0),
    )

    #: Lead past which no candidate beat climatology on this record, so later years are assumed.
    ENSO_FORECAST_LIMIT_MONTHS = 6

    def timeline(self, *, through_year: int) -> CropYieldTimeline:
        """The observed record plus one projected series per assumed ENSO state.

        Observation is used wherever it exists: Niño 3.4 is measured several years past the end
        of the crop record, so the seasons in between are projected under the ENSO that actually
        happened, and only the years after that branch.
        """
        model = self.model
        history = model.history
        reference = model.enso_annual_reference
        if not history or not reference.get("years"):
            raise ModelUnavailableError(
                "This artifact predates the published record series. Re-run "
                "ml/research/crop_yield/run_training.py to publish it."
            )

        years = [int(y) for y in history["years"]]
        belts = history["belt_average_yield_q_ha"]
        crop_av = history.get("crop_average_q_ha") or []
        observed = [
            CropYieldYear(
                year=year,
                tef_q_ha=_at(belts.get("tef"), i),
                wheat_q_ha=_at(belts.get("wheat"), i),
                maize_q_ha=_at(belts.get("maize"), i),
                crop_average_q_ha=_at(crop_av, i),
            )
            for i, year in enumerate(years)
        ]

        observed_enso = {
            int(y): float(v)
            for y, v in zip(reference["years"], reference["nino34"], strict=True)
            if int(y) <= through_year
        }
        enso_observed_through = max(observed_enso) if observed_enso else model.baseline_year

        scenarios: list[CropYieldScenarioSeries] = []
        for key, label, value in self.TIMELINE_SCENARIOS:
            by_year = {
                year: observed_enso.get(year, value)
                for year in range(model.baseline_year + 1, through_year + 1)
            }
            projected = model.project(through_year=through_year, enso_by_year=by_year)
            scenarios.append(
                CropYieldScenarioSeries(
                    key=key,
                    label=label,
                    enso_index=value,
                    enso_phase=enso_phase(value),
                    years=[
                        CropYieldYear(
                            year=year,
                            tef_q_ha=round(vals.get("tef", 0.0), 3),
                            wheat_q_ha=round(vals.get("wheat", 0.0), 3),
                            maize_q_ha=round(vals.get("maize", 0.0), 3),
                            crop_average_q_ha=round(sum(vals.values()) / len(vals), 3) if vals else None,
                        )
                        for year, vals in sorted(projected.items())
                    ],
                )
            )

        enso_series = [
            EnsoYear(year=year, nino34=round(observed_enso[year], 3), basis="observed")
            for year in sorted(observed_enso)
        ]

        return CropYieldTimeline(
            first_year=min(years),
            through_year=through_year,
            yields_observed_through=max(years),
            enso_observed_through=enso_observed_through,
            observed=observed,
            enso=enso_series,
            scenarios=scenarios,
            enso_forecast_limit_months=self.ENSO_FORECAST_LIMIT_MONTHS,
            caveats=model.caveats,
            provenance=self._provenance(),
        )

    def enso_impact(self) -> EnsoImpactResponse:
        model = self.model
        cells = model.enso_impact
        if not cells:
            raise ModelUnavailableError(
                "This artifact predates the El Niño impact analysis. Re-run "
                "ml/research/crop_yield/run_training.py to publish it."
            )
        out = [
            EnsoImpactCell(
                crop=c.crop,
                zone=c.zone,
                effect_pct=c.effect_pct,
                p_value=c.p_value,
                significant=c.significant,
                n_el_nino=c.n_el_nino,
                n_other=c.n_other,
            )
            for c in cells
        ]

        def group(by: str) -> list[EnsoImpactGroup]:
            keys = sorted({getattr(c, by) for c in cells})
            return [
                EnsoImpactGroup(
                    key=key,
                    effect_pct=round(
                        sum(c.effect_pct for c in cells if getattr(c, by) == key)
                        / len([c for c in cells if getattr(c, by) == key]),
                        2,
                    ),
                    significant_cells=sum(1 for c in cells if getattr(c, by) == key and c.significant),
                )
                for key in keys
            ]

        def as_recommendation(cell) -> ZoneRecommendation:
            return ZoneRecommendation(
                crop=cell.crop,
                zone=cell.zone,
                zone_local_name=model.zone_profile(cell.zone).local_name,
                effect_pct=cell.effect_pct,
                p_value=cell.p_value,
                significant=cell.significant,
                still_negative=cell.effect_pct < 0,
            )

        best = [
            as_recommendation(max((c for c in cells if c.zone == zone), key=lambda c: c.effect_pct))
            for zone in ZONES
        ]
        worst = sorted(cells, key=lambda c: c.effect_pct)[:2]
        dataset = model.dataset
        return EnsoImpactResponse(
            cells=out,
            by_crop=group("crop"),
            by_zone=group("zone"),
            overall_effect_pct=round(sum(c.effect_pct for c in cells) / len(cells), 2),
            significant_cells=sum(1 for c in cells if c.significant),
            el_nino_years=[int(y) for y in model.meta["enso_impact"].get("el_nino_years", [])],
            record_years=[int(dataset.get("first_year", 0)), int(dataset.get("last_year", 0))],
            method=model.enso_impact_method,
            recommendations=best,
            cautions=[as_recommendation(c) for c in worst],
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
