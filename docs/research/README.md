# Research material

Source documents behind the AI-DREWS implementation. These are inputs to the code, not outputs of it.

| File | What it is | Where it is implemented |
|---|---|---|
| `AgriMind_AI_Project.pdf` | Project proposal and method | across `ml/` |
| `table2-scpdsi-enso-thresholds.jpg` | Slide "3. Results cont…": **Table 2** (Sc-PDSI and ENSO classification thresholds) and **Fig. 5** (ENSO–drought correlation for Amhara, R = 0.79) | `ml/src/ai_drews/advisory/classification.py`, `ml/src/ai_drews/features/pdsi.py`, `ml/src/ai_drews/analysis/teleconnection.py` |
| `cmw/cmw_max_boundary_wgs.*` | **Surveyed catchment boundary** (ESRI shapefile, WGS84, 18,948 km²) | `ml/src/ai_drews/geo/watershed.py` → `data/geo/choke_watershed.geojson` |
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


## The catchment boundary

Until this shapefile arrived the platform used a placeholder bounding box, flagged as such in the
code: `(37.6, 10.4, 38.4, 11.2)`. The surveyed boundary is substantially different.

| | Placeholder | Surveyed |
|---|---|---|
| Longitude | 37.60 – 38.40 | **37.01 – 38.53** |
| Latitude | 10.40 – 11.20 | **9.84 – 11.26** |
| Span | 0.80° × 0.80° | **1.52° × 1.42°** |
| Area | ~7,900 km² | **18,948 km²** |

The placeholder sat inside the real extent but missed the entire western half of the catchment.

Two things follow, and both are now implemented:

1. **The grid is masked.** A rectangle laid over a catchment that is not one contains cells that
   are not in it — 15 of 64 at the current resolution. A drought probability for those is a number
   about somewhere else, so the API marks them and the map does not present them as readings.
2. **Containment is tested against the polygon, not the box.** Registering a plot that sits inside
   the bounding box but outside the catchment is refused, which a box alone gets wrong.

Conversion is a one-off step needing the optional `geo` extra:

```bash
pip install -e "ml[geo]"
python -c "from ai_drews.geo.watershed import read_shapefile, write_geojson; \
           write_geojson(read_shapefile('docs/research/cmw/cmw_max_boundary_wgs.shp'), \
                         'data/geo/choke_watershed.geojson')"
```

Everything downstream reads the GeoJSON, which is plain JSON and needs no geospatial library. An
independent spherical-area calculation agrees with the shapefile's own `area_km2` attribute to
0.4%, which is the check that the conversion did not distort the geometry.


## The observational record

`ai-drews ingest all` (or `make ingest`) downloads the inputs the study specifies. Every route is
public and needs **no credentials**, which is deliberate: a reviewer should be able to reproduce
the record from a fresh clone without applying for an account anywhere.

| Input | Provider | Route | Notes |
|---|---|---|---|
| Niño 3.4, Niño 1+2, Niño 4, SOI | NOAA PSL | `psl.noaa.gov/data/correlation/*.data` | ERSST v6, anomalies against 1981–2010 |
| Temperature, rainfall, soil moisture, evaporation | ERA5 (ECMWF) | Open-Meteo archive | daily values aggregated here, per grid cell |
| Rainfall for validation | CHIRPS v2.0 | SERVIR ClimateSERV | zonal mean over the surveyed outline |
| Crop area, yield, production | FAOSTAT | bulk CSV | Ethiopia's official statistics |
| Greenness (opt-in) | MODIS MOD13Q1 | ORNL DAAC | not in `ingest all`; see below |

Four points a reviewer should know, because each one is a place where a convenient shortcut would
have produced a wrong or overstated result.

**ERA5 is read through Open-Meteo, not the Copernicus CDS.** The CDS requires an API key, which
would put an account between a fresh clone and a working pipeline. Open-Meteo serves the same
reanalysis. It meters by data volume per hour, and one full 8×8 grid over 2000–2026 is close to
the free hourly allowance, so a long ingest is expected to pause and resume rather than fail.
Completed requests are cached under `data/raw/sources/era5_parts/`.

**Daily values are aggregated here rather than requested as monthly means.** Rainfall and
evapotranspiration must be summed while temperature and soil moisture must be averaged, and no
single monthly endpoint does both correctly.

**FAO has no `tef` item.** Ethiopian tef is reported inside `Cereals n.e.c.`, which for Ethiopia
is overwhelmingly tef — the area and yield track the CSA tef series closely — but it remains an
aggregate. The inventory labels the row as such rather than presenting it as a pure tef
measurement, and the advisory rules should not treat it as one.

**CHIRPS validates; it does not drive the forecast.** That is the role the study gives it, so the
`chirps_emi` entry reports connected only once the ERA5–CHIRPS comparison has actually run, and
its detail carries the correlation and bias that comparison found
(`data/outputs/era5_chirps_validation.csv`). Until then the reanalysis is unvalidated here and the
platform says so.

**MODIS greenness is opt-in.** No source the study names supplies a vegetation index, and the
ORNL DAAC caps a request at ten composites and extracts each on demand, so a full grid takes hours
rather than minutes. It is therefore excluded from `ingest all`, which must stay a minutes-long
command. Without it, VCI and the greenness channels are absent, `assemble` skips them, and the
model trains on the remaining channels; `ai-drews ingest ndvi` adds them when the wait is
acceptable.

### Provenance is recorded, not inferred

Each connector writes a manifest to `data/raw/manifests/` naming the provider, URL, citation,
record count, coverage and retrieval time. **Whether the pipeline is running on observations is
decided by `dataset.json`, never by the raw files existing** — the synthetic generator writes to
exactly the same paths, so before this existed a second pipeline run would have loaded its own
stand-in data and stamped the model `data_source: real`. `GET /api/v1/system/data-sources` and
the `/data-sources` page read those manifests directly.
