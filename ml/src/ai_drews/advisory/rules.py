"""Objective 3: rule-based agro-ecological decision support.

This module is the SINGLE source of truth for risk thresholds, ENSO phase classification,
Ethiopian season names and crop sensitivities. The API, the research dashboard and the clients
all derive their behaviour from here. It deliberately has no torch/scipy dependency.

THE RULES BELOW ARE PLACEHOLDERS to be co-designed and validated with farmers, development
agents and agronomists. Bump RULES_VERSION whenever a threshold or recommendation changes.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Literal

RULES_VERSION = "2026.10-draft"

Crop = Literal["tef", "wheat", "maize"]
RiskLevel = Literal["Low", "Moderate", "High", "Severe"]
IekSignal = (
    bool | None
)  # True = traditional indicators agree (dry signs), False = disagree, None = not entered

# Upper probability bound (exclusive) for each level, in ascending order.
RISK_LEVELS: tuple[tuple[float, RiskLevel], ...] = (
    (0.25, "Low"),
    (0.45, "Moderate"),
    (0.65, "High"),
    (1.01, "Severe"),
)

EL_NINO_THRESHOLD = 0.5  # degC Nino3.4 anomaly
LA_NINA_THRESHOLD = -0.5


@dataclass(frozen=True)
class CropProfile:
    sensitivity: float  # drought-probability multiplier (placeholder, co-validate)
    note: str
    optimal_sowing: str
    deficit_irrigation: str


CROPS: dict[str, CropProfile] = {
    "tef": CropProfile(
        sensitivity=0.8,
        note="Short growing cycle, highly versatile, tolerates moderate late planting in Ethiopian highlands.",
        optimal_sowing="Early to mid-July for main season (Meher/Kiremt).",
        deficit_irrigation="Tolerant; prioritise supplemental water during panicle emergence if a dry spell exceeds 14 days.",
    ),
    "wheat": CropProfile(
        sensitivity=1.0,
        note="Moderately sensitive to water stress, especially during tillering, heading and grain fill.",
        optimal_sowing="Mid-June to early July; staggered planting mitigates mid-season moisture deficits.",
        deficit_irrigation="Critical irrigation needed at crown-root initiation and flowering.",
    ),
    "maize": CropProfile(
        sensitivity=1.3,
        note="Highly sensitive to drought during tasselling and silking; moisture deficits cause severe yield loss.",
        optimal_sowing="Late April to mid-May for long-cycle varieties; use early-maturing varieties if Belg rains are erratic.",
        deficit_irrigation="High water requirement; schedule deficit irrigation during flowering and early grain fill.",
    ),
}


def risk_level(p: float) -> RiskLevel:
    for cut, name in RISK_LEVELS:
        if p < cut:
            return name
    return "Severe"


def enso_state(nino34: float) -> str:
    if nino34 >= EL_NINO_THRESHOLD:
        return "El Niño"
    if nino34 <= LA_NINA_THRESHOLD:
        return "La Niña"
    return "Neutral"


def season_name(month: int) -> str:
    if 6 <= month <= 9:
        return "Kiremt (Main Rainy Season / Meher)"
    if 2 <= month <= 5:
        return "Belg (Short Rainy Season)"
    return "Bega (Dry / Off-Season)"


@dataclass(frozen=True)
class Advisory:
    crop: str
    lead_month: int
    raw_probability: float
    adjusted_probability: float
    risk_level: RiskLevel
    season: str
    enso_state: str
    crop_note: str
    crop_recommendation: str
    planting_window: str
    water_management: str
    preparedness_action: str
    iek_assessment: str
    confidence_level: str
    rules_version: str = RULES_VERSION

    def to_dict(self) -> dict:
        return asdict(self)


def _actions(level: RiskLevel, crop: str, profile: CropProfile) -> dict[str, str]:
    if level == "Low":
        return dict(
            crop=f"Proceed with the planned certified seed variety of {crop}. Normal agronomic packages apply.",
            planting=f"Plant at normal rain onset. {profile.optimal_sowing}",
            water=f"Standard rainwater retention (contour ploughing, mulching). {profile.deficit_irrigation}",
            prep="Standard input distribution and routine agro-meteorological monitoring through development agents.",
        )
    if level == "Moderate":
        return dict(
            crop=f"Prioritise early-maturing, drought-escaping varieties of {crop}. Consider seed priming.",
            planting="Plant promptly at onset; avoid delayed sowing to escape late-season dry spells.",
            water="Prepare micro-catchments, in-situ water harvesting and supplementary irrigation channels.",
            prep="Monitor dekadal (10-day) agro-meteorological bulletins and coordinate with kebele extension officers.",
        )
    if level == "High":
        return dict(
            crop=(
                "Switch to a drought-tolerant crop: replace maize with tef or sorghum if the moisture deficit persists."
                if crop == "maize"
                else f"Use verified drought-tolerant {crop} varieties (e.g. Quncho / Boset for tef)."
            ),
            planting="Stagger planting across plots; delay until reliable soil-profile moisture (>25 mm cumulative rain).",
            water="Activate a deficit-irrigation schedule focused on critical vegetative and flowering stages.",
            prep="Secure livestock fodder reserves, alert the zonal disaster-prevention taskforce, start community grain banking.",
        )
    return dict(
        crop="Emergency crop switching: pivot to ultra-short-cycle crops, pulses or drought-hardy tef. Minimise maize area.",
        planting="Postpone sowing until sustained moisture recharge; scale down cultivated area on vulnerable slopes.",
        water="Reserve and ration accessible water exclusively for high-value homestead and nursery plots.",
        prep="Trigger drought-preparedness protocols, mobilise safety-net relief and coordinate seed restocking.",
    )


_IEK_TEXT = {
    None: "No traditional indicator submitted. Advisory is based on the climate model alone.",
    True: "Traditional indicators (winds, bird migration cues, flowering patterns) agree with the model forecast: HIGH CONSENSUS.",
    False: "Traditional indicators diverge from the model forecast: MEDIUM CONFIDENCE. Consult development agents for local ground truth.",
}
_CONFIDENCE = {
    None: "STANDARD (Model Driven)",
    True: "HIGH (Model + Traditional Knowledge Consensus)",
    False: "MODERATE (Divergent Signals)",
}


def advise(
    p: float,
    lead_month: int,
    crop: str,
    target_month: int,
    nino34: float = 0.0,
    iek_agrees: IekSignal = None,
) -> Advisory:
    """p: drought probability for the chosen cell/lead; target_month: forecast target month (1-12)."""
    if crop not in CROPS:
        raise ValueError(f"unknown crop {crop!r}; expected one of {sorted(CROPS)}")
    profile = CROPS[crop]
    adjusted = min(float(p) * profile.sensitivity, 1.0)
    level = risk_level(adjusted)
    actions = _actions(level, crop, profile)
    return Advisory(
        crop=crop,
        lead_month=lead_month,
        raw_probability=round(float(p), 3),
        adjusted_probability=round(adjusted, 3),
        risk_level=level,
        season=season_name(target_month),
        enso_state=enso_state(nino34),
        crop_note=profile.note,
        crop_recommendation=actions["crop"],
        planting_window=actions["planting"],
        water_management=actions["water"],
        preparedness_action=actions["prep"],
        iek_assessment=_IEK_TEXT[iek_agrees],
        confidence_level=_CONFIDENCE[iek_agrees],
    )
