# ai-drews (ML package)

PyTorch pipeline behind AgriMinds: 1990-2026 climate data -> CNN-LSTM ENSO forecast ->
SuperHybrid (CNN-2D + LSTM + Fourier) drought probability -> risk maps -> advisory rules.

```
src/ai_drews/
├── config.py          PipelineConfig (hyper-parameters) and DataPaths (where files live)
├── data/              synthetic stand-in data, raw I/O               (step 1)
├── features/          SPI-3, VCI, anomalies, Fourier inputs, splits  (step 2)
├── models/            CNNLSTM (Objective 1), SuperHybrid (Objective 2)
├── training/          trainer loop, train_enso (3), train_drought (4), render_risk_maps (5)
├── inference.py       load_artifacts() / predict_risk() used by the API
├── advisory/rules.py  Objective 3: thresholds, ENSO phase, seasons, crop rules (single source of truth)
└── cli.py             `ai-drews` command
```

## Install

```bash
pip install -e "ml[dev]"          # from the repo root
```

## Run the pipeline

```bash
export AI_DREWS_DATA_DIR=./data   # default is ./data relative to the cwd
ai-drews build-data               # step 1: real files in data/raw/ if present, else SYNTHETIC
ai-drews build-features           # step 2
ai-drews train enso               # step 3 (Objective 1)
ai-drews train drought --data-source synthetic   # step 4 (Objective 2)
ai-drews maps                     # step 5 -> data/outputs/latest_risk.npz, risk_maps.png
ai-drews run-all                  # all of the above
```

Inside Docker Compose: `docker compose run --rm backend ai-drews run-all`.

## Plugging in real data (monthly, same grid for all layers)

- `data/raw/nino_indices.csv` : `date,nino34,nino12,nino4,soi` (NOAA ONI / Nino indices, SOI)
- `data/raw/grids.npz` : `rain` (CHIRPS), `tmax` (ERA5), `soilm` (ERA5), `ndvi` (MODIS), each `(T,H,W)`,
  plus `dates` as `YYYY-MM-DD` strings. Resample everything to one grid (e.g. CHIRPS 0.05 deg) first.
- Edit `grid`, `bbox` and the split dates in `PipelineConfig`.

## Known limits

- Synthetic data only checks that the code runs; real skill must be measured on real data (`data/outputs/*_metrics.csv`).
- ENSO forecasts feeding the drought model are in-sample for the training years (optimistic). Use cross-fitted forecasts later.
- Advisory rules are placeholders to co-design with farmers and experts; `RULES_VERSION` tracks changes.
- Artifacts are tracked in git while small. Move `data/` to DVC or Git LFS before adding real CHIRPS/ERA5 cubes.

## Tests

```bash
pytest ml/tests
```
