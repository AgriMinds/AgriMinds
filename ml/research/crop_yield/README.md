# crop_yield — Chokye_Water_Shield retrain

Tabular crop-yield model (Teff / Wheat / Maize × Lowland / Midland / Highland, 1990–2023)
downloaded from [`aykgeh/Chokye_Water_Shield`](https://huggingface.co/aykgeh/Chokye_Water_Shield)
(commit `d0584f7`) and retrained here on `climate-crop (2).xlsx`.

It is **not** part of the `ai-drews` pipeline: separate data, separate target, separate
artifact. The drought/ENSO forecast does not read from here, and training writes only its own
pair of files into `data/models/`.

## Layout

| path | what |
|---|---|
| `preprocess.py`, `train.py`, `predict.py` | upstream scripts, unmodified |
| `UPSTREAM_MODEL_CARD.md` | the Hugging Face model card as published |
| `run_training.py` | points the upstream scripts at the spreadsheet below, then publishes |
| `publish.py` | writes the servable artifact + metadata into `data/models/` |
| `data/climate-crop-v2.xlsx` | copy of `AgriMindCodeResource/climate-crop (2).xlsx` |
| `data/crop_climate_clean.csv` | long panel, 306 rows — written by this retrain |
| `data/upstream_crop_climate_clean.csv` | the panel published on Hugging Face |
| `models/best_crop_yield_model.joblib` | preprocessor + best regressor, this retrain |
| `models/metrics_summary.json` | all five candidates, this retrain |
| `models/upstream_metrics_summary.json` | the published metrics |
| `plots/*.png` | model comparison, actual vs predicted, MAE slices |

## Run

```bash
pip install -e "ml[crop-yield]"
python ml/research/crop_yield/run_training.py     # preprocess + train + plots + publish
python ml/research/crop_yield/predict.py          # El Niño vs Neutral scenario table
python ml/research/crop_yield/publish.py          # re-publish without retraining
```

`predict.py` resolves `models/` and `data/` relative to its own directory, so it picks up the
retrained artifact with no arguments.

## How the platform serves it

Training publishes two files to the shared data root — `data/models/crop_yield_model.joblib` and
`crop_yield_meta.json` — and `ai_drews.crop_yield.load_crop_yield_model()` reads them. The
metadata is what makes the model servable without shipping the training panel: `yield_lag1` and
`yield_rolling3_mean` are *features*, so a request for next season has to supply them, and they
come from the end of each crop-zone series recorded there, along with the last observed climate,
the belt altitudes, every candidate's score, the gain-weighted feature importance and the caveats.

| layer | what it adds |
|---|---|
| `ml/src/ai_drews/crop_yield.py` | loads the artifact, fills unnamed inputs from the last observed season, predicts |
| `backend/.../services/crop_yield.py` | borrows Niño 3.4 from the drought pipeline's ENSO forecast; **503** with no artifact |
| `GET /api/v1/crop-yield/outlook` | all nine crop-belt cells, each with its ENSO-neutral counterpart and its inputs |
| `POST /api/v1/crop-yield/simulate` | one cell under named climate inputs |
| `GET /api/v1/crop-yield/model` | candidate scores, feature importance, caveats |
| `/crop-yield` (web, staff only) | the yield matrix, the ENSO term on its own, and the model's limits |

xgboost is an extra, not a core dependency, because `joblib.load` has to reconstruct the fitted
estimator. An API deployment without it logs the reason at startup and answers 503 on these three
endpoints while serving everything else — the web page then shows its "model unavailable" state.

The farmer app is deliberately **not** wired to this: these are belt-wide averages and the climate
term moves them by a couple of percent, which is not something a smallholder can act on.

## What the retrain showed

**The spreadsheet is the one the published model was already fitted on.** `climate-crop (2).xlsx`
differs from `climate-crop.xlsx` in two ENSO values only (2010: −0.175 → −0.975, which flips that
year from Neutral to La Niña; 2022: −0.975 → −2.975), and the panel built from it matches
`upstream_crop_climate_clean.csv` in every column of all 306 rows. So this is a reproduction, not
a new fit, and the remaining metric drift is library versions (xgboost 3.4.1, scikit-learn 1.9.1):

| model | published test RMSE | retrained test RMSE |
|---|---|---|
| Naive baseline (mean) | 15.930 | 15.930 |
| Ridge regression | 9.082 | 9.082 |
| Random forest | 7.135 | 7.128 |
| **XGBoost (selected)** | **6.781** | **7.056** |
| LightGBM | 7.326 | 7.326 |

Two caveats to carry into any use of this model:

- **It is mostly a persistence model.** Gain-weighted importance on the retrained XGBoost:
  `yield_lag1` 53%, the `crop` dummies 27%, and `enso_index` + `enso_phase` together 1.8%. The
  model card's El Niño resilience findings rest on features the model barely splits on, and
  `predict.py`'s scenario table moves yields by under 2% in eight of nine crop-zone cells
  because the lag features are held at their last observed value.
- **`preprocess.py` computes the rolling-3 mean across series boundaries.** `groupby(...).shift(1)`
  is grouped, but the `.rolling(3)` that follows runs on the concatenated column, so the 1990 and
  1991 rows of eight of the nine crop-zone series average in the tail of the preceding series —
  Teff Highland 1990 gets 44.88 q/ha instead of 10.25. That is 16 of 306 rows, all inside the
  training window, so the 2017–2023 holdout stays honest. Correcting it (rolling inside each
  group) leaves the selected model where it is, 7.056 → 7.080 RMSE, and mainly helps Ridge,
  9.082 → 8.287. The scripts are kept unmodified so the artifact stays comparable with the
  published one.

Split is chronological throughout: train 1990–2016 (243 rows), test 2017–2023 (63 rows).
