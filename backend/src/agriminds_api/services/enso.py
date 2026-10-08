from __future__ import annotations

import pandas as pd

from agriminds_api.core.config import Settings
from agriminds_api.domain.risk import (
    CITATION,
    CLASSIFICATION_VERSION,
    ENSO_IS_EXTREME,
    enso_category,
    enso_state,
)
from agriminds_api.schemas.enso import EnsoOutlookResponse, EnsoPoint
from agriminds_api.services.inference import InferenceService


class EnsoService:
    def __init__(self, inference: InferenceService, settings: Settings) -> None:
        self._inference = inference
        self._settings = settings

    def outlook(self) -> EnsoOutlookResponse:
        cube = self._inference.risk_cube()
        art = self._inference.artifacts
        history: list[EnsoPoint] = []
        forecast: list[EnsoPoint] = []
        if art is not None:
            dates = pd.to_datetime(art.dates)
            n = self._settings.enso_history_months
            for d, v in zip(dates[-n:], art.nino_history[-n:], strict=True):
                history.append(
                    EnsoPoint(
                        date=d.strftime("%Y-%m"),
                        nino34=round(float(v), 3),
                        category=enso_category(float(v)),
                    )
                )
            current = float(art.nino_history[-1])
            fc = art.latest_enso_forecast()
            if fc is not None:
                for i, v in enumerate(fc):
                    forecast.append(
                        EnsoPoint(
                            date=cube.target(i + 1).strftime("%Y-%m"),
                            nino34=round(float(v), 3),
                            is_forecast=True,
                            category=enso_category(float(v)),
                        )
                    )
        else:
            current = 0.0  # precomputed raster carries no ENSO series
        state = enso_state(current)
        category = enso_category(current)
        summary = (
            f"Equatorial Pacific Niño 3.4 is currently in a {state} phase ({current:+.2f} °C). "
            "For the Choke Watershed, El Niño typically suppresses Kiremt rainfall and raises early dry-spell "
            "probability, whereas La Niña is associated with enhanced moisture and flash-erosion risk on slopes."
        )
        if art is None:
            summary = (
                "ENSO series unavailable: the API is serving a precomputed raster without climate indices."
            )
        return EnsoOutlookResponse(
            current_nino34=round(current, 3),
            current_state=state,
            current_category=category,
            is_extreme=ENSO_IS_EXTREME[category],
            classification_version=CLASSIFICATION_VERSION,
            citation=CITATION,
            forecast_horizon_months=len(forecast),
            historical_series=history,
            forecast_series=forecast,
            teleconnection_summary=summary,
            provenance=cube.provenance(),
        )
