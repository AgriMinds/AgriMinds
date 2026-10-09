"""Feature cubes shared by training and inference (Step 2)."""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd

from ai_drews.config import DEFAULT_CONFIG, DataPaths, PipelineConfig
from ai_drews.data.io import load_raw
from ai_drews.features.indices import spi, vci, zanom
from ai_drews.features.pdsi import row_latitudes, scpdsi

log = logging.getLogger(__name__)

#: Channels when every input is present. Greenness is optional: the study's five data sources do
#: not include a vegetation index, and MODIS is the one input that cannot be downloaded in
#: minutes, so the pipeline must run without it rather than refuse to start. Whichever channels
#: were actually built are recorded in fields.npz, so training and inference cannot disagree.
SP_CH = ["rain_z", "ndvi", "vci", "soilm_z", "spi"]  # spatial channels (Xs)
TM_CH = ["rain_z", "tmax", "soilm_z", "ndvi", "spi", "vci", "nino34"]  # temporal channels (Xt)
SP_CH_NO_NDVI = ["rain_z", "soilm_z", "spi"]
TM_CH_NO_NDVI = ["rain_z", "tmax", "soilm_z", "spi", "nino34"]

Fields = dict[str, np.ndarray]


def tm_channel(fields: Fields, name: str) -> np.ndarray:
    """One temporal channel by name, since the channel list depends on what was ingested."""
    channels = [str(c) for c in fields["tm_channels"]]
    if name not in channels:
        raise KeyError(f"no temporal channel {name!r}; have {channels}")
    return fields["TF"][:, channels.index(name)]


def compute_fields(ind: pd.DataFrame, g: dict, cfg: PipelineConfig = DEFAULT_CONFIG) -> Fields:
    dates = pd.to_datetime(g["dates"])
    mo = dates.month.values
    sp = spi(g["rain"], mo, cfg.spi_scale)
    rz, sz = zanom(g["rain"], mo), zanom(g["soilm"], mo)
    nino = ind["nino34"].to_numpy()
    has_ndvi = "ndvi" in g
    if not has_ndvi:
        log.warning("raw data has no `ndvi`: VCI and the greenness channels are omitted")
    v = vci(g["ndvi"], mo) if has_ndvi else None

    spatial: dict[str, np.ndarray] = {"rain_z": rz}
    if has_ndvi:
        spatial["ndvi"] = g["ndvi"]
        spatial["vci"] = v / 100
    spatial["soilm_z"] = sz
    spatial["spi"] = sp

    with np.errstate(all="ignore"):
        temporal: dict[str, np.ndarray] = {
            "rain_z": rz.mean((1, 2)),
            "tmax": g["tmax"].mean((1, 2)),
            "soilm_z": sz.mean((1, 2)),
        }
        if has_ndvi:
            temporal["ndvi"] = g["ndvi"].mean((1, 2))
        temporal["spi"] = np.nanmean(sp, (1, 2))
        if has_ndvi:
            temporal["vci"] = v.mean((1, 2)) / 100
        temporal["nino34"] = nino

        S = np.nan_to_num(np.stack(list(spatial.values()), 1))  # (T, C, H, W)
        TF = np.nan_to_num(np.stack(list(temporal.values()), 1))  # (T, C)

    fields = dict(
        dates=dates.strftime("%Y-%m-%d").values,
        months=mo,
        spi=sp,
        S=S.astype("float32"),
        TF=TF.astype("float32"),
        nino=nino,
        nino_all=ind[["nino34", "nino12", "nino4", "soi"]].to_numpy().astype("float32"),
        sp_channels=np.array(list(spatial), dtype=object),
        tm_channels=np.array(list(temporal), dtype=object),
    )
    if has_ndvi:
        fields["vci"] = v

    # Sc-PDSI needs evapotranspiration, which needs mean temperature. Deriving it from the
    # maxima would bias every downstream classification, so the index is simply absent when
    # the input is: callers check for the key rather than receiving a guess.
    if "tmean" in g:
        rows = g["rain"].shape[1]
        fields["pdsi"] = scpdsi(
            g["rain"],
            g["tmean"],
            dates,
            row_latitudes(cfg.bbox, rows),
            awc_mm=cfg.awc_mm,
            calibration_end=cfg.train_end,
        ).astype("float32")
    else:
        log.warning("raw data has no `tmean`: Sc-PDSI not computed")
    return fields


def save_fields(paths: DataPaths, F: Fields) -> None:
    paths.ensure()
    np.savez_compressed(paths.fields_npz, **F)


def load_fields(paths: DataPaths) -> Fields:
    z = np.load(paths.fields_npz, allow_pickle=True)
    return {k: z[k] for k in z.files}


def load_enso_fc(paths: DataPaths, T: int, leads: int = 3) -> np.ndarray:
    """ENSO forecasts aligned to the field dates; zeros if Objective 1 has not been trained yet.

    When the ENSO model reaches less far than the drought head, the furthest available lead is
    carried forward rather than zero-filled: a zero is the value for "neutral", which is a claim
    about the Pacific, while carrying forward says only that nothing newer is known. Either way
    the affected leads will not clear the skill gate, so this decides how they look, not whether
    they are published.
    """
    if not paths.enso_forecast_csv.exists():
        return np.zeros((T, leads), "float32")
    frame = pd.read_csv(paths.enso_forecast_csv)
    available = [c for c in (f"fc_l{i + 1}" for i in range(leads)) if c in frame.columns]
    if not available:
        log.warning("enso_forecast.csv has no fc_l* columns; the drought head loses its ENSO input")
        return np.zeros((T, leads), "float32")
    fc = frame[available].to_numpy("float32")
    if len(available) < leads:
        log.warning(
            "ENSO reaches %d leads but the drought head needs %d; carrying lead %d forward",
            len(available),
            leads,
            len(available),
        )
        fc = np.concatenate([fc, np.repeat(fc[:, -1:], leads - len(available), axis=1)], axis=1)
    if len(fc) != T:
        raise ValueError(
            f"enso_forecast.csv has {len(fc)} rows but fields have {T} months; retrain ENSO first"
        )
    return fc


def build_features(paths: DataPaths, cfg: PipelineConfig = DEFAULT_CONFIG) -> dict:
    """Step 2: compute SPI-3, VCI, anomalies and Sc-PDSI; save fields.npz; report the splits."""
    from ai_drews.analysis.teleconnection import enso_drought_correlation
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
        corr_nino_spi=round(float(np.corrcoef(F["nino"][2:], tm_channel(F, "spi")[2:])[0, 1]), 2),
    )

    # Fig. 5 of the study: how closely ENSO tracks drought here, and at what lead time.
    has_pdsi = "pdsi" in F
    teleconnection = enso_drought_correlation(
        F["nino"],
        F["pdsi"] if has_pdsi else F["spi"],
        index_name="scpdsi" if has_pdsi else "spi",
    )
    teleconnection.to_frame().to_csv(paths.outputs / "enso_drought_correlation.csv", index=False)
    summary["scpdsi"] = "computed" if has_pdsi else "unavailable (no tmean in raw data)"
    summary["teleconnection"] = {
        "index": teleconnection.index,
        "r_at_lag_0": teleconnection.correlation_at_lag_0,
        "best_lag_months": teleconnection.best_lag_months,
        "r_at_best_lag": teleconnection.best_correlation,
    }
    log.info("features built: %s", summary)
    return summary
