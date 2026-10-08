# ai-drews (ML package)

PyTorch pipeline behind AgriMinds: 1990-2026 climate data -> CNN-LSTM ENSO forecast ->
SuperHybrid (CNN-2D + LSTM + Fourier) drought probability -> risk maps -> advisory rules.

```
src/ai_drews/
├── config.py          PipelineConfig (hyper-parameters) and DataPaths (where files live)
├── data/              synthetic stand-in data, raw I/O               (step 1)
├── features/          SPI-3, VCI, anomalies, Fourier inputs, splits  (step 2)
│   ├── pet.py         Thornthwaite potential evapotranspiration
│   └── pdsi.py        self-calibrated Palmer Drought Severity Index
├── analysis/          ENSO-drought correlation by lag (Fig. 5), climate-scenario outlook
├── data/cmip6.py      reads CMIP6 monthly projections (ScenarioMIP NetCDF)
├── models/            CNNLSTM (Objective 1), SuperHybrid (Objective 2)
├── training/          trainer loop, train_enso (3), train_drought (4), render_risk_maps (5)
├── inference.py       load_artifacts() / predict_risk() used by the API
├── advisory/
│   ├── rules.py       Objective 3: risk levels, seasons, crop rules (single source of truth)
│   └── classification.py  Table 2: five ENSO bands, seven Sc-PDSI bands, with citations
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

## Climate scenarios (separate from the forecast)

```bash
pip install -e "ml[scenarios]"
ai-drews scenario path/to/ssp585_monthly.nc        # defaults to the Amhara region
```

This reads a CMIP6 ScenarioMIP file and reports how drought intensity drifts over decades, writing
`data/outputs/scenario_<model>_<experiment>.{csv,json}`. It is **not** the operational forecast and
is kept out of the training pipeline on purpose:

- A scenario run is a simulation of a possible future, not a record of what happened. Fitting the
  short-range drought model to it would produce an operational-looking forecast with no
  observational basis, so `load_projection` writes nothing into `data/raw/` and stamps every
  result `is_projection=True`.
- These grids are coarse. CanESM5 runs at about 2.8 degrees, roughly 310 km per cell, while the
  Choke watershed is about 88 km across — a fraction of one cell. `RegionFootprint` reports how
  many cell centres actually fall inside the area requested and warns when the answer is none, so
  results are never presented at a resolution the data cannot support.
- Sc-PDSI is calibrated on the opening decades, so later values are expressed relative to that
  earlier climate. Once the climate shifts well beyond the baseline the index saturates near the
  ends of its scale; that is the index working as designed, not an error.

Inside Docker Compose: `docker compose run --rm backend ai-drews run-all`.

## Plugging in real data (monthly, same grid for all layers)

- `data/raw/nino_indices.csv` : `date,nino34,nino12,nino4,soi` (NOAA ONI / Nino indices, SOI)
- `data/raw/grids.npz` : `rain` (CHIRPS), `tmax` (ERA5), `soilm` (ERA5), `ndvi` (MODIS), each `(T,H,W)`,
  plus `dates` as `YYYY-MM-DD` strings. Resample everything to one grid (e.g. CHIRPS 0.05 deg) first.
  Optional `tmean` (ERA5 monthly mean temperature, °C) enables Sc-PDSI. Without it the index is
  **skipped rather than estimated from the maxima**, because deriving it would bias every
  classification downstream.
- Edit `grid`, `bbox` and the split dates in `PipelineConfig`.

## Drought indices

Two indices answer two different questions, and the platform never mixes them:

| Index | Question | Where it comes from |
|---|---|---|
| `P(SPI-3 ≤ −1)` | How likely is seasonal drought in 1–3 months? | the SuperHybrid model's forecast |
| Sc-PDSI | How dry is the ground right now? | a water balance over the observed record |

Sc-PDSI follows Palmer (1965): Thornthwaite PET, a two-layer soil water balance, CAFEC
precipitation, the Z moisture anomaly and the severity recursion. Two deliberate decisions:

- **Self-calibration** rescales the two tails so the training period's 2nd and 98th percentiles
  land on −4 and +4, which is the property Table 2's bands depend on. It is not Wells et al.
  (2004) duration-factor refitting, and every response that carries the index says so.
- **The CAFEC coefficients are clipped to [0, 1].** Three are bounded by construction; runoff is
  not, because in a monsoon month the excess rain that runs off can exceed the water Palmer
  counts as available to run off. Left unclipped, γ reaches about 1.13 over the Kiremt peak and
  the index inverts — a wetter record scores drier. This is a documented weakness of Palmer's
  formulation in strongly seasonal climates, not a tuning knob.

Palmer worked in inches and the constants of his climatic characteristic K are calibrated for
that unit, so the moisture anomaly is computed in inches internally.

## Known limits

- Synthetic data only checks that the code runs; real skill must be measured on real data (`data/outputs/*_metrics.csv`).
- ENSO forecasts feeding the drought model are in-sample for the training years (optimistic). Use cross-fitted forecasts later.
- Advisory rules are placeholders to co-design with farmers and experts; `RULES_VERSION` tracks changes.
- Artifacts are tracked in git while small. Move `data/` to DVC or Git LFS before adding real CHIRPS/ERA5 cubes.

## Tests

```bash
pytest ml/tests
```
