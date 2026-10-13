"""A verified panel builder, beside the upstream `preprocess.py` rather than instead of it.

`preprocess.py` is kept byte-identical to the Hugging Face original so the retrained artifact
stays comparable with the published one. That makes it the wrong place to fix anything, so the
two defects it carries are fixed here instead.

**1. The ENSO column is verified against its own source, not trusted by revision number.**
The `ElniNo` column of `climate-crop*.xlsx` is the mean of four seasonal Niño 3.4 values, and
those seasonal values are in `nino34_seasonal_reference.csv`. Recomputing the mean reproduces 32
of 34 years exactly. The two it does not reproduce are both in the *newer* spreadsheet:

| year | seasonal source | climate-crop.xlsx (v1) | climate-crop (2).xlsx (v2) |
|------|-----------------|------------------------|----------------------------|
| 2010 | -0.175          | -0.175                 | **-0.975**                 |
| 2022 | -0.975          | -0.975                 | **-2.975**                 |

So v2 is not a revision of v1, it is a transcription error against it: -0.175 became -0.975 and
-0.975 became -2.975, each a single digit. The 2010 error also flips that year's phase label from
Neutral to La Niña, which moves it between groups in the El Niño impact analysis. The published
model was fitted on both errors.

**2. The rolling-3 mean is computed inside each series.** Upstream does
``groupby(...).shift(1).rolling(3)``: the shift is grouped, the rolling that follows runs down the
concatenated column, so the first two rows of eight of the nine crop-zone series average in the
tail of the series before them. Teff Highland 1990 gets 44.88 q/ha instead of 10.25.

Run it alone for the validation report:  python ml/research/crop_yield/corrected.py
"""

from __future__ import annotations

import os
from dataclasses import dataclass

import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REFERENCE_CSV = os.path.join(BASE_DIR, "data", "nino34_seasonal_reference.csv")

#: How far the spreadsheet may sit from the recomputed seasonal mean before it is called an error.
#: The seasonal values carry one decimal, so their mean lands on a multiple of 0.025; anything
#: beyond half that is not rounding.
ENSO_TOLERANCE = 0.0125

ZONE_MAPPING = {
    "kola": {"zone": "Lowland", "altitude_approx_m": 1000, "altitude_min_m": 500, "altitude_max_m": 1500},
    "w/d": {"zone": "Midland", "altitude_approx_m": 2000, "altitude_min_m": 1500, "altitude_max_m": 2500},
    "dega": {"zone": "Highland", "altitude_approx_m": 2800, "altitude_min_m": 2500, "altitude_max_m": 3500},
}
CROPS = ["teff", "wheat", "maiz"]
CROP_DISPLAY = {"teff": "Teff", "wheat": "Wheat", "maiz": "Maize"}


@dataclass(frozen=True)
class EnsoDiscrepancy:
    year: int
    spreadsheet: float
    reference: float

    @property
    def delta(self) -> float:
        return self.spreadsheet - self.reference


def load_enso_reference(path: str = REFERENCE_CSV) -> pd.Series:
    """Year -> Niño 3.4 annual mean, recomputed from the four seasonal values."""
    ref = pd.read_csv(path)
    seasons = ["djf", "mam", "jja", "son"]
    return pd.Series(
        ref[seasons].mean(axis=1).round(4).values, index=ref["year"].astype(int), name="enso_reference"
    )


def verify_enso(
    sheet: pd.DataFrame, reference: pd.Series, tolerance: float = ENSO_TOLERANCE
) -> list[EnsoDiscrepancy]:
    """Every year where the spreadsheet's ENSO value is not its own seasonal mean."""
    out = []
    for year, value in zip(sheet["Year"].astype(int), sheet["ElniNo"].astype(float), strict=True):
        if year not in reference.index:
            continue
        ref = float(reference.loc[year])
        if abs(value - ref) > tolerance:
            out.append(EnsoDiscrepancy(year=int(year), spreadsheet=float(value), reference=ref))
    return out


def enso_phase(value: float) -> str:
    if value >= 0.5:
        return "El Nino"
    if value <= -0.5:
        return "La Nina"
    return "Neutral"


def prepare_crop_dataset_corrected(
    input_excel_path: str,
    output_csv_path: str,
    reference_csv: str = REFERENCE_CSV,
    *,
    verbose: bool = True,
) -> tuple[pd.DataFrame, list[EnsoDiscrepancy]]:
    """The upstream transformation with the ENSO column verified and the rolling mean grouped."""
    df_raw = pd.read_excel(input_excel_path)
    reference = load_enso_reference(reference_csv)
    discrepancies = verify_enso(df_raw, reference)
    repaired = {d.year: d.reference for d in discrepancies}
    if verbose and discrepancies:
        print(f"ENSO verification: {len(discrepancies)} year(s) disagree with the seasonal source")
        for d in discrepancies:
            print(
                f"  {d.year}: spreadsheet {d.spreadsheet:+.3f} -> reference {d.reference:+.3f} "
                f"(delta {d.delta:+.3f}); phase {enso_phase(d.spreadsheet)} -> {enso_phase(d.reference)}"
            )

    records = []
    for _, row in df_raw.iterrows():
        year = int(row["Year"])
        temp = float(row["Tem(oc)"])
        precip = float(row["pr(mm/mo)"])
        enso = float(repaired.get(year, row["ElniNo"]))
        pt_ratio = precip / (temp + 1e-5)
        for crop_key in CROPS:
            for zone_key, zone_meta in ZONE_MAPPING.items():
                col = f"{crop_key} {zone_key}"
                if col not in df_raw.columns:
                    continue
                records.append(
                    {
                        "year": year,
                        "crop": CROP_DISPLAY[crop_key],
                        "zone": zone_meta["zone"],
                        "altitude_approx_m": zone_meta["altitude_approx_m"],
                        "altitude_min_m": zone_meta["altitude_min_m"],
                        "altitude_max_m": zone_meta["altitude_max_m"],
                        "temperature_c": temp,
                        "precipitation_mm": precip,
                        "pt_ratio": pt_ratio,
                        "enso_index": enso,
                        "enso_phase": enso_phase(enso),
                        "enso_source": "seasonal reference (repaired)" if year in repaired else "spreadsheet",
                        "yield": float(row[col]),
                    }
                )

    df = pd.DataFrame(records).sort_values(["crop", "zone", "year"]).reset_index(drop=True)
    group = df.groupby(["crop", "zone"], sort=False)["yield"]
    df["yield_lag1"] = group.shift(1)
    # The rolling mean stays inside the group: upstream lets it run across series boundaries.
    df["yield_rolling3_mean"] = group.transform(lambda s: s.shift(1).rolling(3, min_periods=1).mean())
    df["yield_lag1"] = df["yield_lag1"].fillna(df["yield"])
    df["yield_rolling3_mean"] = df["yield_rolling3_mean"].fillna(df["yield"])

    os.makedirs(os.path.dirname(output_csv_path), exist_ok=True)
    df.to_csv(output_csv_path, index=False)
    if verbose:
        print(f"Corrected panel: {len(df)} rows -> {output_csv_path}")
    return df, discrepancies


if __name__ == "__main__":
    sheet = os.path.join(BASE_DIR, "data", "climate-crop-v2.xlsx")
    out = os.path.join(BASE_DIR, "data", "crop_climate_clean_corrected.csv")
    frame, issues = prepare_crop_dataset_corrected(sheet, out)

    upstream = pd.read_csv(os.path.join(BASE_DIR, "data", "crop_climate_clean.csv"))
    merged = upstream.merge(
        frame[["year", "crop", "zone", "yield_rolling3_mean"]],
        on=["year", "crop", "zone"],
        suffixes=("_upstream", "_corrected"),
    )
    changed = merged[
        (merged.yield_rolling3_mean_upstream - merged.yield_rolling3_mean_corrected).abs() > 1e-6
    ]
    print(f"\nrolling-3 mean differs on {len(changed)} of {len(merged)} rows")
    print(
        changed[["year", "crop", "zone", "yield_rolling3_mean_upstream", "yield_rolling3_mean_corrected"]]
        .round(2)
        .to_string(index=False)
    )
