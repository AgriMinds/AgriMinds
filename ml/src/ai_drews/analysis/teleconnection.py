"""How strongly El Niño / La Niña tracks drought over the watershed.

This reproduces the analysis behind Fig. 5 of the AI-DREWS study ("Correlations of ENSO and
Drought", Amhara), which reports R = 0.79 between Sc-PDSI and ENSO. That published figure is a
result for real Amhara observations. The function below computes the same statistic from
whatever record is loaded, so a run on the synthetic stand-in reports the synthetic
correlation and never the published one.

Because the ocean leads the land, the correlation is also computed at several lags: ENSO in
month t against the drought index in month t + lag. The lag with the strongest association is
the one an early-warning system can actually act on.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class TeleconnectionResult:
    index: str  # which drought index was correlated: 'scpdsi' or 'spi'
    months: int
    correlation_at_lag_0: float
    best_lag_months: int
    best_correlation: float
    by_lag: dict[int, float] = field(default_factory=dict)
    note: str = ""

    def to_frame(self) -> pd.DataFrame:
        return pd.DataFrame(
            {"lag_months": list(self.by_lag), "correlation": list(self.by_lag.values())}
        ).assign(index=self.index, months=self.months)

    def to_dict(self) -> dict:
        return asdict(self)


def _pearson(a: np.ndarray, b: np.ndarray) -> float:
    ok = np.isfinite(a) & np.isfinite(b)
    if ok.sum() < 3:
        return float("nan")
    x, y = a[ok], b[ok]
    if x.std() == 0 or y.std() == 0:
        return float("nan")
    return float(np.corrcoef(x, y)[0, 1])


def enso_drought_correlation(
    nino34: np.ndarray,
    drought_index: np.ndarray,
    index_name: str = "scpdsi",
    max_lag_months: int = 9,
) -> TeleconnectionResult:
    """Correlate a Niño 3.4 series with a basin drought index at lags 0..max_lag_months.

    ``drought_index`` may be (T,) already averaged, or (T, H, W), in which case it is averaged
    over the basin first. A positive lag means ENSO leads the drought index.

    Sign convention: Sc-PDSI and SPI are *negative* in drought, and El Niño suppresses Kiremt
    rainfall, so the expected relationship over the Ethiopian highlands is negative. The
    magnitude is what is comparable with the published figure.
    """
    nino = np.asarray(nino34, dtype="float64").ravel()
    values = np.asarray(drought_index, dtype="float64")
    if values.ndim == 3:
        with np.errstate(invalid="ignore"):
            values = np.nanmean(values, axis=(1, 2))
    values = values.ravel()
    if len(values) != len(nino):
        raise ValueError(f"series lengths differ: nino34={len(nino)}, {index_name}={len(values)}")

    by_lag: dict[int, float] = {}
    for lag in range(max_lag_months + 1):
        leading = nino[: len(nino) - lag] if lag else nino
        following = values[lag:] if lag else values
        by_lag[lag] = _pearson(leading, following)

    finite = {k: v for k, v in by_lag.items() if np.isfinite(v)}
    best_lag = max(finite, key=lambda k: abs(finite[k])) if finite else 0
    return TeleconnectionResult(
        index=index_name,
        months=len(values),
        correlation_at_lag_0=round(by_lag.get(0, float("nan")), 3),
        best_lag_months=best_lag,
        best_correlation=round(by_lag.get(best_lag, float("nan")), 3),
        by_lag={k: round(v, 3) for k, v in by_lag.items()},
        note=(
            "Computed from the loaded record. The published Amhara value (R = 0.79, Fig. 5) "
            "refers to real observations and is not reproduced here unless real data is loaded."
        ),
    )
