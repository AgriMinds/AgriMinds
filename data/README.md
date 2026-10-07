# data/

| folder       | contents                                            | produced by              |
|--------------|-----------------------------------------------------|--------------------------|
| `raw/`       | `nino_indices.csv`, `grids.npz` (real or SYNTHETIC) | `ai-drews build-data`    |
| `processed/` | `fields.npz`, `enso_forecast.csv`                   | `build-features`, `train enso` |
| `models/`    | `drought_model.pt`, `drought_norm.npz`, `drought_meta.json`, `enso_cnnlstm.pt`, `enso_norm.npz` | `train enso`, `train drought` |
| `outputs/`   | metrics CSVs, `latest_risk.npz`, PNG maps           | training steps, `maps`   |

The committed artifacts were trained on **synthetic** data (`drought_meta.json` -> `data_source`).
The API reports `data_source` and `model_version` in every response so nobody mistakes them for real forecasts.

Tracked in git while small (<5 MB). Move to DVC / Git LFS before real CHIRPS / ERA5 cubes land here.
