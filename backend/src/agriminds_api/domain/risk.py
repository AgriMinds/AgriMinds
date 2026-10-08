"""Risk vocabulary. Thresholds and classifications are owned by ``ai_drews.advisory.rules``;
this module re-exports them so the API never carries its own copy."""

from __future__ import annotations

from enum import StrEnum

from ai_drews.advisory import (
    CITATION,
    CLASSIFICATION_VERSION,
    ENSO_IS_EXTREME,
    enso_category,
    enso_state,
    pdsi_category,
    pdsi_is_drought,
    risk_level,
    season_name,
)


class RiskSource(StrEnum):
    """Where a served probability field came from. Clients must display anything other than MODEL."""

    MODEL = "model"  # live inference from trained weights
    PRECOMPUTED = "precomputed"  # outputs/latest_risk.npz written by the last `ai-drews maps` run


__all__ = [
    "CITATION",
    "CLASSIFICATION_VERSION",
    "ENSO_IS_EXTREME",
    "RiskSource",
    "enso_category",
    "enso_state",
    "pdsi_category",
    "pdsi_is_drought",
    "risk_level",
    "season_name",
]
