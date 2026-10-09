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
├── geo/watershed.py   surveyed catchment: shapefile -> GeoJSON, containment, grid masking
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
ai-drews ingest all               # step 0: download the observed record (see below)
ai-drews build-data               # step 1: observed files in data/raw/ if present, else SYNTHETIC
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

## Real data

`ai-drews ingest all` downloads the study's inputs. Every source is public and needs **no
credentials**, so a fresh clone can reach real observations without an account anywhere.

| source | provider | route | typical size |
|---|---|---|---|
| Niño 3.4, Niño 1+2, Niño 4, SOI | NOAA PSL (ERSST v6) | fixed-width tables | seconds |
| Temperature, rainfall, soil moisture, evaporation | ERA5 (ECMWF) | Open-Meteo archive | ~2 min, rate-limited |
| Rainfall for validation | CHIRPS v2.0 | SERVIR ClimateSERV zonal means | ~2 min |
| Crop area, yield, production | FAOSTAT (Ethiopia's official statistics) | bulk CSV | seconds |
| Greenness (opt-in, not in `all`) | MODIS MOD13Q1 | ORNL DAAC | **hours** — see below |

```bash
ai-drews ingest all             # every quick source, then assemble the pipeline inputs
ai-drews ingest era5            # or one at a time
ai-drews ingest assemble        # rebuild grids.npz from what is already cached
ai-drews ingest ndvi            # opt-in: MODIS greenness, hours rather than minutes
ai-drews data-sources           # what this deployment is currently running on
```

Each connector writes a tidy table to `data/raw/sources/` and a manifest to
`data/raw/manifests/`. **Provenance comes from the manifest, never from a file existing** — the
synthetic generator writes to the same paths, so without the manifest a second run would load its
own stand-in data and stamp the model "real".

`assemble` intersects the sources on the months all of them observed and writes:

- `data/raw/nino_indices.csv` : `date,nino34,nino12,nino4,soi`
- `data/raw/grids.npz` : `rain`, `tmax`, `tmean`, `soilm`, `pet_fao` (ERA5) and `ndvi` (MODIS,
  when present), each `(T,H,W)`, plus `dates` as `YYYY-MM-DD` strings.

`tmean` enables Sc-PDSI. Without it the index is **skipped rather than estimated from the
maxima**, because deriving it would bias every classification downstream. `ndvi` is optional for a
different reason: no source the study names supplies a vegetation index, and MODIS is the one
input that cannot be fetched quickly — the DAAC caps a request at ten composites and extracts
each one on demand, so a full grid takes hours rather than minutes. It is therefore **left out of
`ingest all`** and requested by name. Without it, VCI and the greenness channels are simply
absent, `assemble` skips them, and the model trains on the remaining channels.

Rate limits are real. The Open-Meteo archive meters by data volume per hour, and one full grid is
close to the free hourly allowance: if a run stops with `429`, wait for the next hour rather than
retrying immediately.

To change the grid or the record, edit `grid`, `bbox` and the split dates in `PipelineConfig`.

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
