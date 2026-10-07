"""STEP 3 (Months 2-3, Objective 1): CNN-LSTM Nino3.4 forecasting vs persistence and Ridge baselines."""
import numpy as np, pandas as pd, torch
from sklearn.linear_model import Ridge
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
from config import *
from features import load_fields
from models import CNNLSTM
from utils import set_seed, loader, fit, predict

set_seed()
F = load_fields(); X_all = F["nino_all"]; nino = F["nino"]; d = pd.to_datetime(F["dates"]); T = len(d)
t = np.arange(WINDOW - 1, T - ENSO_LEADS)
tr, va, te = t[d[t] <= TRAIN_END], t[(d[t] > TRAIN_END) & (d[t] <= VAL_END)], t[d[t] > VAL_END]

mu, sd = X_all[tr].mean(0), X_all[tr].std(0) + 1e-6
Xn = (X_all - mu) / sd
make_x = lambda ix: np.stack([Xn[i - WINDOW + 1:i + 1] for i in ix])
make_y = lambda ix: np.stack([(nino[i + 1:i + 1 + ENSO_LEADS] - mu[0]) / sd[0] for i in ix])
inv = lambda a: a * sd[0] + mu[0]

model = CNNLSTM(X_all.shape[1], ENSO_LEADS)
model = fit(model, torch.nn.MSELoss(), loader([make_x(tr), make_y(tr)], True), loader([make_x(va), make_y(va)]))

yt = inv(make_y(te))
preds = {"CNN-LSTM": inv(predict(model, make_x(te))),
         "Persistence": np.repeat(nino[te][:, None], ENSO_LEADS, 1),
         "Ridge": inv(Ridge(alpha=10).fit(make_x(tr).reshape(len(tr), -1), make_y(tr))
                      .predict(make_x(te).reshape(len(te), -1)))}
rows = []
for name, p in preds.items():
    for l in range(ENSO_LEADS):
        rows.append(dict(model=name, lead=l + 1, RMSE=np.sqrt(np.mean((p[:, l] - yt[:, l]) ** 2)),
                         MAE=np.mean(np.abs(p[:, l] - yt[:, l])), corr=np.corrcoef(p[:, l], yt[:, l])[0, 1]))
M = pd.DataFrame(rows).round(3); M.to_csv(OUT / "enso_metrics.csv", index=False)
print(M.pivot(index="lead", columns="model", values="RMSE").assign(metric="RMSE"))
print(M.pivot(index="lead", columns="model", values="corr").assign(metric="corr"))

# Forecasts for every month (consumed by the drought model); first WINDOW-1 months stay 0
fc = np.zeros((T, ENSO_LEADS), "float32"); allt = np.arange(WINDOW - 1, T)
fc[allt] = inv(predict(model, make_x(allt)))
pd.DataFrame(fc, columns=[f"fc_l{i + 1}" for i in range(ENSO_LEADS)]).assign(date=d).to_csv(PROC / "enso_forecast.csv", index=False)
torch.save(model.state_dict(), MODELS / "enso_cnnlstm.pt")
np.savez(MODELS / "enso_norm.npz", mu=mu, sd=sd)

plt.figure(figsize=(9, 3)); plt.plot(d[te], nino[te], "k", label="observed")
plt.plot(d[te], preds["CNN-LSTM"][:, 2], "r", label="CNN-LSTM, 3-mo lead"); plt.legend(); plt.title("Nino3.4 test period")
plt.tight_layout(); plt.savefig(OUT / "enso_test.png", dpi=120)
print("saved model, metrics, forecasts")
