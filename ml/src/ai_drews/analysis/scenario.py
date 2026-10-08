"""Long-horizon drought outlook from a climate projection.

This answers the question the study's Fig. 5 poses with its trend lines: under a given emissions
pathway, is drought intensity drifting over decades? It is deliberately separate from the
operational forecast, which is trained on history and runs one to three months ahead.

The Sc-PDSI calibration period matters here. Calibrating on the whole projection would absorb the
very trend being measured into the baseline, so the index is calibrated on the opening decades and
the later years are then expressed relative to that earlier climate.
"""

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass

import numpy as np
import pandas as pd
from scipy import stats

from ai_drews.advisory.classification import pdsi_category, pdsi_is_drought
from ai_drews.data.cmip6 import Projection
from ai_drews.features.pdsi import DEFAULT_AWC_MM, scpdsi

log = logging.getLogger(__name__)

#: Share of the record used to define the baseline climate the rest is measured against.
DEFAULT_BASELINE_FRACTION = 0.5


@dataclass(frozen=True)
class ScenarioOutlook:
    scenario: str
    period: str
    baseline_period: str
    months: int

    baseline_mean_pdsi: float
    final_decade_mean_pdsi: float
    final_decade_category: str
    change_per_decade: float
    trend_p_value: float
    trend_is_significant: bool

    baseline_months_in_drought_pct: float
    final_decade_months_in_drought_pct: float

    annual_precip_mm_baseline: float
    annual_precip_mm_final_decade: float
    warming_c_per_decade: float

    footprint_warning: str | None
    provenance: dict
    caveat: str

    def to_dict(self) -> dict:
        return asdict(self)

    def summary(self) -> str:
        direction = "drier" if self.change_per_decade < 0 else "wetter"
        significance = "significant" if self.trend_is_significant else "not statistically significant"
        return (
            f"{self.scenario}: Sc-PDSI changes {self.change_per_decade:+.2f} per decade "
            f"({direction}, {significance}, p={self.trend_p_value:.3g}). "
            f"The final decade averages {self.final_decade_mean_pdsi:+.2f} "
            f"({self.final_decade_category}), against {self.baseline_mean_pdsi:+.2f} in the baseline. "
            f"Months in drought: {self.baseline_months_in_drought_pct:.0f}% -> "
            f"{self.final_decade_months_in_drought_pct:.0f}%."
        )


def scenario_outlook(
    projection: Projection,
    latitude_deg: float,
    awc_mm: float = DEFAULT_AWC_MM,
    baseline_fraction: float = DEFAULT_BASELINE_FRACTION,
) -> tuple[ScenarioOutlook, pd.DataFrame]:
    """Compute Sc-PDSI over a projection and summarise its drift.

    Returns the summary and the full monthly series, so a caller can plot the trajectory the way
    Fig. 5 does rather than only quote the headline.
    """
    dates = projection.dates
    n = len(dates)
    if n < 240:
        raise ValueError(f"need at least 20 years to judge a trend; got {n} months")

    baseline_end_index = int(n * baseline_fraction)
    baseline_end = dates[baseline_end_index - 1]

    # scpdsi works on a grid; a regional series is a one-cell grid.
    index = scpdsi(
        projection.precip_mm.reshape(n, 1, 1),
        projection.tmean_c.reshape(n, 1, 1),
        dates,
        np.array([latitude_deg]),
        awc_mm=awc_mm,
        calibration_end=str(baseline_end.date()),
    ).ravel()

    frame = pd.DataFrame(
        {
            "date": dates,
            "precip_mm": projection.precip_mm,
            "tmean_c": projection.tmean_c,
            "scpdsi": np.round(index, 3),
        }
    )
    frame["category"] = [pdsi_category(float(v)) for v in index]
    frame["in_drought"] = [pdsi_is_drought(float(v)) for v in index]

    # Trend on annual means, so the seasonal cycle cannot masquerade as a trend.
    annual = frame.assign(year=frame["date"].dt.year).groupby("year")
    years = np.array(sorted(annual.groups))
    annual_pdsi = annual["scpdsi"].mean().to_numpy()
    annual_precip = annual["precip_mm"].sum().to_numpy()
    annual_temp = annual["tmean_c"].mean().to_numpy()

    fit = stats.linregress(years, annual_pdsi)
    warming = stats.linregress(years, annual_temp)

    baseline = frame.iloc[:baseline_end_index]
    final_decade = frame[frame["date"] >= dates[-1] - pd.DateOffset(years=10)]
    final_years = years >= years[-1] - 9
    baseline_years = years <= baseline_end.year

    return (
        ScenarioOutlook(
            scenario=projection.label,
            period=f"{dates[0]:%Y-%m} to {dates[-1]:%Y-%m}",
            baseline_period=f"{dates[0]:%Y} to {baseline_end:%Y}",
            months=n,
            baseline_mean_pdsi=round(float(baseline["scpdsi"].mean()), 2),
            final_decade_mean_pdsi=round(float(final_decade["scpdsi"].mean()), 2),
            final_decade_category=pdsi_category(float(final_decade["scpdsi"].mean())),
            change_per_decade=round(float(fit.slope * 10), 2),
            trend_p_value=float(fit.pvalue),
            trend_is_significant=bool(fit.pvalue < 0.05),
            baseline_months_in_drought_pct=round(float(baseline["in_drought"].mean() * 100), 1),
            final_decade_months_in_drought_pct=round(float(final_decade["in_drought"].mean() * 100), 1),
            annual_precip_mm_baseline=round(float(annual_precip[baseline_years].mean()), 1),
            annual_precip_mm_final_decade=round(float(annual_precip[final_years].mean()), 1),
            warming_c_per_decade=round(float(warming.slope * 10), 3),
            footprint_warning=projection.footprint.warning(),
            provenance=projection.provenance(),
            caveat=(
                "This is one model under one emissions pathway, not a forecast and not an "
                "observation. It describes the region the model grid resolves, which is coarser "
                "than the watershed. The index is calibrated on the baseline period, so later "
                "values are stated relative to that earlier climate and saturate near the ends "
                "of the scale once the climate shifts beyond it. Treat it as a direction of "
                "travel, not a prediction of any particular season."
            ),
        ),
        frame,
    )
