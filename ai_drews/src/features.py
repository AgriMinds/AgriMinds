"""Drought indices (SPI, VCI), Fourier features, and sample construction."""
import warnings; warnings.filterwarnings("ignore", category=RuntimeWarning)
import numpy as np, pandas as pd
from scipy.stats import gamma, norm
from config import *

SP_CH = ["rain_z", "ndvi", "vci", "soilm_z", "spi"]            # spatial channels (Xs)
TM_CH = ["rain_z", "tmax", "soilm_z", "ndvi", "spi", "vci", "nino34"]  # temporal channels (Xt)


def spi(rain, months, scale=SPI_SCALE):
    """Standardised Precipitation Index: gamma fit per cell & calendar month (zeros handled)."""
    T, H, W = rain.shape
    acc = pd.DataFrame(rain.reshape(T, -1)).rolling(scale).sum().to_numpy()
    out = np.full_like(acc, np.nan)
    for m in range(1, 13):
        sel = np.where(months == m)[0]
        for k in range(acc.shape[1]):
            x = acc[sel, k]; ok = ~np.isnan(x)
            if ok.sum() < 10: continue
            xv = x[ok]; q = (xv == 0).mean(); pos = xv[xv > 0]
            if len(pos) < 5: continue
            a, _, sc = gamma.fit(pos, floc=0)
            cdf = q + (1 - q) * gamma.cdf(xv, a, loc=0, scale=sc)
            tmp = np.full(len(x), np.nan); tmp[ok] = norm.ppf(np.clip(cdf, 1e-4, 1 - 1e-4))
            out[sel, k] = tmp
    return out.reshape(T, H, W)


def vci(ndvi, months):
    """Vegetation Condition Index (0-100) vs. same-month min/max."""
    out = np.zeros_like(ndvi)
    for m in range(1, 13):
        s = months == m; lo, hi = ndvi[s].min(0), ndvi[s].max(0)
        out[s] = 100 * (ndvi[s] - lo) / np.maximum(hi - lo, 1e-6)
    return out


def zanom(x, months):
    out = np.zeros_like(x)
    for m in range(1, 13):
        s = months == m
        out[s] = (x[s] - x[s].mean(0)) / (x[s].std(0) + 1e-6)
    return out


def compute_fields(ind, g):
    dates = pd.to_datetime(g["dates"]); mo = dates.month.values
    sp = spi(g["rain"], mo); v = vci(g["ndvi"], mo)
    rz, sz = zanom(g["rain"], mo), zanom(g["soilm"], mo)
    S = np.nan_to_num(np.stack([rz, g["ndvi"], v / 100, sz, sp], 1))        # (T,5,H,W)
    nino = ind["nino34"].to_numpy()
    TF = np.nan_to_num(np.stack([rz.mean((1, 2)), g["tmax"].mean((1, 2)), sz.mean((1, 2)),
                                 g["ndvi"].mean((1, 2)), np.nanmean(sp, (1, 2)),
                                 v.mean((1, 2)) / 100, nino], 1))           # (T,7)
    return dict(dates=dates.strftime("%Y-%m-%d").values, months=mo, spi=sp, vci=v,
                S=S.astype("float32"), TF=TF.astype("float32"), nino=nino,
                nino_all=ind[["nino34", "nino12", "nino4", "soi"]].to_numpy().astype("float32"))


def save_fields(F):  np.savez_compressed(PROC / "fields.npz", **F)
def load_fields():
    z = np.load(PROC / "fields.npz", allow_pickle=True); return {k: z[k] for k in z.files}


def load_enso_fc(T):
    """ENSO forecasts (leads 1-3) from Objective 1, aligned to the field dates; zeros if not trained yet."""
    f = PROC / "enso_forecast.csv"
    if not f.exists(): return np.zeros((T, 3), "float32")
    return pd.read_csv(f)[["fc_l1", "fc_l2", "fc_l3"]].to_numpy("float32")


def fourier_feats(F, t, enso_fc):
    """Xp: seasonal harmonics of origin month + FFT amplitudes of rain & ENSO window + ENSO forecast."""
    m = F["months"][t]
    harm = [f(2 * np.pi * k * m / 12) for k in (1, 2, 3) for f in (np.sin, np.cos)]
    w = slice(t - WINDOW + 1, t + 1)
    fr = np.abs(np.fft.rfft(F["TF"][w, 0]))[1:5] / WINDOW
    fn = np.abs(np.fft.rfft(F["nino"][w]))[1:5] / WINDOW
    return np.array(harm + list(fr) + list(fn) + list(enso_fc[t]), dtype="float32")   # 6+4+4+3 = 17


def make_inputs(F, t_idx, enso_fc):
    Xs = F["S"][t_idx]
    Xt = np.stack([F["TF"][t - WINDOW + 1:t + 1] for t in t_idx])
    Xp = np.stack([fourier_feats(F, t, enso_fc) for t in t_idx])
    return Xs, Xt, Xp


def make_labels(F, t_idx, leads=DROUGHT_LEADS):
    return np.stack([(F["spi"][t + 1:t + 1 + leads] <= SPI_DROUGHT) for t in t_idx]).astype("float32")  # (N,L,H,W)


def split_idx(F, last_lead):
    d = pd.to_datetime(F["dates"]); T = len(d)
    t = np.arange(WINDOW - 1, T - last_lead)
    tr = t[d[t] <= TRAIN_END]; va = t[(d[t] > TRAIN_END) & (d[t] <= VAL_END)]; te = t[d[t] > VAL_END]
    return tr, va, te


def fit_norm(Xs, Xt, Xp):
    return dict(s_m=Xs.mean((0, 2, 3)), s_s=Xs.std((0, 2, 3)) + 1e-6,
                t_m=Xt.mean((0, 1)), t_s=Xt.std((0, 1)) + 1e-6,
                p_m=Xp.mean(0), p_s=Xp.std(0) + 1e-6)


def apply_norm(n, Xs, Xt, Xp):
    return ((Xs - n["s_m"][None, :, None, None]) / n["s_s"][None, :, None, None],
            (Xt - n["t_m"]) / n["t_s"], (Xp - n["p_m"]) / n["p_s"])
