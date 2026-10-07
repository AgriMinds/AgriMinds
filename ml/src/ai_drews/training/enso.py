"""Step 3 (Objective 1): CNN-LSTM Nino3.4 forecasting vs persistence and Ridge baselines."""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd
import torch
from sklearn.linear_model import Ridge

from ai_drews.config import DEFAULT_CONFIG, DataPaths, PipelineConfig
from ai_drews.features.fields import load_fields
from ai_drews.models import CNNLSTM
from ai_drews.training.trainer import fit, make_loader, predict, set_seed

log = logging.getLogger(__name__)


def train_enso(paths: DataPaths, cfg: PipelineConfig = DEFAULT_CONFIG, plot: bool = True) -> pd.DataFrame:
    set_seed(cfg.seed)
    paths.ensure()
    F = load_fields(paths)
    X_all, nino = F["nino_all"], F["nino"]
    d = pd.to_datetime(F["dates"])
    T = len(d)
    L = cfg.enso_leads
    t = np.arange(cfg.window - 1, T - L)
    tr = t[d[t] <= cfg.train_end]
    va = t[(d[t] > cfg.train_end) & (d[t] <= cfg.val_end)]
    te = t[d[t] > cfg.val_end]

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

    yt = inv(make_y(te))
    ridge = Ridge(alpha=10).fit(make_x(tr).reshape(len(tr), -1), make_y(tr))
    preds = {
        "CNN-LSTM": inv(predict(model, make_x(te))),
        "Persistence": np.repeat(nino[te][:, None], L, 1),
        "Ridge": inv(ridge.predict(make_x(te).reshape(len(te), -1))),
    }
    rows = []
    for name, p in preds.items():
        for lead in range(L):
            rows.append(
                dict(
                    model=name,
                    lead=lead + 1,
                    RMSE=np.sqrt(np.mean((p[:, lead] - yt[:, lead]) ** 2)),
                    MAE=np.mean(np.abs(p[:, lead] - yt[:, lead])),
                    corr=np.corrcoef(p[:, lead], yt[:, lead])[0, 1],
                )
            )
    metrics = pd.DataFrame(rows).round(3)
    metrics.to_csv(paths.outputs / "enso_metrics.csv", index=False)
    log.info("ENSO RMSE by lead:\n%s", metrics.pivot(index="lead", columns="model", values="RMSE"))

    # Forecasts for every month (consumed by the drought model); first WINDOW-1 months stay 0.
    # NOTE: forecasts for training years are in-sample and therefore optimistic (see README).
    fc = np.zeros((T, L), "float32")
    allt = np.arange(cfg.window - 1, T)
    fc[allt] = inv(predict(model, make_x(allt)))
    pd.DataFrame(fc, columns=[f"fc_l{i + 1}" for i in range(L)]).assign(date=d).to_csv(
        paths.enso_forecast_csv, index=False
    )
    torch.save(model.state_dict(), paths.enso_model_pt)
    np.savez(paths.enso_norm_npz, mu=mu, sd=sd)

    if plot:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        plt.figure(figsize=(9, 3))
        plt.plot(d[te], nino[te], "k", label="observed")
        plt.plot(d[te], preds["CNN-LSTM"][:, min(2, L - 1)], "r", label="CNN-LSTM, 3-mo lead")
        plt.legend()
        plt.title("Nino3.4 test period")
        plt.tight_layout()
        plt.savefig(paths.outputs / "enso_test.png", dpi=120)
        plt.close()
    return metrics
