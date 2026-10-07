"""STEP 1 (Month 1): build the AI-ready database. Uses real files if present, else synthetic data."""
from config import RAW
from data_io import make_synthetic, save_raw, load_raw

if (RAW / "nino_indices.csv").exists() and (RAW / "grids.npz").exists():
    ind, g = load_raw(); print("Using REAL data from data/raw/")
else:
    ind, g = make_synthetic(); save_raw(ind, g); print("No real data found -> wrote SYNTHETIC data to data/raw/")
print("months:", len(ind), "| grid:", g["rain"].shape[1:], "| vars: rain, tmax, soilm, ndvi")
print("missing values:", {k: int(__import__('numpy').isnan(v).sum()) for k, v in g.items() if k != "dates"})
