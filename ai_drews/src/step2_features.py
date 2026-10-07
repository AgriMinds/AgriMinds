"""STEP 2 (Month 1-2): quality-controlled features: SPI-3, VCI, anomalies, Fourier inputs."""
import numpy as np
from data_io import load_raw
from features import compute_fields, save_fields, make_labels, split_idx
from config import *

ind, g = load_raw()
F = compute_fields(ind, g); save_fields(F)
tr, va, te = split_idx(F, DROUGHT_LEADS)
y = make_labels(F, tr)
print("fields saved ->", PROC / "fields.npz")
print(f"samples  train {len(tr)} | val {len(va)} | test {len(te)}")
print("drought base rate (SPI-3 <= -1) per lead, train:", [round(float(y[:, l].mean()), 3) for l in range(DROUGHT_LEADS)])
print("corr(Nino3.4, basin SPI-3):", round(float(np.corrcoef(F['nino'][2:], F['TF'][2:, 4])[0, 1]), 2))
