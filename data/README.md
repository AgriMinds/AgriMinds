# data/

| folder       | contents                                            | produced by              |
|--------------|-----------------------------------------------------|--------------------------|
| `raw/sources/` | one tidy CSV per downloaded source                | `ai-drews ingest <source>` |
| `raw/manifests/` | what was retrieved, from where, and when        | `ai-drews ingest <source>` |
| `raw/`       | `nino_indices.csv`, `grids.npz` (observed or SYNTHETIC) | `ai-drews ingest assemble`, `build-data` |
| `processed/` | `fields.npz`, `enso_forecast.csv`                   | `build-features`, `train enso` |
| `models/`    | `drought_model.pt`, `drought_norm.npz`, `drought_meta.json`, `enso_cnnlstm.pt`, `enso_norm.npz` | `train enso`, `train drought` |
| `outputs/`   | metrics CSVs, `enso_drought_correlation.csv`, `latest_risk.npz`, PNG maps | training steps, `maps` |

Whether `raw/` holds observations or stand-ins is recorded in `raw/manifests/dataset.json`, and
**only** there: the synthetic generator writes to the same filenames, so file existence proves
nothing. `drought_meta.json -> data_source` carries the answer into every API response, and both
clients show a banner, so nobody mistakes a demonstration for a forecast.

Run `make ingest` (or `ai-drews ingest all`) to replace the stand-ins with the real record. Every
source is public and needs no credentials; see `ml/README.md` for what each one is and how long it
takes.

Tracked in git while small (<5 MB). Move to DVC / Git LFS before real CHIRPS / ERA5 cubes land here.
