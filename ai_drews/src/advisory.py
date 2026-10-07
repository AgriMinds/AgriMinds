"""STEP 6 (Month 5, Objective 3): rule-based decision support.
THE RULES BELOW ARE PLACEHOLDERS: replace/tune them with farmers, extension officers and agronomists."""
LEVELS = [(0.25, "Low"), (0.45, "Moderate"), (0.65, "High"), (1.01, "Severe")]
CROPS = {   # drought sensitivity (placeholder, co-validate)
    "tef": dict(sens=0.8, note="short cycle, tolerates late planting"),
    "wheat": dict(sens=1.0, note="moderately sensitive at tillering and grain fill"),
    "maize": dict(sens=1.3, note="most sensitive at tasselling/silking"),
}


def risk_level(p):
    return next(name for cut, name in LEVELS if p < cut)


def enso_state(nino34):
    return "El Nino" if nino34 >= 0.5 else "La Nina" if nino34 <= -0.5 else "Neutral"


def advise(p, lead, crop, month, nino34=0.0, iek_agrees=None):
    """p: drought probability for the chosen cell/lead; month: forecast target month (1-12)."""
    c = CROPS[crop]; adj = min(p * c["sens"], 1.0); level = risk_level(adj)
    season = "Kiremt (Jun-Sep)" if 6 <= month <= 9 else "Belg (Feb-May)" if 2 <= month <= 5 else "off-season"
    A = {
        "Low": dict(crop="Keep the planned crop and variety.", planting="Plant at the normal onset of rains.",
                    water="No extra irrigation expected; maintain mulching.", prep="Routine monitoring."),
        "Moderate": dict(crop=f"Prefer early-maturing varieties of {crop}.", planting="Plant at onset; avoid late sowing.",
                         water="Prepare water harvesting and supplementary irrigation for dry spells.", prep="Check forecasts monthly."),
        "High": dict(crop=("Consider switching to tef or sorghum." if crop == "maize" else f"Use drought-tolerant {crop} seed."),
                     planting="Stagger planting dates; sow after reliable rains.",
                     water="Schedule deficit irrigation at critical growth stages.", prep="Secure fodder/grain reserves; alert extension office."),
        "Severe": dict(crop="Switch to short-cycle, drought-tolerant crops (e.g. tef) where possible.",
                       planting="Delay sowing until soil moisture is adequate; reduce area.",
                       water="Prioritise limited water for the most valuable plots.", prep="Activate drought-preparedness plan; seek early-warning support."),
    }[level]
    conf = {None: "No local indicator entered.",
            True: "Traditional (IEK) indicators agree with the model: higher confidence.",
            False: "Traditional indicators disagree: treat as uncertain and consult the extension officer."}[iek_agrees]
    return dict(level=level, adjusted_prob=round(float(adj), 2), season=season, enso=enso_state(nino34),
                crop_note=c["note"], iek=conf, **A)
