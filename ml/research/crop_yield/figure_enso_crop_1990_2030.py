"""Two-panel figure: crop yields over Niño 3.4, 1990-2030.

Top panel    observed belt-average yields for tef, wheat and maize (1990-2023, the
             `climate-crop (2).xlsx` record), then the published crop-yield regressor run
             recursively to 2030 under three ENSO scenarios.
Bottom panel observed Niño 3.4 annual means from NOAA (1990-2026), then the same three
             scenarios held flat to 2030.

Why scenarios and not a forecast
--------------------------------
`data/outputs/enso_metrics.csv` measures this project's CNN-LSTM against persistence at every
lead. It loses at all twelve, and its correlation with the truth turns negative past lead 7.
Nothing here forecasts Niño 3.4 beyond about six months, so the years after the observed record
are drawn as three *assumed* ENSO states, not as a prediction. The shaded span marks where
observation stops.

The crop projection inherits a second limit: `yield_lag1` carries 53% of the regressor's gain,
so feeding predictions back in makes each year lean on the one before it. Seven steps of that
converge on a level, which is what the flat tails in the top panel are.

Run:  python ml/research/crop_yield/figure_enso_crop_1990_2030.py
Out:  data/outputs/enso_crop_outlook_1990_2030.{png,csv}
"""

from __future__ import annotations

import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.lines import Line2D

REPO = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO / "ml" / "src"))

from ai_drews.config import DataPaths  # noqa: E402
from ai_drews.crop_yield import CropYieldInputs, enso_phase, load_crop_yield_model  # noqa: E402

SHEET = REPO / "ml" / "research" / "crop_yield" / "data" / "climate-crop-v2.xlsx"
NOAA = REPO / "data" / "raw" / "sources" / "nino34.csv"
OUT = REPO / "data" / "outputs"

LAST_OBSERVED_CROP_YEAR = 2023
HORIZON = 2030

#: ENSO states assumed after the observed record. Values are Niño 3.4 anomalies in °C, chosen at
#: the centre of each of the study's phase bands (|index| >= 0.5 is a phase, below it is Neutral).
SCENARIOS = {
    "El Nino": (+1.0, "#d62728"),
    "Neutral": (0.0, "#555555"),
    "La Nina": (-1.0, "#1f77b4"),
}

CROPS = {
    "tef": {
        "sheet_avg": "teff avg",
        "belts": ("teff kola", "teff w/d", "teff dega"),
        "colour": "#d62728",
        "marker": "*",
        "label": "Tef",
    },
    "wheat": {
        "sheet_avg": "wheat avg",
        "belts": ("wheat kola", "wheat w/d", "wheat dega"),
        "colour": "#2ca02c",
        "marker": "^",
        "label": "Wheat",
    },
    "maize": {
        "sheet_avg": "maiz avg",
        "belts": ("maiz kola", "maiz w/d", "maiz dega"),
        "colour": "#1f77b4",
        "marker": "o",
        "label": "Maize",
    },
}
ZONES = ("Lowland", "Midland", "Highland")


def observed_crops() -> pd.DataFrame:
    x = pd.read_excel(SHEET).set_index("Year")
    return x


def observed_nino() -> pd.Series:
    n = pd.read_csv(NOAA, parse_dates=["date"])
    n = n.dropna(subset=["nino34"])
    n["year"] = n.date.dt.year
    annual = n.groupby("year")["nino34"].mean()
    months = n.groupby("year")["nino34"].size()
    return annual, months


def project(model, sheet: pd.DataFrame, enso_by_year: dict[int, float]) -> pd.DataFrame:
    """Run the regressor forward to HORIZON for every crop-belt series.

    ``enso_by_year`` carries the observed Niño 3.4 annual mean for the years NOAA has already
    measured, and the assumed scenario value for the years after that.
    """
    temp, precip, _ = model.baseline_climate
    rows = []
    for crop, spec in CROPS.items():
        for belt_col, zone in zip(spec["belts"], ZONES, strict=True):
            series = sheet[belt_col].astype(float)
            history = list(series.loc[:LAST_OBSERVED_CROP_YEAR].values)
            for year in range(LAST_OBSERVED_CROP_YEAR + 1, HORIZON + 1):
                index = enso_by_year[year]
                inputs = CropYieldInputs(
                    crop=crop,
                    zone=zone,
                    year=year,
                    temperature_c=temp,
                    precipitation_mm=precip,
                    enso_index=index,
                    enso_phase=enso_phase(index),
                    yield_lag1=history[-1],
                    yield_rolling3_mean=float(np.mean(history[-3:])),
                )
                hat = model.predict(inputs)
                rows.append({"year": year, "crop": crop, "zone": zone, "yield": hat})
                history.append(hat)
    out = pd.DataFrame(rows)
    return out.groupby(["year", "crop"])["yield"].mean().unstack()


def main() -> int:
    model = load_crop_yield_model(DataPaths.from_env(REPO / "data"))
    sheet = observed_crops()
    nino, nino_months = observed_nino()
    last_nino_year = int(nino.index.max())
    partial = int(nino_months.loc[last_nino_year]) < 12

    enso_maps = {}
    for name, (value, _) in SCENARIOS.items():
        enso_maps[name] = {
            year: (float(nino.loc[year]) if year <= last_nino_year else value)
            for year in range(LAST_OBSERVED_CROP_YEAR + 1, HORIZON + 1)
        }
    projections = {name: project(model, sheet, enso_maps[name]) for name in SCENARIOS}
    #: years whose ENSO was observed, so every scenario gives the same yield there
    shared_until = min(last_nino_year, HORIZON)

    tidy = []
    for name, frame in projections.items():
        f = frame.reset_index().melt(id_vars="year", var_name="crop", value_name="yield_q_ha")
        f["scenario"] = name
        f["enso_index"] = f.year.map(enso_maps[name])
        f["enso_basis"] = np.where(f.year <= shared_until, "observed", "assumed")
        tidy.append(f)
    tidy = pd.concat(tidy, ignore_index=True)
    OUT.mkdir(parents=True, exist_ok=True)
    tidy.to_csv(OUT / "enso_crop_outlook_1990_2030.csv", index=False)

    fig, (ax_crop, ax_nino) = plt.subplots(
        2,
        1,
        figsize=(13, 9),
        height_ratios=[2.05, 1],
        sharex=True,
        gridspec_kw={"hspace": 0.13},
    )

    split = LAST_OBSERVED_CROP_YEAR
    ax_crop.axvspan(split, shared_until, color="#f4f4f4", zorder=0)
    for ax in (ax_crop, ax_nino):
        ax.axvspan(shared_until, HORIZON + 0.6, color="#e6e6e6", zorder=0)
        ax.axvline(shared_until, color="#999999", linewidth=1.1, linestyle="-", zorder=1)
    ax_crop.axvline(split, color="#bbbbbb", linewidth=1.0, linestyle=":", zorder=1)

    years_obs = sheet.index.values
    for spec in CROPS.values():
        ax_crop.plot(
            years_obs,
            sheet[spec["sheet_avg"]].values,
            color=spec["colour"],
            marker=spec["marker"],
            markersize=6,
            markerfacecolor="#ffe44d",
            markeredgecolor=spec["colour"],
            linewidth=1.5,
            label=f"{spec['label']} (observed)",
            zorder=3,
        )
    ax_crop.plot(
        years_obs,
        sheet["crop avg"].values,
        color="black",
        marker="x",
        markersize=5,
        linewidth=1.2,
        linestyle="--",
        label="Crop average (observed)",
        zorder=3,
    )

    spreads: dict[str, float] = {}
    for crop, spec in CROPS.items():
        anchor_y = float(sheet[spec["sheet_avg"]].loc[split])
        known = projections["Neutral"].loc[:shared_until, crop]
        ax_crop.plot(
            np.concatenate(([split], known.index.values)),
            np.concatenate(([anchor_y], known.values)),
            color=spec["colour"],
            linewidth=2.0,
            linestyle=(0, (4, 1.6)),
            zorder=3,
        )
        fan = projections["Neutral"].loc[shared_until:].index.values
        yr = np.concatenate(([shared_until], fan))
        base = float(known.loc[shared_until])
        hi = np.concatenate(([base], projections["El Nino"].loc[shared_until:, crop].values))
        lo = np.concatenate(([base], projections["La Nina"].loc[shared_until:, crop].values))
        mid = np.concatenate(([base], projections["Neutral"].loc[shared_until:, crop].values))
        ax_crop.fill_between(
            yr,
            np.minimum(lo, hi),
            np.maximum(lo, hi),
            color=spec["colour"],
            alpha=0.22,
            linewidth=0,
            zorder=2,
        )
        ax_crop.plot(yr, mid, color=spec["colour"], linewidth=1.8, linestyle=(0, (5, 2)), zorder=3)
        spreads[crop] = abs(hi[-1] - lo[-1]) / mid[-1] * 100
        print(f"  {crop}: 2030 ENSO spread = {spreads[crop]:.1f}% of the neutral level")

    ax_crop.set_ylabel("Quintal per hectare", fontsize=12, fontweight="bold")
    ax_crop.set_ylim(0, 62)
    ax_crop.grid(True, linestyle=":", alpha=0.55)
    ax_crop.set_title(
        "Crop",
        fontsize=12,
        fontweight="bold",
        color="white",
        bbox=dict(boxstyle="round,pad=0.35", facecolor="#123a6b", edgecolor="none"),
    )
    handles, labels = ax_crop.get_legend_handles_labels()
    handles += [
        Line2D([], [], color="#666666", linestyle=(0, (5, 2)), linewidth=1.8),
        plt.Rectangle((0, 0), 1, 1, facecolor="#999999", alpha=0.25, edgecolor="none"),
    ]
    labels += ["Projected", "El Nino / La Nina range (from 2027)"]
    ax_crop.legend(handles, labels, ncol=3, fontsize=9, loc="upper left", framealpha=0.92)
    lag_gain = sum(w for name, w in model.feature_importance if "yield_lag1" in name)
    enso_gain = sum(w for name, w in model.feature_importance if "enso" in name)
    ax_crop.annotate(
        f"El Nino and La Nina differ by {min(spreads.values()):.1f}-{max(spreads.values()):.1f}% "
        f"of yield here: the regressor splits on yield_lag1 ({lag_gain:.0%} of gain), "
        f"not on ENSO ({enso_gain:.1%})",
        xy=(1990.4, 3.2),
        fontsize=9,
        color="#8a1a1a",
    )
    ax_crop.annotate(
        f"yields observed to {split}", xy=(split - 0.6, 7.6), ha="right", fontsize=9.5, color="#333333"
    )
    ax_crop.text(
        (split + shared_until) / 2,
        7.0,
        "projected  ·  ENSO observed",
        rotation=90,
        ha="center",
        va="bottom",
        fontsize=8.5,
        color="#777777",
    )
    ax_crop.text(
        (shared_until + HORIZON) / 2,
        7.0,
        "projected  ·  ENSO assumed",
        rotation=90,
        ha="center",
        va="bottom",
        fontsize=8.5,
        color="#777777",
    )

    obs_years = nino.loc[1990:].index.values
    obs_vals = nino.loc[1990:].values
    ax_nino.axhline(0, color="black", linestyle="--", linewidth=1)
    ax_nino.plot(
        obs_years,
        obs_vals,
        color="#e5007d",
        marker="o",
        markersize=6,
        markerfacecolor="#ffe44d",
        markeredgecolor="#e5007d",
        linewidth=1.5,
        label="Observed annual mean (NOAA ERSST)",
        zorder=3,
    )
    if partial:
        ax_nino.plot(
            [last_nino_year],
            [nino.loc[last_nino_year]],
            marker="o",
            markersize=10,
            markerfacecolor="none",
            markeredgecolor="#e5007d",
            linewidth=0,
            zorder=4,
        )

    anchor_x, anchor_y = last_nino_year, float(nino.loc[last_nino_year])
    for name, (value, colour) in SCENARIOS.items():
        ax_nino.plot(
            [anchor_x, anchor_x + 1, HORIZON],
            [anchor_y, value, value],
            color=colour,
            linestyle=(0, (5, 2)),
            linewidth=1.8,
            zorder=3,
        )
        ax_nino.plot([HORIZON], [value], marker="D", markersize=5, color=colour, zorder=4)
        ax_nino.annotate(
            f"{name} ({value:+.1f})",
            xy=(HORIZON + 0.15, value),
            va="center",
            fontsize=9,
            color=colour,
            fontweight="bold",
        )

    ax_nino.set_ylabel("Nino 3.4", fontsize=12, fontweight="bold")
    ax_nino.set_xlabel("Time (year)", fontsize=12, fontweight="bold")
    ax_nino.set_ylim(-2, 2)
    ax_nino.grid(True, linestyle=":", alpha=0.55)
    ax_nino.set_title(
        "Nino 3.4",
        fontsize=12,
        fontweight="bold",
        color="white",
        bbox=dict(boxstyle="round,pad=0.35", facecolor="#123a6b", edgecolor="none"),
    )
    ax_nino.legend(fontsize=9, loc="lower left", framealpha=0.92)
    ax_nino.annotate(
        f"observed to {last_nino_year}",
        xy=(last_nino_year - 0.6, 1.58),
        ha="right",
        fontsize=9.5,
        color="#333333",
    )
    ax_nino.annotate(
        "no forecast skill beyond ~6 months",
        xy=(shared_until + 0.35, 1.72),
        va="top",
        fontsize=8.8,
        color="#444444",
    )
    ax_nino.annotate(
        "assumed states, not a prediction",
        xy=(shared_until + 0.35, 1.45),
        va="top",
        fontsize=8.8,
        color="#444444",
    )

    ax_nino.set_xlim(1989.2, HORIZON + 1.9)
    ax_nino.set_xticks(np.arange(1990, HORIZON + 1, 5))

    fig.suptitle(
        "Choke watershed: belt-average crop yields and Nino 3.4, 1990-2030",
        fontsize=14,
        fontweight="bold",
        y=0.955,
    )
    rmse = model.selected_metrics.get("test_rmse")
    fig.text(
        0.5,
        0.012,
        f"Observed yields {int(sheet.index.min())}-{split} (climate-crop v2, ENSO verified "
        f"against its seasonal source) · observed Nino 3.4 1990-{last_nino_year} "
        f"(NOAA PSL, ERSST; {last_nino_year} is Jan-Sep) · projections from "
        f"{model.model_name} {model.model_version}, holdout RMSE {rmse:.2f} q/ha",
        ha="center",
        fontsize=8.5,
        color="#555555",
    )

    png = OUT / "enso_crop_outlook_1990_2030.png"
    fig.savefig(png, dpi=160, bbox_inches="tight")
    plt.close(fig)
    print(f"wrote {png}")
    print(f"wrote {OUT / 'enso_crop_outlook_1990_2030.csv'}")
    for name, frame in projections.items():
        print(f"\n{name} ({SCENARIOS[name][0]:+.1f}) belt-average yield, q/ha")
        print(frame.round(2).to_string())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
