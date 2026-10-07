"""STEP 5 (Month 4-5): spatial drought-risk maps for the latest month."""
import numpy as np
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
import pandas as pd
from config import *
from inference import load_artifacts, risk_at

art = load_artifacts(); F = art["F"]; P = risk_at(art)
issue = pd.to_datetime(F["dates"][-1])
np.savez(OUT / "latest_risk.npz", probs=P, issued=str(issue.date()))
fig, ax = plt.subplots(1, DROUGHT_LEADS, figsize=(4 * DROUGHT_LEADS, 3.6))
for l, a in enumerate(ax):
    im = a.imshow(P[l], vmin=0, vmax=1, cmap="YlOrRd", extent=(BBOX[0], BBOX[2], BBOX[1], BBOX[3]))
    a.set_title(f"{(issue + pd.DateOffset(months=l + 1)).strftime('%b %Y')} (lead {l + 1})")
fig.colorbar(im, ax=ax, label="P(SPI-3 <= -1)"); plt.savefig(OUT / "risk_maps.png", dpi=130, bbox_inches="tight")
print("issued", issue.date(), "| basin-mean probability by lead:", P.mean((1, 2)).round(2))
