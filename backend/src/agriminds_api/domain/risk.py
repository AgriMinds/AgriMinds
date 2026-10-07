"""Risk vocabulary. Thresholds and classifications are owned by ``ai_drews.advisory.rules``;
this module re-exports them so the API never carries its own copy."""

from __future__ import annotations

from enum import StrEnum

from ai_drews.advisory import enso_state, risk_level, season_name


class RiskSource(StrEnum):
    """Where a served probability field came from. Clients must display anything other than MODEL."""

    MODEL = "model"  # live inference from trained weights
    PRECOMPUTED = "precomputed"  # outputs/latest_risk.npz written by the last `ai-drews maps` run


__all__ = ["RiskSource", "enso_state", "risk_level", "season_name"]
