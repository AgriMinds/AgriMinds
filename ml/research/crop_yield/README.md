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
| `corrected.py` | the verified panel builder: ENSO checked against its own seasonal source, rolling mean grouped |
| `data/nino34_seasonal_reference.csv` | the seasonal Niño 3.4 the spreadsheet's `ElniNo` column is the mean of |
| `corrected/` | the run on the verified panel — this is what gets published |
| `figure_enso_crop_1990_2030.py` | the two-panel record-and-outlook figure |
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

## The spreadsheet's ENSO column is wrong in two years

`ElniNo` is the mean of four seasonal Niño 3.4 values, and those are in
`data/nino34_seasonal_reference.csv`. Recomputing the mean reproduces 32 of the 34 years exactly.
Both failures are in the *newer* spreadsheet:

| year | seasonal source | `climate-crop.xlsx` (v1) | `climate-crop (2).xlsx` (v2) |
|---|---|---|---|
| 2010 | −0.175 | −0.175 | **−0.975** |
| 2022 | −0.975 | −0.975 | **−2.975** |

Each is a single digit. So v2 is not a revision of v1, it is a transcription error against it, and
the 2010 error also flips that year's phase label from Neutral to La Niña. `corrected.py` verifies
every year against the seasonal source and repairs what disagrees, recording the repair in the
published metadata (`data_corrections`). Neither year moves the El Niño impact table, because both
sit outside the El Niño group either way.

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
| `GET /api/v1/crop-yield/timeline` | the observed record and one projected series per assumed ENSO state |
| `/crop-yield` (web, staff only) | the yield matrix, the ENSO term, the model's limits, and the 1990-2030 timeline |

xgboost is an extra, not a core dependency, because `joblib.load` has to reconstruct the fitted
estimator. An API deployment without it logs the reason at startup and answers 503 on these three
endpoints while serving everything else — the web page then shows its "model unavailable" state.

The farmer app is deliberately **not** wired to this: these are belt-wide averages and the climate
term moves them by a couple of percent, which is not something a smallholder can act on.

## The El Niño impact table

`enso_impact_table()` (in `ai_drews.crop_yield`) measures what El Niño years did to each
crop-belt series, and `publish.py` records the result in the metadata. It answers a different
question from the regressor — "what happened" rather than "what is predicted" — so the API keeps
the two apart (`/crop-yield/enso-impact` vs `/crop-yield/outlook`) and the page never merges them.

Yields nearly double across 1990-2023, so a plain El Niño-vs-rest average would mostly measure
which decades happened to be El Niño years. Each series is therefore detrended (least-squares
line on year), each year expressed as a percentage deviation from its trend value, and the effect
is the mean deviation of the eight El Niño years minus that of the other 26, with Welch's t-test
for p.

| | Lowland | Midland | Highland | crop mean |
|---|---|---|---|---|
| Tef | −8.52% (p=0.27) | −4.25% (p=0.06) | −2.03% (p=0.77) | −4.93% |
| Wheat | −11.57% (p=0.14) | −7.65% (p=0.51) | −6.64% (p=0.28) | −8.62% |
| Maize | −2.00% (p=0.78) | **+2.35%** (p=0.72) | −0.22% (p=0.98) | +0.04% |
| belt mean | −7.36% | −3.18% | −2.96% | **−4.50%** |

**None of the nine cells reaches p < 0.05.** Eight El Niño years is a small sample against
year-to-year variation this large, so the record supports a *direction* — wheat worst, maize most
resilient, the lowlands hit hardest — and not a proven effect size. The page states that in the
table, in the legend and in the takeaways, and a non-significant cell is drawn hollow.

### The published infographic's figures are not these

The project's El Niño infographic reports −2.87% / −25.36% / +21.90% and p-values of 0.0039,
0.0048 and 0.0037. Those cannot be reproduced from `climate-crop (2).xlsx` by any of the obvious
definitions — El Niño vs the rest, vs neutral years only, vs La Niña years, detrended residuals,
year-on-year change, strong El Niño only, or a regression with a year term and an El Niño dummy.
The closest (detrended residuals, and the regression) agree with the infographic on the *sign* of
all nine cells but are about three times smaller, and none of them produces a significant p.

So the figures on that poster come from somewhere else — a different dataset, period or method.
Until that source is known, this page reports what this repository's record supports.

## What the retrain showed

**The spreadsheet is the one the published model was already fitted on.** The panel built from
`climate-crop (2).xlsx` matches `upstream_crop_climate_clean.csv` in every column of all 306 rows,
so the as-upstream run is a reproduction rather than a new fit, and the remaining metric drift is
library versions (xgboost 3.4.1, scikit-learn 1.9.1). It also means the published model inherited
both of that spreadsheet's bad ENSO years — which is why the artifact this repo serves is now the
verified rebuild instead:

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
