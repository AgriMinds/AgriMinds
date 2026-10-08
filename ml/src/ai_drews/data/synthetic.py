"""Synthetic stand-in data so the whole pipeline can run before real observations are wired in.

Synthetic data only checks that the code runs. Real skill must be measured on real data.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.signal import lfilter

from ai_drews.config import DEFAULT_CONFIG, PipelineConfig

#: Half of a typical highland diurnal temperature range (deg C).
DIURNAL_HALF_RANGE_C = 6.5


def _ema(x: np.ndarray, a: float) -> np.ndarray:
    return lfilter([a], [1, -(1 - a)], x, axis=0)


def make_synthetic(
    cfg: PipelineConfig = DEFAULT_CONFIG, seed: int | None = None
) -> tuple[pd.DataFrame, dict]:
    """Return (climate indices DataFrame, gridded fields dict) with ENSO-coupled rainfall."""
    rng = np.random.default_rng(cfg.seed if seed is None else seed)
    idx = pd.date_range(cfg.start, cfg.end, freq="MS")
    T = len(idx)
    H, W = cfg.grid
    t = np.arange(T)
    mo = idx.month.values

    # ENSO-like index: ~3.8-yr oscillation + AR(1) noise
    e = np.zeros(T)
    for i in range(1, T):
        e[i] = 0.93 * e[i - 1] + rng.normal(0, 0.25)
    nino = e + 0.9 * np.sin(2 * np.pi * t / 46 + rng.uniform(0, 6))
    nino = (nino - nino.mean()) / nino.std()
    ind = pd.DataFrame(
        {
            "date": idx,
            "nino34": nino,
            "nino12": 0.8 * nino + rng.normal(0, 0.35, T),
            "nino4": 0.7 * np.roll(nino, 1) + rng.normal(0, 0.3, T),
            "soi": -0.7 * nino + rng.normal(0, 0.5, T),
        }
    )

    # Rainfall (mm/month): Belg (Mar-Apr) + Kiremt (Jul-Aug) cycle, El Nino suppresses Kiremt
    seas = 20 + 150 * np.exp(-0.5 * ((mo - 7.5) / 1.3) ** 2) + 45 * np.exp(-0.5 * ((mo - 3.5) / 0.9) ** 2)
    kir = np.where((mo >= 6) & (mo <= 9), 1.0, 0.5)
    enso = np.exp(-0.18 * np.roll(nino, 1) * kir)
    gy, gx = np.mgrid[0:H, 0:W]
    spatial = 0.75 + 0.5 * gy / (H - 1) + 0.15 * np.sin(gx / 2.0)
    reg = rng.gamma(8, 1 / 8, T)
    loc = rng.gamma(8, 1 / 8, (T, H, W))
    rain = seas[:, None, None] * enso[:, None, None] * spatial * reg[:, None, None] ** 0.7 * loc**0.5
    ema_r = _ema(rain, 0.5)
    ndvi = np.clip(0.2 + 0.55 * (1 - np.exp(-ema_r / 120)) + rng.normal(0, 0.02, rain.shape), 0.05, 0.9)
    soilm = np.clip(
        0.1 + 0.35 * (1 - np.exp(-_ema(rain, 0.35) / 90)) + rng.normal(0, 0.01, rain.shape), 0.05, 0.5
    )
    tmax = (
        (24 + 3 * np.sin(2 * np.pi * (mo - 3) / 12) + 0.5 * nino)[:, None, None]
        - 2 * gy / (H - 1)
        + rng.normal(0, 0.4, rain.shape)
    )
    # The Ethiopian highlands run a wide, fairly constant diurnal range; the stand-in data models
    # it as fixed so that mean temperature stays consistent with the maxima above. Real inputs
    # should supply `tmean` measured, not derived.
    tmean = tmax - DIURNAL_HALF_RANGE_C
    grids = dict(
        rain=rain,
        tmax=tmax,
        tmean=tmean,
        soilm=soilm,
        ndvi=ndvi,
        dates=idx.strftime("%Y-%m-%d").values,
    )
    return ind, grids
