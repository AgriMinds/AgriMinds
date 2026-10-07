"""Drought indices: SPI (gamma-fitted), VCI, and monthly standardised anomalies."""

from __future__ import annotations

import warnings

import numpy as np
import pandas as pd
from scipy.stats import gamma, norm

from ai_drews.config import DEFAULT_CONFIG


def spi(rain: np.ndarray, months: np.ndarray, scale: int = DEFAULT_CONFIG.spi_scale) -> np.ndarray:
    """Standardised Precipitation Index: gamma fit per cell & calendar month (zeros handled).

    rain: (T, H, W) monthly totals; months: (T,) calendar month of each step. Returns (T, H, W).
    """
    T, H, W = rain.shape
    acc = pd.DataFrame(rain.reshape(T, -1)).rolling(scale).sum().to_numpy()
    out = np.full_like(acc, np.nan)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", category=RuntimeWarning)
        for m in range(1, 13):
            sel = np.where(months == m)[0]
            for k in range(acc.shape[1]):
                x = acc[sel, k]
                ok = ~np.isnan(x)
                if ok.sum() < 10:
                    continue
                xv = x[ok]
                q = (xv == 0).mean()
                pos = xv[xv > 0]
                if len(pos) < 5:
                    continue
                a, _, sc = gamma.fit(pos, floc=0)
                cdf = q + (1 - q) * gamma.cdf(xv, a, loc=0, scale=sc)
                tmp = np.full(len(x), np.nan)
                tmp[ok] = norm.ppf(np.clip(cdf, 1e-4, 1 - 1e-4))
                out[sel, k] = tmp
    return out.reshape(T, H, W)


def vci(ndvi: np.ndarray, months: np.ndarray) -> np.ndarray:
    """Vegetation Condition Index (0-100) relative to the same-month min/max."""
    out = np.zeros_like(ndvi)
    for m in range(1, 13):
        s = months == m
        lo, hi = ndvi[s].min(0), ndvi[s].max(0)
        out[s] = 100 * (ndvi[s] - lo) / np.maximum(hi - lo, 1e-6)
    return out


def zanom(x: np.ndarray, months: np.ndarray) -> np.ndarray:
    """Per-calendar-month z-score anomaly."""
    out = np.zeros_like(x)
    for m in range(1, 13):
        s = months == m
        out[s] = (x[s] - x[s].mean(0)) / (x[s].std(0) + 1e-6)
    return out
