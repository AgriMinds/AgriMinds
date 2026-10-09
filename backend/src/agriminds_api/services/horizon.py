"""Assemble the forecast horizon: which leads carry a probability and which only a lean.

The model is trained for a full year, but training a lead is not the same as earning the right
to publish it. Each lead was scored against climatology at training time; this service reads
that score and decides, per lead, whether the client gets a number or a direction.

Nothing here re-derives skill. The measurement happened once, where the held-out data was, and
is carried in the model metadata — so the API cannot disagree with the training run about what
the model is worth.
"""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd
from ai_drews.advisory.classification import MIN_SKILFUL_BSS, horizon_kind, skilful_leads
from ai_drews.advisory.outlook import seasonal_outlook
from ai_drews.config import DataPaths

from agriminds_api.core.config import Settings
from agriminds_api.core.exceptions import ModelUnavailableError
from agriminds_api.domain.geo import GridSpec
from agriminds_api.domain.risk import is_at_risk
from agriminds_api.schemas.horizon import HorizonResponse, LeadHorizon, LeadSkill
from agriminds_api.services.inference import InferenceService

log = logging.getLogger(__name__)


class HorizonService:
    def __init__(self, settings: Settings, inference: InferenceService, grid: GridSpec) -> None:
        self._settings = settings
        self._inference = inference
        self._grid = grid

    def horizon(self) -> HorizonResponse:
        artifacts = self._inference.artifacts
        if artifacts is None:
            raise ModelUnavailableError("No trained model is loaded on this deployment.")

        cube = self._inference.risk_cube()
        metrics: list[dict] = list(artifacts.meta.get("metrics", []))
        by_lead = {int(row["lead"]): row for row in metrics}
        earned = skilful_leads(metrics)
        correlation = self._teleconnection()
        inside = self._inside_mask()

        leads: list[LeadHorizon] = []
        for lead in range(1, cube.probs.shape[0] + 1):
            row = by_lead.get(lead, {})
            kind = horizon_kind(lead, metrics)
            target = cube.target(lead)
            anomaly = self._inference.nino_for_lead(lead)
            skill = LeadSkill(
                auc=row.get("AUC"),
                auc_persistence=row.get("AUC_persistence"),
                brier=row.get("Brier"),
                bss_vs_climatology=row.get("BSS_vs_climatology"),
                pod=row.get("POD"),
                far=row.get("FAR"),
            )
            entry = LeadHorizon(
                lead_month=lead,
                target_month=target.strftime("%Y-%m-%d"),
                kind=kind,
                skill=skill,
                enso_anomaly=round(anomaly, 2),
            )

            if kind == "forecast":
                field = cube.probs[lead - 1][inside]
                entry.probability = round(float(np.mean(field)), 3)
                entry.max_probability = round(float(np.max(field)), 3)
                # The same definition the ministry dashboard counts with, so the two pages
                # cannot report a different number of exposed cells for the same forecast.
                entry.cells_at_risk = int(sum(1 for value in field.ravel() if is_at_risk(float(value))))
            else:
                # Beyond measured skill the ocean is the only thing still saying anything.
                outlook = seasonal_outlook(
                    lead,
                    target.strftime("%Y-%m-%d"),
                    anomaly,
                    correlation,
                    enso_is_forecast=lead <= self._enso_reach(artifacts),
                )
                entry.direction = outlook.direction
                entry.confidence = outlook.confidence
                entry.basis = outlook.basis
                entry.enso_category = outlook.enso_category
            leads.append(entry)

        return HorizonResponse(
            issued_date=cube.issued_date,
            trained_leads=cube.probs.shape[0],
            skilful_leads=earned,
            min_skilful_bss=float(artifacts.meta.get("min_skilful_bss", MIN_SKILFUL_BSS)),
            teleconnection_r=correlation,
            leads=leads,
            note=self._note(earned, cube.probs.shape[0], correlation),
        )

    # ------------------------------------------------------------------ helpers
    def _inside_mask(self) -> np.ndarray:
        """Cells the catchment contains. The grid is a rectangle over a basin that is not one,
        so averaging over all of it would mix in land the basin does not hold."""
        mask = np.zeros((self._grid.rows, self._grid.cols), dtype=bool)
        for cell in self._grid.cells():
            mask[cell.row, cell.col] = self._grid.in_watershed(cell)
        return mask if mask.any() else np.ones_like(mask)

    def _enso_reach(self, artifacts) -> int:
        """How many leads the ENSO model itself forecasts; beyond that it is carried forward."""
        forecast = artifacts.latest_enso_forecast()
        return 0 if forecast is None else int(len(forecast))

    def _teleconnection(self) -> float | None:
        """Correlation between ENSO and the drought index, as measured on the loaded record.

        Read from the training output rather than assumed, so a weak relationship produces a
        weak outlook instead of a confident one.
        """
        path = DataPaths.from_env(self._settings.data_dir).outputs / "enso_drought_correlation.csv"
        if not path.is_file():
            return None
        try:
            frame = pd.read_csv(path)
            if frame.empty:
                return None
            strongest = frame.loc[frame["correlation"].abs().idxmax()]
            return round(float(strongest["correlation"]), 3)
        except Exception:  # noqa: BLE001 - a missing correlation means "no lean", not an error
            log.warning("could not read the teleconnection from %s", path)
            return None

    def _note(self, earned: list[int], trained: int, correlation: float | None) -> str:
        if not earned:
            return (
                f"None of the {trained} trained leads beat climatology on held-out data, so no "
                "probability is published. Everything below is a seasonal lean at best."
            )
        furthest = max(earned)
        tail = (
            ""
            if correlation is None or abs(correlation) >= 0.2
            else " ENSO tracks drought here too weakly to lean on, so the longer months say little."
        )
        return (
            f"{len(earned)} of {trained} leads beat climatology and carry a probability "
            f"(up to {furthest} month{'s' if furthest > 1 else ''} ahead). The rest are a "
            f"seasonal outlook: a direction, never a number.{tail}"
        )
