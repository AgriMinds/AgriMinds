"""Load real data if present in data/raw/, otherwise generate a synthetic stand-in.

Real-data format (monthly, START..END):
  data/raw/nino_indices.csv : date,nino34,nino12,nino4,soi
  data/raw/grids.npz        : rain, tmax, soilm, ndvi  -> each (T, H, W), plus dates (YYYY-MM-DD strings)
"""
import numpy as np, pandas as pd
from scipy.signal import lfilter
from config import *


def _ema(x, a):
    return lfilter([a], [1, -(1 - a)], x, axis=0)


def make_synthetic(seed=SEED):
    rng = np.random.default_rng(seed)
    idx = pd.date_range(START, END, freq="MS"); T = len(idx); H, W = GRID
    t = np.arange(T); mo = idx.month.values

    # ENSO-like index: ~3.8-yr oscillation + AR(1) noise
    e = np.zeros(T)
    for i in range(1, T):
        e[i] = 0.93 * e[i - 1] + rng.normal(0, 0.25)
    nino = e + 0.9 * np.sin(2 * np.pi * t / 46 + rng.uniform(0, 6))
    nino = (nino - nino.mean()) / nino.std()
    ind = pd.DataFrame({"date": idx, "nino34": nino,
                        "nino12": 0.8 * nino + rng.normal(0, .35, T),
                        "nino4": 0.7 * np.roll(nino, 1) + rng.normal(0, .3, T),
                        "soi": -0.7 * nino + rng.normal(0, .5, T)})

    # Rainfall (mm/month): Belg (Mar-Apr) + Kiremt (Jul-Aug) cycle, El Nino suppresses Kiremt
    seas = 20 + 150 * np.exp(-.5 * ((mo - 7.5) / 1.3) ** 2) + 45 * np.exp(-.5 * ((mo - 3.5) / .9) ** 2)
    kir = np.where((mo >= 6) & (mo <= 9), 1.0, 0.5)
    enso = np.exp(-0.18 * np.roll(nino, 1) * kir)
    gy, gx = np.mgrid[0:H, 0:W]
    spatial = 0.75 + 0.5 * gy / (H - 1) + 0.15 * np.sin(gx / 2.0)
    reg = rng.gamma(8, 1 / 8, T); loc = rng.gamma(8, 1 / 8, (T, H, W))
    rain = seas[:, None, None] * enso[:, None, None] * spatial * reg[:, None, None] ** .7 * loc ** .5
    ema_r = _ema(rain, 0.5)
    ndvi = np.clip(0.2 + 0.55 * (1 - np.exp(-ema_r / 120)) + rng.normal(0, .02, rain.shape), 0.05, 0.9)
    soilm = np.clip(0.1 + 0.35 * (1 - np.exp(-_ema(rain, 0.35) / 90)) + rng.normal(0, .01, rain.shape), .05, .5)
    tmax = (24 + 3 * np.sin(2 * np.pi * (mo - 3) / 12) + 0.5 * nino)[:, None, None] \
           - 2 * gy / (H - 1) + rng.normal(0, .4, rain.shape)
    return ind, dict(rain=rain, tmax=tmax, soilm=soilm, ndvi=ndvi, dates=idx.strftime("%Y-%m-%d").values)


def save_raw(ind, grids):
    ind.to_csv(RAW / "nino_indices.csv", index=False)
    np.savez_compressed(RAW / "grids.npz", **grids)


def load_raw():
    ind = pd.read_csv(RAW / "nino_indices.csv", parse_dates=["date"])
    g = np.load(RAW / "grids.npz", allow_pickle=True)
    return ind, {k: g[k] for k in g.files}
