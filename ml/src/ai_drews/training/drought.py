"""Step 4 (Objective 2): SuperHybrid CNN-LSTM-Fourier drought probability model (1-3 month leads)."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime

import numpy as np
import pandas as pd
import torch
from sklearn.metrics import brier_score_loss, f1_score, roc_auc_score

from ai_drews import __version__
from ai_drews.advisory.classification import MIN_SKILFUL_BSS, is_skilful, skilful_leads
from ai_drews.config import DEFAULT_CONFIG, DataPaths, PipelineConfig
from ai_drews.features.fields import load_enso_fc, load_fields
from ai_drews.features.windows import apply_norm, fit_norm, make_inputs, make_labels, split_idx
from ai_drews.models import SuperHybrid
from ai_drews.training.trainer import fit, make_loader, predict, set_seed

log = logging.getLogger(__name__)


def train_drought(
    paths: DataPaths, cfg: PipelineConfig = DEFAULT_CONFIG, data_source: str = "unknown"
) -> pd.DataFrame:
    set_seed(cfg.seed)
    paths.ensure()
    F = load_fields(paths)
    fc = load_enso_fc(paths, len(F["dates"]), cfg.drought_leads)
    tr, va, te = split_idx(F, cfg.drought_leads, cfg)
    raw = {k: make_inputs(F, ix, fc, cfg) for k, ix in (("tr", tr), ("va", va), ("te", te))}
    norm = fit_norm(*raw["tr"])  # statistics from TRAIN only
    X = {k: apply_norm(norm, *v) for k, v in raw.items()}
    Y = {k: make_labels(F, ix, cfg) for k, ix in (("tr", tr), ("va", va), ("te", te))}

    model = SuperHybrid(X["tr"][0].shape[1], X["tr"][1].shape[2], X["tr"][2].shape[1], cfg.drought_leads)
    model = fit(
        model,
        torch.nn.BCEWithLogitsLoss(),
        make_loader([*X["tr"], Y["tr"]], cfg.batch_size, True),
        make_loader([*X["va"], Y["va"]], cfg.batch_size),
        cfg,
    )
    P = {k: 1 / (1 + np.exp(-predict(model, *X[k]))) for k in ("va", "te")}

    rows, thresholds = [], []
    for lead in range(cfg.drought_leads):
        # decision threshold tuned on validation (max F1), reported on test
        cands = np.arange(0.05, 0.96, 0.05)
        f1s = [f1_score(Y["va"][:, lead].ravel(), P["va"][:, lead].ravel() > c) for c in cands]
        th = float(cands[int(np.argmax(f1s))])
        thresholds.append(th)
        yt, pt = Y["te"][:, lead].ravel(), P["te"][:, lead].ravel()
        base = Y["tr"][:, lead].mean()
        pers = (F["spi"][te] <= cfg.spi_drought).ravel().astype(float)
        hit = (pt > th) & (yt == 1)
        fa = (pt > th) & (yt == 0)
        clim = brier_score_loss(yt, np.full_like(pt, base))
        rows.append(
            dict(
                lead=lead + 1,
                AUC=roc_auc_score(yt, pt),
                AUC_persistence=roc_auc_score(yt, pers),
                Brier=brier_score_loss(yt, pt),
                BSS_vs_climatology=1 - brier_score_loss(yt, pt) / clim,
                POD=hit.sum() / max(yt.sum(), 1),
                FAR=fa.sum() / max((pt > th).sum(), 1),
                threshold=th,
            )
        )
    metrics = pd.DataFrame(rows).round(3)
    # Whether each lead earned the right to be published as a probability. Recorded here, at the
    # only point where it is actually measured, so no consumer has to re-derive it.
    metrics["skilful"] = metrics["BSS_vs_climatology"].map(is_skilful)
    metrics.to_csv(paths.outputs / "drought_metrics.csv", index=False)
    log.info("drought metrics:\n%s", metrics.to_string(index=False))
    earned = skilful_leads(metrics.to_dict(orient="records"))
    log.info(
        "leads published as a forecast: %s (of %d trained); the rest are served as a seasonal outlook",
        earned or "none",
        cfg.drought_leads,
    )

    torch.save(model.state_dict(), paths.drought_model_pt)
    np.savez(paths.drought_norm_npz, **norm)
    meta = dict(
        c_sp=int(X["tr"][0].shape[1]),
        f_t=int(X["tr"][1].shape[2]),
        f_p=int(X["tr"][2].shape[1]),
        n_leads=cfg.drought_leads,
        skilful_leads=skilful_leads(metrics.to_dict(orient="records")),
        min_skilful_bss=MIN_SKILFUL_BSS,
        thresholds=thresholds,
        model_version=f"superhybrid-{__version__}",
        trained_at=datetime.now(UTC).isoformat(timespec="seconds"),
        training_data_end=str(F["dates"][-1]),
        data_source=data_source,
        metrics=metrics.to_dict(orient="records"),
    )
    paths.drought_meta_json.write_text(json.dumps(meta, indent=2))
    log.info("saved drought model %s", meta["model_version"])
    return metrics
