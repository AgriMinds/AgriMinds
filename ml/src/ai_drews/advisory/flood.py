"""Waterlogging and flood warning from the wet side of the Palmer index.

The same water balance that detects drought detects its opposite. Sc-PDSI runs from
"Extremely dry" to "Extremely wet", and the study assigns both ends a job: dry bands drive the
drought warning, wet bands the flood warning. Until now only the dry half was ever shown, so the
index was doing half its work in silence.

One thing is stated plainly rather than implied. **This is a soil-water surplus, not a river
gauge.** Sc-PDSI says the profile is saturated and cannot absorb more — which is what causes
waterlogged roots, delayed field operations, lodging and fungal disease, and what makes runoff
and flash flooding more likely. It does not observe a river, so it cannot say a river will break
its banks. The wording throughout says what the index actually measured.

Crops differ on the wet side in a way they do not on the dry side: tef lodges in saturated soil
and maize tolerates short-term waterlogging better, which is the reverse of their drought
ranking. Reusing the drought sensitivities here would give exactly the wrong advice.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Literal

from ai_drews.advisory.classification import PdsiCategory, pdsi_category

FloodLevel = Literal["None", "Watch", "Warning", "Severe"]

#: Wet band -> warning level. The dry and normal bands raise nothing here; they are the drought
#: warning's business.
_LEVEL_BY_CATEGORY: dict[PdsiCategory, FloodLevel] = {
    "Moderately wet": "Watch",
    "Very wet": "Warning",
    "Extremely wet": "Severe",
}

#: Levels at which a farmer should act, in increasing order.
FLOOD_ACTIONABLE: tuple[FloodLevel, ...] = ("Watch", "Warning", "Severe")

RULES_VERSION = "flood-2026.10"


@dataclass(frozen=True)
class WaterloggingProfile:
    """How a crop behaves in saturated soil, which is not how it behaves in drought."""

    tolerance: Literal["low", "moderate"]
    note: str
    drainage: str
    timing: str


#: Placeholders to be replaced with Central Statistical Agency figures and co-validated with
#: agronomists, exactly as the drought sensitivities are. The ranking is the defensible part.
CROP_WATERLOGGING: dict[str, WaterloggingProfile] = {
    "tef": WaterloggingProfile(
        tolerance="low",
        note="Shallow-rooted and prone to lodging once soil is saturated; standing water on flat "
        "plots is the main risk to yield.",
        drainage="Open furrows along the slope and clear field outlets before the next heavy rain.",
        timing="Delay sowing until the surface drains; waterlogged seedbeds give patchy "
        "establishment that cannot be recovered later.",
    ),
    "wheat": WaterloggingProfile(
        tolerance="low",
        note="Waterlogging at tillering and heading causes root death and raises rust pressure.",
        drainage="Cut drainage furrows between beds; avoid compacting wet soil with machinery.",
        timing="Hold off top-dressing nitrogen until the profile drains, or it will be leached away.",
    ),
    "maize": WaterloggingProfile(
        tolerance="moderate",
        note="Tolerates short-term saturation better than the small cereals, but loses nitrogen "
        "quickly and lodges in wind once roots are in soft soil.",
        drainage="Ensure furrows drain freely; ridge up to lift roots clear of standing water.",
        timing="Split the nitrogen application so the remainder is not lost to leaching.",
    ),
}


@dataclass(frozen=True)
class FloodAdvisory:
    """What the wet side of the index means for one plot."""

    crop: str
    pdsi: float
    pdsi_category: PdsiCategory
    level: FloodLevel
    headline: str
    drainage_action: str
    timing_action: str
    disease_watch: str
    crop_note: str
    basis: str
    rules_version: str = RULES_VERSION

    @property
    def is_actionable(self) -> bool:
        return self.level in FLOOD_ACTIONABLE

    def to_dict(self) -> dict:
        return asdict(self)


def flood_level(pdsi: float) -> FloodLevel:
    """Warning level from a Sc-PDSI value. Dry and normal conditions raise nothing."""
    return _LEVEL_BY_CATEGORY.get(pdsi_category(pdsi), "None")


def is_flood_risk(pdsi: float) -> bool:
    return flood_level(pdsi) in FLOOD_ACTIONABLE


_HEADLINE: dict[FloodLevel, str] = {
    "None": "No waterlogging expected.",
    "Watch": "Soils are wetter than normal. Check that your fields drain.",
    "Warning": "Soils are saturated. Waterlogging is likely on flat and low-lying plots.",
    "Severe": "Soils cannot absorb more water. Expect standing water, runoff and damage to roots.",
}

_DISEASE: dict[FloodLevel, str] = {
    "None": "No raised disease pressure from soil moisture.",
    "Watch": "Watch for early signs of fungal disease; humid, wet conditions favour it.",
    "Warning": "Fungal disease and rust pressure is high. Inspect weekly and treat early.",
    "Severe": "Disease pressure is high and root rot is likely where water stands for days.",
}


def assess_flood(pdsi: float, crop: str, *, target_month: int | None = None) -> FloodAdvisory:
    """Build the flood advisory for one plot from its Sc-PDSI value.

    ``target_month`` only sharpens the wording; the level comes from the index alone, so a
    deployment without a target month still gets the same warning.
    """
    if crop not in CROP_WATERLOGGING:
        raise ValueError(f"unknown crop {crop!r}; expected one of {sorted(CROP_WATERLOGGING)}")

    profile = CROP_WATERLOGGING[crop]
    category = pdsi_category(pdsi)
    level = flood_level(pdsi)
    kiremt = target_month in (6, 7, 8, 9)
    season_note = (
        " This falls in Kiremt, when the heaviest rain of the year arrives on already wet soil."
        if kiremt and level in FLOOD_ACTIONABLE
        else ""
    )

    return FloodAdvisory(
        crop=crop,
        pdsi=round(float(pdsi), 2),
        pdsi_category=category,
        level=level,
        headline=_HEADLINE[level] + season_note,
        drainage_action=profile.drainage if level in FLOOD_ACTIONABLE else "No action needed.",
        timing_action=profile.timing if level in FLOOD_ACTIONABLE else "No change to your plans.",
        disease_watch=_DISEASE[level],
        crop_note=profile.note,
        basis=(
            f"Sc-PDSI is {pdsi:+.2f}, which is '{category}'. The index measures how much water "
            "the soil profile is holding against what it can hold, so this is waterlogging — "
            "it is not a reading from a river gauge."
        ),
    )
