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

#: What the platform counts as "at risk", everywhere it says so. The ministry dashboard, the
#: forecast horizon and the maps all read this, because a page that used its own cut-off would
#: quietly report a different number of exposed cells than the page beside it.
AT_RISK: tuple[str, ...] = ("High", "Severe")


def is_at_risk(probability: float) -> bool:
    """Whether a probability lands in a band the platform treats as exposure."""
    return risk_level(probability) in AT_RISK


class RiskSource(StrEnum):
    """Where a served probability field came from. Clients must display anything other than MODEL."""

    MODEL = "model"  # live inference from trained weights
    PRECOMPUTED = "precomputed"  # outputs/latest_risk.npz written by the last `ai-drews maps` run


__all__ = [
    "AT_RISK",
    "CITATION",
    "CLASSIFICATION_VERSION",
    "ENSO_IS_EXTREME",
    "RiskSource",
    "is_at_risk",
    "enso_category",
    "enso_state",
    "pdsi_category",
    "pdsi_is_drought",
    "risk_level",
    "season_name",
]
