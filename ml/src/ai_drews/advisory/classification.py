"""Drought-intensity and ENSO-phase classification thresholds.

Source
------
Table 2, "Thresholds for Sc-PDSI and ENSO categories to identify drought intensities",
after Megbar & Tadesse (2016) and Menberu & Addisu (2018), as adopted by the AI-DREWS study
of the Choke Mountain watershed, Amhara.

Published as written, the table leaves hairline gaps between bands (for example 0.99 to 1.00
on the Niño 3.4 scale). Indices are continuous, so each gap is closed here and the decision
is stated next to the band rather than left to whichever comparison happened to be written
first. Every boundary below is covered by a test.
"""

from __future__ import annotations

from typing import Literal

#: Bump when a threshold moves, so a stored classification can be traced to the table that produced it.
CLASSIFICATION_VERSION = "table2-2026.10"

CITATION = (
    "Thresholds after Megbar & Tadesse (2016) and Menberu & Addisu (2018), "
    "Table 2 of the AI-DREWS Choke watershed study."
)

# ---------------------------------------------------------------------------- ENSO
EnsoCategory = Literal[
    "High El Niño",
    "Moderate El Niño",
    "Neutral",
    "Moderate La Niña",
    "High La Niña",
]

#: Upper bound (exclusive) of each band, ascending, with the category that sits below it.
#: Published bands: < -1 High La Niña | -0.99..-0.51 Moderate La Niña | -0.50..0.50 Neutral
#: | 0.51..0.99 Moderate El Niño | > 1 High El Niño.
#: Gap-closing: a value of exactly -1.00 is read as High La Niña and exactly +1.00 as High
#: El Niño, so the strongest band always wins at its own boundary.
ENSO_BANDS: tuple[tuple[float, EnsoCategory], ...] = (
    (-1.0, "High La Niña"),  # nino34 <= -1.00
    (-0.5, "Moderate La Niña"),  # -1.00 <  nino34 <  -0.50
    (0.5, "Neutral"),  # -0.50 <= nino34 <=  0.50
    (1.0, "Moderate El Niño"),  #  0.50 <  nino34 <   1.00
)

#: The three-way phase the rest of the platform already speaks, for each fine-grained category.
ENSO_PHASE: dict[EnsoCategory, str] = {
    "High El Niño": "El Niño",
    "Moderate El Niño": "El Niño",
    "Neutral": "Neutral",
    "Moderate La Niña": "La Niña",
    "High La Niña": "La Niña",
}

#: True where the category is strong enough to warrant a changed agronomic recommendation.
ENSO_IS_EXTREME: dict[EnsoCategory, bool] = {
    "High El Niño": True,
    "Moderate El Niño": False,
    "Neutral": False,
    "Moderate La Niña": False,
    "High La Niña": True,
}


def enso_category(nino34: float) -> EnsoCategory:
    """Classify a Niño 3.4 anomaly (°C) into one of the five bands of Table 2."""
    value = float(nino34)
    if value <= ENSO_BANDS[0][0]:
        return "High La Niña"
    if value < ENSO_BANDS[1][0]:
        return "Moderate La Niña"
    if value <= ENSO_BANDS[2][0]:
        return "Neutral"
    if value < ENSO_BANDS[3][0]:
        return "Moderate El Niño"
    return "High El Niño"


# ---------------------------------------------------------------------------- Sc-PDSI
PdsiCategory = Literal[
    "Extremely wet",
    "Very wet",
    "Moderately wet",
    "Normal",
    "Moderately dry",
    "Very dry",
    "Extremely dry",
]

#: Published bands: > 3 extremely wet | 2..3 very wet | 1.01..1.99 moderately wet
#: | -1..1 normal | -1.01..-1.99 moderately dry | -2..-3 very dry | < -3 extremely dry.
#: Gap-closing: ±1 belongs to Normal, ±2 to the "very" band and ±3 to the "very" band, so a
#: whole number never falls between two categories.
PDSI_BANDS: tuple[tuple[float, PdsiCategory], ...] = (
    (-3.0, "Extremely dry"),  # value <  -3
    (-2.0, "Very dry"),  # -3 <= value <= -2
    (-1.0, "Moderately dry"),  # -2 <  value <  -1
    (1.0, "Normal"),  # -1 <= value <=  1
    (2.0, "Moderately wet"),  #  1 <  value <   2
    (3.0, "Very wet"),  #  2 <= value <=  3
)

#: Dry categories, in increasing severity. Used to decide when to escalate an advisory.
PDSI_DRY_CATEGORIES: tuple[PdsiCategory, ...] = ("Moderately dry", "Very dry", "Extremely dry")


def pdsi_category(value: float) -> PdsiCategory:
    """Classify a self-calibrated Palmer Drought Severity Index value per Table 2."""
    v = float(value)
    if v < -3.0:
        return "Extremely dry"
    if v <= -2.0:
        return "Very dry"
    if v < -1.0:
        return "Moderately dry"
    if v <= 1.0:
        return "Normal"
    if v < 2.0:
        return "Moderately wet"
    if v <= 3.0:
        return "Very wet"
    return "Extremely wet"


def pdsi_is_drought(value: float) -> bool:
    """True when the index sits in any of the three dry bands."""
    return pdsi_category(value) in PDSI_DRY_CATEGORIES


__all__ = [
    "CITATION",
    "CLASSIFICATION_VERSION",
    "ENSO_BANDS",
    "ENSO_IS_EXTREME",
    "ENSO_PHASE",
    "PDSI_BANDS",
    "PDSI_DRY_CATEGORIES",
    "EnsoCategory",
    "PdsiCategory",
    "enso_category",
    "pdsi_category",
    "pdsi_is_drought",
]


# ---------------------------------------------------------------- forecast skill
#: A lead is only published as a probability when it beats climatology. The Brier Skill Score is
#: the test that matters here: AUC says the ranking is useful, but a farmer is told a *number*,
#: and BSS is what says that number is better calibrated than quoting the long-run average.
#:
#: The margin is deliberately above zero. A score that merely ties climatology has no business
#: being presented as a forecast, and sampling noise alone can push a worthless lead just over
#: the line.
MIN_SKILFUL_BSS = 0.02


def is_skilful(bss_vs_climatology: float | None) -> bool:
    """Whether a lead's probabilities may be published as a forecast."""
    return bss_vs_climatology is not None and bss_vs_climatology >= MIN_SKILFUL_BSS


def skilful_leads(metrics: list[dict]) -> list[int]:
    """The lead months that earned a probability, in order.

    Skill decays with lead time but is not guaranteed to do so monotonically on a short record,
    so each lead is judged on its own measurement rather than by truncating at the first failure.
    """
    return sorted(int(row["lead"]) for row in metrics if is_skilful(row.get("BSS_vs_climatology")))


def horizon_kind(lead: int, metrics: list[dict]) -> str:
    """``forecast`` where the lead is skilful, ``outlook`` where it is not.

    The distinction is the whole point: an outlook says which way the season is leaning, a
    forecast says how likely drought is. Presenting the second when only the first is supported
    is the failure this guards against.
    """
    return "forecast" if lead in set(skilful_leads(metrics)) else "outlook"
