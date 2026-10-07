"""Central settings for AI-DREWS (Choke Watershed MVP)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW, PROC = ROOT / "data" / "raw", ROOT / "data" / "processed"
MODELS, OUT = ROOT / "models", ROOT / "outputs"
for p in (RAW, PROC, MODELS, OUT):
    p.mkdir(parents=True, exist_ok=True)

START, END = "1990-01-01", "2026-06-01"   # monthly record
GRID = (8, 8)                             # watershed cells (rows, cols); set to your real grid
BBOX = (37.6, 10.4, 38.4, 11.2)           # PLACEHOLDER lon_min, lat_min, lon_max, lat_max -> replace with Choke bounds

WINDOW = 12          # months of history fed to the networks
ENSO_LEADS = 6       # Objective 1: Nino3.4 forecast horizon (months)
DROUGHT_LEADS = 3    # Objective 2: drought probability horizon (months)
SPI_SCALE = 3        # SPI-3 (seasonal drought)
SPI_DROUGHT = -1.0   # SPI <= -1  -> drought event

TRAIN_END, VAL_END = "2013-12-01", "2018-12-01"   # chronological split (test = after VAL_END)
SEED = 42
BATCH, EPOCHS, PATIENCE, LR = 32, 150, 15, 1e-3
