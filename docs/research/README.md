# Research material

Source documents behind the AI-DREWS implementation. These are inputs to the code, not outputs of it.

| File | What it is | Where it is implemented |
|---|---|---|
| `AgriMind_AI_Project.pdf` | Project proposal and method | across `ml/` |
| `table2-scpdsi-enso-thresholds.jpg` | Slide "3. Results cont…": **Table 2** (Sc-PDSI and ENSO classification thresholds) and **Fig. 5** (ENSO–drought correlation for Amhara, R = 0.79) | `ml/src/ai_drews/advisory/classification.py`, `ml/src/ai_drews/features/pdsi.py`, `ml/src/ai_drews/analysis/teleconnection.py` |
| `CNN_LSTM2.m` | Original MATLAB prototype of the CNN-LSTM | `ml/src/ai_drews/models/` |
| `climate-crop.xlsx`, `elnino.xlsx`, `seasonal-elnino.xlsx`, `ECMWF_*.xlsx` | Spreadsheets used during exploration | not wired in; real inputs go to `data/raw/` |

## Table 2, as implemented

The thresholds are transcribed in `ml/src/ai_drews/advisory/classification.py` and are the single
source of truth for the whole platform: the API classifies, and the web and mobile clients only
style the result.

**Niño 3.4 index** (after Megbar & Tadesse, 2016)

| Index | Category |
|---|---|
| ≥ 1.00 | High El Niño |
| 0.50 to 1.00 | Moderate El Niño |
| −0.50 to 0.50 | Neutral |
| −1.00 to −0.50 | Moderate La Niña |
| ≤ −1.00 | High La Niña |

**Sc-PDSI** (after Menberu & Addisu, 2018)

| Value | Category |
|---|---|
| > 3 | Extremely wet |
| 2 to 3 | Very wet |
| 1 to 2 | Moderately wet |
| −1 to 1 | Normal |
| −2 to −1 | Moderately dry |
| −3 to −2 | Very dry |
| < −3 | Extremely dry |

Two notes on faithfulness:

- **The published bands leave hairline gaps** (0.99 to 1.00 on the Niño scale, and similar on the
  Sc-PDSI scale). Indices are continuous, so each gap is closed explicitly in the code, with the
  stronger band winning at its own boundary. Every edge is pinned by a test.
- **Table 2 puts exactly ±0.50 °C in Neutral**, whereas NOAA's ONI convention would call it a
  phase. The table governs here, so the coarse three-way phase is derived from the five-way band
  and the two can never disagree.

## Fig. 5, as implemented

`ml/src/ai_drews/analysis/teleconnection.py` computes the same statistic from whatever record is
loaded, at lags 0–9 months, and writes `data/outputs/enso_drought_correlation.csv`. The published
**R = 0.79 is a result for real Amhara observations** and is never reproduced as a constant; a run
on the synthetic stand-in reports the synthetic correlation.
