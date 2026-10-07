"""Feature cubes shared by training and inference (Step 2)."""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd

from ai_drews.config import DEFAULT_CONFIG, DataPaths, PipelineConfig
from ai_drews.data.io import load_raw
from ai_drews.features.indices import spi, vci, zanom

log = logging.getLogger(__name__)

SP_CH = ["rain_z", "ndvi", "vci", "soilm_z", "spi"]  # spatial channels (Xs)
TM_CH = ["rain_z", "tmax", "soilm_z", "ndvi", "spi", "vci", "nino34"]  # temporal channels (Xt)

Fields = dict[str, np.ndarray]


def compute_fields(ind: pd.DataFrame, g: dict, cfg: PipelineConfig = DEFAULT_CONFIG) -> Fields:
    dates = pd.to_datetime(g["dates"])
    mo = dates.month.values
    sp = spi(g["rain"], mo, cfg.spi_scale)
    v = vci(g["ndvi"], mo)
    rz, sz = zanom(g["rain"], mo), zanom(g["soilm"], mo)
    S = np.nan_to_num(np.stack([rz, g["ndvi"], v / 100, sz, sp], 1))  # (T,5,H,W)
    nino = ind["nino34"].to_numpy()
    with np.errstate(all="ignore"):
        TF = np.nan_to_num(
            np.stack(
                [
                    rz.mean((1, 2)),
                    g["tmax"].mean((1, 2)),
                    sz.mean((1, 2)),
                    g["ndvi"].mean((1, 2)),
                    np.nanmean(sp, (1, 2)),
                    v.mean((1, 2)) / 100,
                    nino,
                ],
                1,
            )
        )  # (T,7)
    return dict(
        dates=dates.strftime("%Y-%m-%d").values,
        months=mo,
        spi=sp,
        vci=v,
        S=S.astype("float32"),
        TF=TF.astype("float32"),
        nino=nino,
        nino_all=ind[["nino34", "nino12", "nino4", "soi"]].to_numpy().astype("float32"),
    )


def save_fields(paths: DataPaths, F: Fields) -> None:
    paths.ensure()
    np.savez_compressed(paths.fields_npz, **F)


def load_fields(paths: DataPaths) -> Fields:
    z = np.load(paths.fields_npz, allow_pickle=True)
    return {k: z[k] for k in z.files}


def load_enso_fc(paths: DataPaths, T: int, leads: int = 3) -> np.ndarray:
    """ENSO forecasts (leads 1..3) from Objective 1 aligned to the field dates; zeros if not trained yet."""
    if not paths.enso_forecast_csv.exists():
        return np.zeros((T, leads), "float32")
    cols = [f"fc_l{i + 1}" for i in range(leads)]
    fc = pd.read_csv(paths.enso_forecast_csv)[cols].to_numpy("float32")
    if len(fc) != T:
        raise ValueError(
            f"enso_forecast.csv has {len(fc)} rows but fields have {T} months; retrain ENSO first"
        )
    return fc


def build_features(paths: DataPaths, cfg: PipelineConfig = DEFAULT_CONFIG) -> dict:
    """Step 2: compute SPI-3, VCI, anomalies; save fields.npz; return split sizes and base rates."""
    from ai_drews.features.windows import make_labels, split_idx

    ind, g = load_raw(paths)
    F = compute_fields(ind, g, cfg)
    save_fields(paths, F)
    tr, va, te = split_idx(F, cfg.drought_leads, cfg)
    y = make_labels(F, tr, cfg)
    summary = dict(
        fields=str(paths.fields_npz),
        train=len(tr),
        val=len(va),
        test=len(te),
        base_rate_by_lead=[round(float(y[:, lead].mean()), 3) for lead in range(cfg.drought_leads)],
        corr_nino_spi=round(float(np.corrcoef(F["nino"][2:], F["TF"][2:, 4])[0, 1]), 2),
    )
    log.info("features built: %s", summary)
    return summary
