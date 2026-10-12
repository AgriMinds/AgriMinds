"""Step 3 (Objective 1): Niño 3.4 forecasting, scored against persistence and Ridge baselines.

Two things here are deliberate and were not in the first version of this module.

**The forecaster trains on its own record, not on the intersection.** Objective 1 predicts Niño
3.4 from the climate indices alone — it never touches the gridded fields. Loading its training
data from ``fields.npz`` therefore cost it every month the gridded sources do not cover: ERA5
here begins in 2000 and NOAA in 1948, which left a 17k-parameter network with 157 training
samples and a model that lost to persistence at all twelve leads. It now reads the full observed
ENSO record and falls back to the intersection only when that record is absent (synthetic runs).

**A lead is published from whichever candidate won on validation.** A deep model that cannot beat
"tomorrow looks like today" has nothing to add, and feeding its output to the drought head would
degrade a model that is scored separately. The choice is made on the validation window, never on
the test window, and is recorded per lead in ``enso_meta.json`` so a forecast can be traced to
the estimator that produced it.
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime

import numpy as np
import pandas as pd
import torch
from sklearn.linear_model import Ridge

from ai_drews import __version__
from ai_drews.config import DEFAULT_CONFIG, DataPaths, PipelineConfig
from ai_drews.features.fields import load_fields
from ai_drews.models import CNNLSTM
from ai_drews.training.trainer import fit, make_loader, predict, set_seed

log = logging.getLogger(__name__)

#: Columns the forecaster reads, in the order the saved ``state_dict`` expects.
ENSO_COLS = ("nino34", "nino12", "nino4", "soi")

MODEL_VERSION = "enso-cnnlstm-0.2.0"

#: Name of the estimator used when nothing beat the naive baseline on validation.
PERSISTENCE = "Persistence"

#: Fraction of validation RMSE a challenger must cut off persistence before it is published.
#: A bare `argmin` over candidates looks principled and is not: on a short validation window the
#: winner is often noise, and a challenger that wins validation by a hair can lose test by 3x.
#: Persistence is therefore the default and has to be clearly beaten, the same stance the drought
#: head takes with ``MIN_SKILFUL_BSS``.
MIN_BASELINE_GAIN = 0.05

#: Validation origins required before a challenger may be chosen at all. Below this the ranking
#: is noise: on a 12-sample window Ridge won validation by 6-33% and then lost test by up to 3x.
#: Too little evidence to choose is a reason to keep the baseline, not to choose anyway.
MIN_VALIDATION_SAMPLES = 30


def _longest_contiguous_months(frame: pd.DataFrame) -> pd.DataFrame:
    """The longest run of consecutive months, so a gap cannot be windowed across silently."""
    dates = pd.DatetimeIndex(frame["date"])
    step = dates.to_period("M").astype("int64")
    breaks = np.flatnonzero(np.diff(step) != 1) + 1
    runs = np.split(np.arange(len(frame)), breaks)
    keep = max(runs, key=len)
    if len(keep) < len(frame):
        log.warning(
            "ENSO record has gaps; keeping the longest contiguous run (%d of %d months)",
            len(keep),
            len(frame),
        )
    return frame.iloc[keep].reset_index(drop=True)


def load_enso_record(paths: DataPaths) -> tuple[pd.DatetimeIndex, np.ndarray, str]:
    """(dates, features, provenance) for the longest observed ENSO record available.

    Prefers the raw NOAA table over ``fields.npz``: the latter is intersected with the gridded
    sources, which this objective does not use.
    """
    source = paths.raw / "sources" / "nino34.csv"
    if source.exists():
        frame = pd.read_csv(source, parse_dates=["date"]).sort_values("date")
        have = [c for c in ENSO_COLS if c in frame.columns]
        if have:
            frame = frame.dropna(subset=have).reset_index(drop=True)
            if len(frame) > 0:
                frame = _longest_contiguous_months(frame)
                return pd.DatetimeIndex(frame["date"]), frame[have].to_numpy("float32"), "noaa-full-record"
        log.warning("%s has no usable ENSO columns; falling back to the field intersection", source)

    fields = load_fields(paths)
    return pd.to_datetime(fields["dates"]), np.asarray(fields["nino_all"], "float32"), "field-intersection"


def _scorecard(truth: np.ndarray, preds: dict[str, np.ndarray], leads: int) -> pd.DataFrame:
    rows = []
    for name, p in preds.items():
        for lead in range(leads):
            a, b = p[:, lead], truth[:, lead]
            rows.append(
                dict(
                    model=name,
                    lead=lead + 1,
                    RMSE=float(np.sqrt(np.mean((a - b) ** 2))),
                    MAE=float(np.mean(np.abs(a - b))),
                    corr=float(np.corrcoef(a, b)[0, 1]) if b.std() > 0 and a.std() > 0 else 0.0,
                )
            )
    return pd.DataFrame(rows)


def train_enso(paths: DataPaths, cfg: PipelineConfig = DEFAULT_CONFIG, plot: bool = True) -> pd.DataFrame:
    set_seed(cfg.seed)
    paths.ensure()

    dates, X_all, provenance = load_enso_record(paths)
    nino = X_all[:, 0]
    T, L = len(dates), cfg.enso_leads
    t = np.arange(cfg.window - 1, T - L)
    tr = t[dates[t] <= cfg.train_end]
    va = t[(dates[t] > cfg.train_end) & (dates[t] <= cfg.val_end)]
    te = t[dates[t] > cfg.val_end]
    if len(tr) == 0 or len(va) == 0:
        raise ValueError(
            f"ENSO record {dates[0].date()}..{dates[-1].date()} gives no train/validation split "
            f"for train_end={cfg.train_end}, val_end={cfg.val_end}"
        )
    log.info(
        "ENSO record %s..%s (%s): train=%d val=%d test=%d",
        dates[0].date(), dates[-1].date(), provenance, len(tr), len(va), len(te),
    )

    mu, sd = X_all[tr].mean(0), X_all[tr].std(0) + 1e-6
    Xn = (X_all - mu) / sd

    def make_x(ix):
        return np.stack([Xn[i - cfg.window + 1 : i + 1] for i in ix])

    def make_y(ix):
        return np.stack([(nino[i + 1 : i + 1 + L] - mu[0]) / sd[0] for i in ix])

    def inv(a):
        return a * sd[0] + mu[0]

    model = CNNLSTM(X_all.shape[1], L)
    model = fit(
        model,
        torch.nn.MSELoss(),
        make_loader([make_x(tr), make_y(tr)], cfg.batch_size, True),
        make_loader([make_x(va), make_y(va)], cfg.batch_size),
        cfg,
    )
    ridge = Ridge(alpha=10).fit(make_x(tr).reshape(len(tr), -1), make_y(tr))

    def candidates(ix: np.ndarray) -> dict[str, np.ndarray]:
        return {
            "CNN-LSTM": inv(predict(model, make_x(ix))),
            PERSISTENCE: np.repeat(nino[ix][:, None], L, 1),
            "Ridge": inv(ridge.predict(make_x(ix).reshape(len(ix), -1))),
        }

    # ---- selection on validation, scoring on test -----------------------------------------
    val_scores = _scorecard(inv(make_y(va)), candidates(va), L)
    val_rmse = val_scores.pivot(index="lead", columns="model", values="RMSE")
    can_select = len(va) >= MIN_VALIDATION_SAMPLES
    if not can_select:
        log.warning(
            "only %d validation origins (< %d): keeping persistence at every lead rather than "
            "selecting on noise",
            len(va),
            MIN_VALIDATION_SAMPLES,
        )
    chosen: dict[int, str] = {}
    gains: dict[int, float] = {}
    for lead in range(1, L + 1):
        naive = float(val_rmse.loc[lead, PERSISTENCE])
        challengers = val_rmse.loc[lead].drop(PERSISTENCE)
        name = str(challengers.idxmin())
        gain = (naive - float(challengers.min())) / naive if naive > 0 else 0.0
        gains[lead] = round(float(gain), 4)
        chosen[lead] = name if (can_select and gain >= MIN_BASELINE_GAIN) else PERSISTENCE

    test_preds = candidates(te)
    selected_test = np.column_stack([test_preds[chosen[lead + 1]][:, lead] for lead in range(L)])
    test_preds["Selected"] = selected_test
    metrics = _scorecard(inv(make_y(te)), test_preds, L).round(3)
    metrics.to_csv(paths.outputs / "enso_metrics.csv", index=False)
    val_scores.round(3).to_csv(paths.outputs / "enso_validation_metrics.csv", index=False)
    log.info("ENSO test RMSE by lead:\n%s", metrics.pivot(index="lead", columns="model", values="RMSE"))

    beat = sorted(int(lead) for lead, name in chosen.items() if name == "CNN-LSTM")
    if not beat:
        log.warning(
            "the CNN-LSTM did not win a single lead on validation; every published lead falls "
            "back to a baseline. Treat Objective 1 as unproven until this changes."
        )

    # ---- forecasts for every month of the field record ------------------------------------
    allt = np.arange(cfg.window - 1, T)
    all_preds = candidates(allt)
    fc_rows = np.column_stack([all_preds[chosen[lead + 1]][:, lead] for lead in range(L)])
    forecast = pd.DataFrame(fc_rows, columns=[f"fc_l{i + 1}" for i in range(L)])
    forecast.insert(0, "date", dates[allt])

    field_dates = pd.to_datetime(load_fields(paths)["dates"]) if paths.fields_npz.exists() else dates
    aligned = (
        forecast.set_index("date")
        .reindex(field_dates)
        .fillna(0.0)
        .reset_index(names="date")
    )
    missing = int(aligned[[f"fc_l{i + 1}" for i in range(L)]].eq(0.0).all(axis=1).sum())
    if missing:
        log.warning("%d field months have no ENSO origin and were zero-filled", missing)
    aligned.to_csv(paths.enso_forecast_csv, index=False)

    torch.save(model.state_dict(), paths.enso_model_pt)
    np.savez(paths.enso_norm_npz, mu=mu, sd=sd)
    (paths.models / "enso_meta.json").write_text(
        json.dumps(
            {
                "model_version": MODEL_VERSION,
                "package_version": __version__,
                "trained_at": datetime.now(UTC).isoformat(),
                "data_source": provenance,
                "record_start": str(dates[0].date()),
                "record_end": str(dates[-1].date()),
                "n_features": int(X_all.shape[1]),
                "leads": L,
                "samples": {"train": len(tr), "val": len(va), "test": len(te)},
                "selection_rule": (
                    f"persistence unless a challenger cuts validation RMSE by "
                    f">= {MIN_BASELINE_GAIN:.0%}"
                ),
                "min_baseline_gain": MIN_BASELINE_GAIN,
                "min_validation_samples": MIN_VALIDATION_SAMPLES,
                "selection_ran": bool(can_select),
                "selected_per_lead": {str(k): v for k, v in sorted(chosen.items())},
                "validation_gain_over_persistence": {str(k): v for k, v in sorted(gains.items())},
                "cnn_lstm_wins_leads": beat,
                "test_metrics": metrics.to_dict("records"),
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    if plot:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        lead = min(2, L - 1)
        plt.figure(figsize=(9, 3))
        plt.plot(dates[te], nino[te], "k", label="observed")
        plt.plot(dates[te], selected_test[:, lead], "r",
                 label=f"selected, {lead + 1}-mo lead ({chosen[lead + 1]})")
        plt.legend()
        plt.title("Nino3.4 test period")
        plt.tight_layout()
        plt.savefig(paths.outputs / "enso_test.png", dpi=120)
        plt.close()
    return metrics
