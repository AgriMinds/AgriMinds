"""Sample construction: input windows, Fourier/periodic features, labels, splits, normalisation."""

from __future__ import annotations

import numpy as np
import pandas as pd

from ai_drews.config import DEFAULT_CONFIG, PipelineConfig

Norm = dict[str, np.ndarray]


def fourier_feats(F: dict, t: int, enso_fc: np.ndarray, cfg: PipelineConfig = DEFAULT_CONFIG) -> np.ndarray:
    """Xp: seasonal harmonics of origin month + FFT amplitudes of rain & ENSO window + ENSO forecast (17 dims)."""
    m = F["months"][t]
    harm = [f(2 * np.pi * k * m / 12) for k in (1, 2, 3) for f in (np.sin, np.cos)]
    w = slice(t - cfg.window + 1, t + 1)
    fr = np.abs(np.fft.rfft(F["TF"][w, 0]))[1:5] / cfg.window
    fn = np.abs(np.fft.rfft(F["nino"][w]))[1:5] / cfg.window
    return np.array(harm + list(fr) + list(fn) + list(enso_fc[t]), dtype="float32")  # 6+4+4+3 = 17


def make_inputs(F: dict, t_idx, enso_fc: np.ndarray, cfg: PipelineConfig = DEFAULT_CONFIG):
    Xs = F["S"][t_idx]
    Xt = np.stack([F["TF"][t - cfg.window + 1 : t + 1] for t in t_idx])
    Xp = np.stack([fourier_feats(F, t, enso_fc, cfg) for t in t_idx])
    return Xs, Xt, Xp


def make_labels(F: dict, t_idx, cfg: PipelineConfig = DEFAULT_CONFIG) -> np.ndarray:
    leads = cfg.drought_leads
    return np.stack([(F["spi"][t + 1 : t + 1 + leads] <= cfg.spi_drought) for t in t_idx]).astype("float32")


def split_idx(F: dict, last_lead: int, cfg: PipelineConfig = DEFAULT_CONFIG):
    d = pd.to_datetime(F["dates"])
    T = len(d)
    t = np.arange(cfg.window - 1, T - last_lead)
    tr = t[d[t] <= cfg.train_end]
    va = t[(d[t] > cfg.train_end) & (d[t] <= cfg.val_end)]
    te = t[d[t] > cfg.val_end]
    return tr, va, te


def fit_norm(Xs, Xt, Xp) -> Norm:
    return dict(
        s_m=Xs.mean((0, 2, 3)),
        s_s=Xs.std((0, 2, 3)) + 1e-6,
        t_m=Xt.mean((0, 1)),
        t_s=Xt.std((0, 1)) + 1e-6,
        p_m=Xp.mean(0),
        p_s=Xp.std(0) + 1e-6,
    )


def apply_norm(n: Norm, Xs, Xt, Xp):
    return (
        (Xs - n["s_m"][None, :, None, None]) / n["s_s"][None, :, None, None],
        (Xt - n["t_m"]) / n["t_s"],
        (Xp - n["p_m"]) / n["p_s"],
    )
