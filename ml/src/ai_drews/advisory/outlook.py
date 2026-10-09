"""Seasonal outlook for lead times the drought model cannot forecast.

Skill decays with lead time. Past the point where the model beats climatology there is still
something honest to say — the ocean leads the land, so a strong El Niño or La Niña tilts the odds
for a season months before any drought index moves — but it is a *lean*, not a probability.

So the two are kept categorically apart. A forecast says how likely drought is and is only issued
where that was measured to be better than quoting the long-run average. An outlook says which way
the season is leaning and why, and never carries a percentage. Collapsing them would let a number
with no skill reach a farmer deciding when to plant, which is the failure this module exists to
prevent.

The direction comes from the sign of the teleconnection, not from an assumption: the correlation
is computed from whatever record is loaded (see `analysis.teleconnection`), so a run on synthetic
data reports the synthetic relationship.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Literal

from ai_drews.advisory.classification import ENSO_BANDS, enso_category

Direction = Literal["drier", "near normal", "wetter"]
Confidence = Literal["low", "moderate"]

#: Below this the ocean is not saying anything useful. It is the same threshold Table 2 uses to
#: call a month "Moderate El Niño" or "Moderate La Niña", so the outlook and the ENSO banner
#: cannot disagree about whether an event is under way.
MIN_ENSO_ANOMALY = 0.5

#: Below this the teleconnection is too weak to lean on at all.
MIN_CORRELATION = 0.20

#: Above this the association is strong enough to call the lean "moderate" rather than "low".
#: There is deliberately no "high": an outlook that has not been scored against climatology does
#: not get to sound like a forecast.
MODERATE_CORRELATION = 0.40


@dataclass(frozen=True)
class SeasonalOutlook:
    """Which way a season is leaning, and on what basis."""

    lead_month: int
    target_month: str
    direction: Direction
    confidence: Confidence
    enso_anomaly: float | None
    enso_category: str | None
    correlation: float | None
    basis: str

    @property
    def is_drought_leaning(self) -> bool:
        return self.direction == "drier"

    @property
    def is_flood_leaning(self) -> bool:
        return self.direction == "wetter"

    def to_dict(self) -> dict:
        return asdict(self)


def _direction(anomaly: float, correlation: float) -> Direction:
    """Which way the index is expected to move, from the sign of the association.

    A negative correlation means a warm Pacific goes with a dry watershed, which is the
    documented relationship for Amhara — but it is read from the data rather than assumed, so a
    record that says otherwise produces the opposite lean instead of a wrong one.
    """
    expected = correlation * anomaly  # the direction the drought index is nudged
    return "wetter" if expected > 0 else "drier"


def seasonal_outlook(
    lead_month: int,
    target_month: str,
    enso_anomaly: float | None,
    correlation: float | None,
    *,
    enso_is_forecast: bool = True,
) -> SeasonalOutlook:
    """Build the outlook for one lead.

    ``correlation`` is between the ENSO index and the drought index at this lag; ``enso_anomaly``
    is the Niño 3.4 value expected for the target month. ``enso_is_forecast`` is False when the
    anomaly had to be carried forward from the last observation because the ENSO model does not
    reach this far, which lowers the confidence rather than being hidden.
    """
    category = enso_category(enso_anomaly) if enso_anomaly is not None else None

    if enso_anomaly is None or correlation is None:
        return SeasonalOutlook(
            lead_month=lead_month,
            target_month=target_month,
            direction="near normal",
            confidence="low",
            enso_anomaly=enso_anomaly,
            enso_category=category,
            correlation=correlation,
            basis="No ENSO signal is available for this month, so nothing can be said about it.",
        )

    strength = abs(correlation)
    if abs(enso_anomaly) < MIN_ENSO_ANOMALY:
        return SeasonalOutlook(
            lead_month=lead_month,
            target_month=target_month,
            direction="near normal",
            confidence="low",
            enso_anomaly=enso_anomaly,
            enso_category=category,
            correlation=correlation,
            basis=(
                f"The Pacific is near neutral ({enso_anomaly:+.1f} °C), which gives no lean "
                "either way for this season."
            ),
        )

    if strength < MIN_CORRELATION:
        return SeasonalOutlook(
            lead_month=lead_month,
            target_month=target_month,
            direction="near normal",
            confidence="low",
            enso_anomaly=enso_anomaly,
            enso_category=category,
            correlation=correlation,
            basis=(
                f"{category} is under way, but ENSO tracks drought here too weakly at "
                f"{lead_month} months (r={correlation:+.2f}) to lean on."
            ),
        )

    direction = _direction(enso_anomaly, correlation)
    confidence: Confidence = "moderate" if strength >= MODERATE_CORRELATION and enso_is_forecast else "low"
    carried = "" if enso_is_forecast else " The Pacific value is carried forward, not forecast."
    return SeasonalOutlook(
        lead_month=lead_month,
        target_month=target_month,
        direction=direction,
        confidence=confidence,
        enso_anomaly=enso_anomaly,
        enso_category=category,
        correlation=correlation,
        basis=(
            f"{category} ({enso_anomaly:+.1f} °C) is expected, and ENSO tracks drought here at "
            f"r={correlation:+.2f} at {lead_month} months, which leans the season "
            f"{direction} than normal.{carried}"
        ),
    )


def enso_thresholds() -> dict[str, float]:
    """The bands the outlook shares with the ENSO banner, for anyone checking they agree."""
    return {name: edge for edge, name in ENSO_BANDS}
