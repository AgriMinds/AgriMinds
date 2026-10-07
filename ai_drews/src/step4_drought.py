"""STEP 4 (Month 4, Objective 2): super-hybrid CNN-LSTM-Fourier drought probability model (1-3 month leads)."""
import json, numpy as np, pandas as pd, torch
from sklearn.metrics import roc_auc_score, brier_score_loss, f1_score
from config import *
from features import *
from models import SuperHybrid
from utils import set_seed, loader, fit, predict

set_seed()
F = load_fields(); fc = load_enso_fc(len(F["dates"]))
tr, va, te = split_idx(F, DROUGHT_LEADS)
raw = {k: make_inputs(F, ix, fc) for k, ix in (("tr", tr), ("va", va), ("te", te))}
norm = fit_norm(*raw["tr"])                                   # statistics from TRAIN only
X = {k: apply_norm(norm, *v) for k, v in raw.items()}
Y = {k: make_labels(F, ix) for k, ix in (("tr", tr), ("va", va), ("te", te))}
H, W = GRID

model = SuperHybrid(X["tr"][0].shape[1], X["tr"][1].shape[2], X["tr"][2].shape[1], DROUGHT_LEADS)
model = fit(model, torch.nn.BCEWithLogitsLoss(), loader([*X["tr"], Y["tr"]], True), loader([*X["va"], Y["va"]]))
P = {k: 1 / (1 + np.exp(-predict(model, *X[k]))) for k in ("va", "te")}

rows, thr = [], []
for l in range(DROUGHT_LEADS):
    # decision threshold tuned on validation (max F1), reported on test
    cands = np.arange(0.05, 0.96, 0.05)
    th = float(cands[np.argmax([f1_score(Y["va"][:, l].ravel(), P["va"][:, l].ravel() > c) for c in cands])]); thr.append(th)
    yt, pt = Y["te"][:, l].ravel(), P["te"][:, l].ravel()
    base = Y["tr"][:, l].mean(); pers = (F["spi"][te] <= SPI_DROUGHT).ravel().astype(float)
    hit = (pt > th) & (yt == 1); fa = (pt > th) & (yt == 0)
    rows.append(dict(lead=l + 1, AUC=roc_auc_score(yt, pt), AUC_persistence=roc_auc_score(yt, pers),
                     Brier=brier_score_loss(yt, pt), BSS_vs_climatology=1 - brier_score_loss(yt, pt) / brier_score_loss(yt, np.full_like(pt, base)),
                     POD=hit.sum() / max(yt.sum(), 1), FAR=fa.sum() / max((pt > th).sum(), 1), threshold=th))
M = pd.DataFrame(rows).round(3); M.to_csv(OUT / "drought_metrics.csv", index=False); print(M.to_string(index=False))

torch.save(model.state_dict(), MODELS / "drought_model.pt")
np.savez(MODELS / "drought_norm.npz", **norm)
json.dump(dict(c_sp=X["tr"][0].shape[1], f_t=X["tr"][1].shape[2], f_p=X["tr"][2].shape[1],
               n_leads=DROUGHT_LEADS, thresholds=thr), open(MODELS / "drought_meta.json", "w"))
print("saved drought model")
