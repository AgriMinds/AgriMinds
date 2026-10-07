from typing import Optional, Tuple
from app.schemas.advisory import AdvisoryRequest, AdvisoryResponse

LEVELS = [(0.25, "Low"), (0.45, "Moderate"), (0.65, "High"), (1.01, "Severe")]

CROPS = {
    "tef": {
        "sens": 0.8,
        "note": "Short growing cycle, highly versatile, tolerates moderate late planting in Ethiopian highlands.",
        "optimal_sowing": "Early to mid-July for main season (Meher/Kiremt).",
        "deficit_irrigation": "Tolerant; prioritize supplemental water during panicle emergence if dry spell exceeds 14 days."
    },
    "wheat": {
        "sens": 1.0,
        "note": "Moderately sensitive to water stress, especially during tillering, heading, and grain fill stages.",
        "optimal_sowing": "Mid-June to early July; staggered planting mitigates mid-season moisture deficits.",
        "deficit_irrigation": "Critical irrigation needed at crown root initiation and flowering stages."
    },
    "maize": {
        "sens": 1.3,
        "note": "Highly sensitive to drought stress during tasselling and silking. Moisture deficits cause severe yield reduction.",
        "optimal_sowing": "Late April to mid-May for long-cycle varieties; shift to early-maturing varieties if Belg rains are erratic.",
        "deficit_irrigation": "High water requirement; schedule deficit irrigation during flowering and early grain development."
    }
}

def determine_risk_level(prob: float) -> str:
    for cut, name in LEVELS:
        if prob < cut:
            return name
    return "Severe"

def determine_enso_state(nino34: float) -> str:
    if nino34 >= 0.5:
        return "El Niño"
    elif nino34 <= -0.5:
        return "La Niña"
    return "Neutral"

def get_season_name(month: int) -> str:
    if 6 <= month <= 9:
        return "Kiremt (Main Rainy Season / Meher)"
    elif 2 <= month <= 5:
        return "Belg (Short Rainy Season)"
    return "Bega (Dry / Off-Season)"

class AdvisoryService:
    @staticmethod
    def generate_advisory(req: AdvisoryRequest, raw_prob: float, nino34: float = 0.0, target_month: int = 7) -> AdvisoryResponse:
        crop_info = CROPS.get(req.crop, CROPS["tef"])
        adj_prob = min(raw_prob * crop_info["sens"], 1.0)
        level = determine_risk_level(adj_prob)
        season = get_season_name(target_month)
        enso = determine_enso_state(nino34)

        actions = {
            "Low": {
                "crop": f"Proceed with planned certified seed variety of {req.crop}. Normal agronomic packages apply.",
                "planting": f"Plant at normal rain onset. {crop_info['optimal_sowing']}",
                "water": f"Standard rainwater retention techniques (contour plowing, mulching). {crop_info['deficit_irrigation']}",
                "prep": "Standard input distribution and routine meteorological monitoring through local development agents."
            },
            "Moderate": {
                "crop": f"Prioritize early-maturing, drought-escaping varieties of {req.crop}. Consider seed priming.",
                "planting": "Plant promptly at onset; avoid delayed sowing to escape late-season dry spells.",
                "water": "Prepare micro-catchments, in-situ water harvesting, and prepare supplementary irrigation canals.",
                "prep": "Monitor 10-day dekadal agro-meteorological bulletins and coordinate with kebele extension officers."
            },
            "High": {
                "crop": "Switch to drought-tolerant crop: replace maize with tef or sorghum if moisture deficit persists." if req.crop == "maize" else f"Utilize verified drought-tolerant {req.crop} varieties (e.g., Quncho/Boset for tef).",
                "planting": "Stagger planting dates across field plots; delay till reliable soil profile moisture (>25mm cumulative rain).",
                "water": "Activate deficit irrigation schedule focused strictly on critical vegetative/flowering growth stages.",
                "prep": "Secure livestock fodder reserves, alert zonal disaster prevention taskforce, and establish community grain banking."
            },
            "Severe": {
                "crop": "Emergency crop switching: pivot immediately to ultra-short cycle crops, pulses, or drought-hardy tef. Minimize maize area.",
                "planting": "Postpone sowing until sustained moisture recharge; scale down cultivated acreage on vulnerable slope terrains.",
                "water": "Reserve and ration all accessible water sources exclusively for high-value homestead nursery plots.",
                "prep": "Trigger municipal drought-preparedness protocols, mobilize safety-net relief programs, and coordinate seed restocking."
            }
        }[level]

        iek_text = {
            None: "No traditional indicator submitted. Advisory calibrated entirely via CNN-LSTM-Fourier climate telemetry.",
            True: "Traditional indigenous indicators (winds, bird migratory cues, flowering patterns) corroborate AI model forecasts: HIGH CONSENSUS.",
            False: "Indigenous indicators diverge from satellite/AI forecast: MEDIUM CONFIDENCE. Consult regional development agents for localized ground-truth."
        }[req.iek_agrees]

        confidence = "HIGH (Model + Traditional Knowledge Consensus)" if req.iek_agrees is True else ("MODERATE (Divergent Signals)" if req.iek_agrees is False else "STANDARD (Model Driven)")

        return AdvisoryResponse(
            crop=req.crop,
            lead_month=req.lead_month,
            raw_probability=round(float(raw_prob), 3),
            adjusted_probability=round(float(adj_prob), 3),
            risk_level=level,
            season=season,
            enso_state=enso,
            crop_note=crop_info["note"],
            crop_recommendation=actions["crop"],
            planting_window=actions["planting"],
            water_management=actions["water"],
            preparedness_action=actions["prep"],
            iek_assessment=iek_text,
            confidence_level=confidence
        )
