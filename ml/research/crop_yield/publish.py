"""Publish the retrained crop-yield model where the API can load it.

Training writes into this directory, as upstream does. Serving reads from the shared data root
(``AI_DREWS_DATA_DIR``, default ``./data``), the same place the drought weights live. This step
copies the artifact there and writes the metadata beside it:

    data/models/crop_yield_model.joblib
    data/models/crop_yield_meta.json

The metadata is what makes the model servable without shipping the training panel. It carries
provenance (which spreadsheet, which commit, when), the holdout metrics for every candidate, the
zone altitudes, the gain-weighted feature importance, and -- the part the API cannot work without
-- the end of each crop-zone series, because `yield_lag1` and `yield_rolling3_mean` are features
and a request for next season has to supply them from the observed record.
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
from datetime import UTC, datetime
from pathlib import Path

import joblib
import pandas as pd

from ai_drews.config import DataPaths
from ai_drews.crop_yield import (
    CROP_LABELS,
    CROP_NAMES,
    ENSO_IMPACT_METHOD,
    ZONE_LOCAL_NAMES,
    enso_impact_table,
)

BASE_DIR = Path(__file__).resolve().parent

MODEL_VERSION = "crop-yield-0.2.0"
UPSTREAM_REPO = "aykgeh/Chokye_Water_Shield"
UPSTREAM_REVISION = "d0584f78f653159e1ca9d9d306506947dada5674"

#: Altitude bands as `preprocess.py` assigns them (the Ethiopian agro-ecological belts).
ZONE_ALTITUDES = {
    "Lowland": (1000, 500, 1500),
    "Midland": (2000, 1500, 2500),
    "Highland": (2800, 2500, 3500),
}


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def _feature_importance(pipeline) -> list[list]:
    """Gain-weighted importance for a tree model, absolute standardised coefficient otherwise."""
    prep = pipeline.named_steps.get("prep")
    reg = pipeline.named_steps.get("reg")
    if prep is None or reg is None:
        return []
    names = list(prep.get_feature_names_out())
    weights = getattr(reg, "feature_importances_", None)
    if weights is None:
        coef = getattr(reg, "coef_", None)
        if coef is None:
            return []
        weights = [abs(float(c)) for c in coef]
        total = sum(weights) or 1.0
        weights = [w / total for w in weights]
    pairs = sorted(zip(names, (float(w) for w in weights), strict=True), key=lambda kv: -kv[1])
    return [[n.split("__", 1)[-1], round(w, 4)] for n, w in pairs]


def _series_tail(df: pd.DataFrame) -> dict[str, dict[str, float]]:
    """End of each crop-zone series: the lag features a next-season request needs.

    `yield_rolling3_mean` at row t is the mean of the three preceding yields, so for the season
    after the record it is the mean of the last three observed years. ``last3`` carries those
    three values, because a projection that steps several seasons forward has to roll the window
    itself rather than hold one precomputed mean.
    """
    out: dict[str, dict[str, float]] = {}
    for (crop, zone), g in df.groupby(["crop", "zone"], sort=False):
        s = g.sort_values("year")["yield"]
        out[f"{crop}|{zone}"] = {
            "last_observed_yield": round(float(s.iloc[-1]), 3),
            "yield_lag1": round(float(s.iloc[-1]), 3),
            "yield_rolling3_mean": round(float(s.tail(3).mean()), 3),
            "last3": [round(float(v), 3) for v in s.tail(3)],
        }
    return out


def _history(df: pd.DataFrame) -> dict:
    """The observed record as belt averages, so a client can draw it without the panel.

    Each crop's value for a year is the mean of its three altitude belts, which is what the
    spreadsheet's own `* avg` columns hold and what the published figures plot.
    """
    years = sorted(int(y) for y in df["year"].unique())
    belt_avg = df.groupby(["year", "crop"])["yield"].mean().unstack()
    per_crop = {
        CROP_NAMES[label]: [round(float(belt_avg.loc[y, label]), 3) for y in years]
        for label in belt_avg.columns
    }
    enso = df.groupby("year")["enso_index"].first()
    return {
        "years": years,
        "belt_average_yield_q_ha": per_crop,
        "crop_average_q_ha": [round(float(belt_avg.loc[y].mean()), 3) for y in years],
        "enso_index": [round(float(enso.loc[y]), 4) for y in years],
    }


def _enso_annual_reference() -> dict:
    """Niño 3.4 annual means from the seasonal source, which reaches past the crop record.

    The crop panel stops at 2023; this reference runs to 2026, so the ENSO panel of a timeline
    chart can show observation where there is observation instead of projecting over it.
    """
    path = BASE_DIR / "data" / "nino34_seasonal_reference.csv"
    if not path.exists():
        return {"years": [], "nino34": [], "source": None}
    ref = pd.read_csv(path)
    annual = ref[["djf", "mam", "jja", "son"]].mean(axis=1).round(4)
    return {
        "years": [int(y) for y in ref["year"]],
        "nino34": [round(float(v), 4) for v in annual],
        "source": "nino34_seasonal_reference.csv (mean of DJF/MAM/JJA/SON)",
    }


def _caveats(selected: dict[str, float], importance: list[list], n_test: int, mean_yield: float) -> list[str]:
    top = importance[0] if importance else ["unknown", 0.0]
    lag_share = sum(w for name, w in importance if name.startswith("yield_"))
    enso_share = sum(w for name, w in importance if name.startswith("enso"))
    rmse = selected.get("test_rmse", float("nan"))
    return [
        (
            f"The lag features carry {lag_share:.0%} of the model's gain ({top[0]} alone {top[1]:.0%}) "
            f"and the ENSO features {enso_share:.1%}. This is a persistence estimate nudged by "
            "climate, not evidence of an ENSO response."
        ),
        (
            f"Holdout RMSE is {rmse:.2f} q/ha on {n_test} observations against a mean yield of "
            f"{mean_yield:.1f} q/ha, so a single crop-zone figure is planning-grade, not a guarantee."
        ),
        (
            "Yields are zone-wide averages from a 34-year spreadsheet, not plot-level measurements: "
            "they describe an altitude belt, never one farm."
        ),
    ]


def _enso_impact(df: pd.DataFrame) -> dict:
    """What El Niño years did to each crop-zone series, measured once and carried in the metadata.

    This is a property of the *record*, not of the regressor: it answers "what happened in El
    Niño years" rather than "what will the model predict", and the two are reported separately
    because they are different claims.
    """
    cells = [
        {
            "crop": e.crop,
            "zone": e.zone,
            "effect_pct": e.effect_pct,
            "p_value": e.p_value,
            "n_el_nino": e.n_el_nino,
            "n_other": e.n_other,
        }
        for e in enso_impact_table(df)
    ]
    el_nino_years = sorted(df.loc[df["enso_phase"] == "El Nino", "year"].unique().tolist())
    return {
        "method": ENSO_IMPACT_METHOD,
        "el_nino_years": [int(y) for y in el_nino_years],
        "cells": cells,
    }


def publish(
    data_dir: str | os.PathLike[str] | None = None,
    *,
    run_dir: str | os.PathLike[str] | None = None,
    panel_file: str | os.PathLike[str] | None = None,
    corrections: list[dict] | None = None,
) -> Path:
    """Copy a trained artifact to the shared data root with its metadata.

    ``run_dir``/``panel_file`` default to the upstream-comparable run. The corrected run passes
    its own, and ``corrections`` records what the verified panel changed, so a served number can
    be traced to the data it was fitted on.
    """
    run_dir = Path(run_dir) if run_dir is not None else BASE_DIR
    model_file = run_dir / "models" / "best_crop_yield_model.joblib"
    metrics_file = run_dir / "models" / "metrics_summary.json"
    panel_file = Path(panel_file) if panel_file is not None else BASE_DIR / "data" / "crop_climate_clean.csv"
    excel_file = BASE_DIR / "data" / "climate-crop-v2.xlsx"
    for f in (model_file, metrics_file, panel_file):
        if not f.exists():
            raise FileNotFoundError(f"{f} is missing; run run_training.py first")

    artifact = joblib.load(model_file)
    df = pd.read_csv(panel_file)
    metrics = json.loads(metrics_file.read_text())
    selected = dict(artifact["metrics"])
    importance = _feature_importance(artifact["pipeline"])

    last_year = int(df["year"].max())
    last_row = df[df["year"] == last_year].iloc[0]
    test = df[df["year"] > 2016]

    meta = {
        "model_name": artifact["model_name"],
        "model_version": MODEL_VERSION,
        "trained_at": datetime.now(UTC).replace(microsecond=0).isoformat(),
        "upstream": {"repo": UPSTREAM_REPO, "revision": UPSTREAM_REVISION},
        "data_corrections": corrections or [],
        "dataset": {
            "file": excel_file.name,
            "sha256": _sha256(excel_file) if excel_file.exists() else None,
            "panel": panel_file.name,
            "rows": int(len(df)),
            "first_year": int(df["year"].min()),
            "last_year": last_year,
            "train_years": [int(df.loc[df["year"] <= 2016, "year"].min()), 2016],
            "test_years": [int(test["year"].min()), int(test["year"].max())],
            "test_rows": int(len(test)),
            "mean_yield_q_ha": round(float(df["yield"].mean()), 3),
        },
        "feature_cols": list(artifact["feature_cols"]),
        "metrics": metrics,
        "selected_metrics": selected,
        "feature_importance": importance,
        "zones": [
            {
                "zone": zone,
                "local_name": ZONE_LOCAL_NAMES[zone],
                "altitude_approx_m": approx,
                "altitude_min_m": low,
                "altitude_max_m": high,
            }
            for zone, (approx, low, high) in ZONE_ALTITUDES.items()
        ],
        "crops": [{"crop": name, "label": label} for name, label in CROP_LABELS.items()],
        "baseline": {
            "year": last_year,
            "temperature_c": round(float(last_row["temperature_c"]), 4),
            "precipitation_mm": round(float(last_row["precipitation_mm"]), 4),
            "enso_index": round(float(last_row["enso_index"]), 4),
            "series": _series_tail(df),
        },
        "history": _history(df),
        "enso_annual_reference": _enso_annual_reference(),
        "enso_impact": _enso_impact(df),
        "caveats": _caveats(selected, importance, int(len(test)), float(df["yield"].mean())),
    }

    paths = DataPaths.from_env(data_dir).ensure()
    shutil.copy2(model_file, paths.crop_yield_model_joblib)
    paths.crop_yield_meta_json.write_text(json.dumps(meta, indent=2) + "\n")
    print(f"Published {artifact['model_name']} -> {paths.crop_yield_model_joblib}")
    print(f"           metadata -> {paths.crop_yield_meta_json}")
    return paths.crop_yield_model_joblib


if __name__ == "__main__":
    import sys

    publish(sys.argv[1] if len(sys.argv) > 1 else None)
