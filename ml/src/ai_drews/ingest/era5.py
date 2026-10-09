"""ERA5 temperature, rainfall, soil moisture and evaporation for every grid cell.

The reanalysis is read through the Open-Meteo archive, which serves ERA5 directly and needs no
credentials — unlike the Copernicus CDS, which would put an API key between a fresh clone and a
working pipeline. The variables are the four the study names, plus FAO reference
evapotranspiration, which the Palmer water balance needs and which ERA5 supplies.

Daily values are downloaded and aggregated here rather than asking for monthly means, because
rainfall must be summed while temperature must be averaged, and a single monthly endpoint cannot
do both.
"""

from __future__ import annotations

import logging
import time
from datetime import date

import numpy as np
import pandas as pd

from ai_drews.config import DEFAULT_CONFIG, DataPaths, PipelineConfig
from ai_drews.geo.watershed import cell_centres
from ai_drews.ingest.base import IngestError, Manifest, coverage_of, fetch_json, sources_dir, write_manifest

log = logging.getLogger(__name__)

KEY = "era5"
PROVIDER = "ERA5 reanalysis (ECMWF), served by the Open-Meteo archive"
CITATION = (
    "Hersbach et al. (2020), ERA5 hourly data on single levels, Copernicus Climate Change "
    "Service. Retrieved through https://open-meteo.com/en/docs/historical-weather-api"
)
URL = "https://archive-api.open-meteo.com/v1/archive"

#: Daily variables requested, and how each becomes a monthly value.
DAILY = {
    "precipitation_sum": ("rain", "sum"),
    "temperature_2m_max": ("tmax", "mean"),
    "temperature_2m_mean": ("tmean", "mean"),
    "soil_moisture_7_to_28cm_mean": ("soilm", "mean"),
    "et0_fao_evapotranspiration": ("pet_fao", "sum"),
}

#: ERA5 reaches the present with a short lag; asking beyond it returns nulls, not an error.
_LAG_DAYS = 7
#: Points per request, and years per request. The archive is free but rate-limited by the volume
#: asked for, not the number of calls: eight cells over thirty-six years is refused with a 429,
#: while four cells over a decade is accepted. Smaller, slower and polite beats clever here.
_BATCH = 4
_CHUNK_YEARS = 10
#: Pause between requests, so a full grid download does not look like a scraper.
_PAUSE_SECONDS = 1.5
#: Where completed (cell group, time window) responses are kept. A whole grid sits close to the
#: archive's free hourly allowance, so a run that trips the limit three quarters of the way
#: through must not throw away what it already has: restarting picks up from these parts.
_PARTS = "era5_parts"


def _month_end(value: str) -> str:
    stamp = pd.Timestamp(value)
    return (stamp + pd.offsets.MonthEnd(0)).strftime("%Y-%m-%d")


def fetch(paths: DataPaths, cfg: PipelineConfig = DEFAULT_CONFIG, start: str | None = None) -> Manifest:
    """Download every cell and write ``raw/sources/era5_cells.csv`` (one row per cell-month)."""
    centres = cell_centres(cfg.rows, cfg.cols, cfg.bbox)
    flat = [(r, c, lat, lon) for r, row in enumerate(centres) for c, (lat, lon) in enumerate(row)]

    begin = start or cfg.start
    finish = min(pd.Timestamp(cfg.end), pd.Timestamp(date.today()) - pd.Timedelta(days=_LAG_DAYS))
    finish_str = finish.strftime("%Y-%m-%d")
    log.info("ERA5: %d cells, %s..%s", len(flat), begin, finish_str)

    windows: list[tuple[str, str]] = []
    cursor = pd.Timestamp(begin)
    while cursor <= finish:
        stop = min(cursor + pd.DateOffset(years=_CHUNK_YEARS) - pd.Timedelta(days=1), finish)
        windows.append((cursor.strftime("%Y-%m-%d"), stop.strftime("%Y-%m-%d")))
        cursor = stop + pd.Timedelta(days=1)

    batches = [flat[i : i + _BATCH] for i in range(0, len(flat), _BATCH)]
    total = len(batches) * len(windows)
    log.info("  %d requests (%d cell groups x %d time windows)", total, len(batches), len(windows))

    parts_dir = sources_dir(paths) / _PARTS
    parts_dir.mkdir(parents=True, exist_ok=True)

    records: list[dict] = []
    done = 0
    for index, batch in enumerate(batches):
        for window_start, window_end in windows:
            part = parts_dir / f"cells{index:02d}_{window_start}_{window_end}.csv"
            done += 1
            if part.exists():
                cached = pd.read_csv(part)
                records.extend(cached.to_dict("records"))
                log.info("  %d/%d cached, %d rows", done, total, len(records))
                continue

            payload = fetch_json(
                URL,
                params={
                    "latitude": ",".join(f"{lat:.5f}" for _, _, lat, _ in batch),
                    "longitude": ",".join(f"{lon:.5f}" for _, _, _, lon in batch),
                    "start_date": window_start,
                    "end_date": window_end,
                    "daily": ",".join(DAILY),
                    "timezone": "UTC",
                    "models": "era5",
                },
            )
            # A single coordinate comes back as an object, several as a list.
            blocks = payload if isinstance(payload, list) else [payload]
            if len(blocks) != len(batch):
                raise IngestError(f"asked for {len(batch)} points, received {len(blocks)}")

            fresh: list[dict] = []
            for (row, col, lat, lon), block in zip(batch, blocks, strict=True):
                daily = block.get("daily") or {}
                if not daily.get("time"):
                    raise IngestError(f"no daily series returned for cell ({row},{col})")
                frame = pd.DataFrame(daily).assign(time=lambda d: pd.to_datetime(d["time"]))
                monthly = frame.set_index("time").resample("MS")
                aggregated = pd.DataFrame(
                    {
                        name: (monthly[source].sum(min_count=1) if how == "sum" else monthly[source].mean())
                        for source, (name, how) in DAILY.items()
                        if source in frame
                    }
                )
                for stamp, values in aggregated.iterrows():
                    fresh.append(
                        {
                            "date": stamp.strftime("%Y-%m-%d"),
                            "row": row,
                            "col": col,
                            "lat": round(lat, 5),
                            "lon": round(lon, 5),
                            **{k: (None if pd.isna(v) else round(float(v), 4)) for k, v in values.items()},
                        }
                    )
            # Write the part only once the whole batch parsed, so a half-written file is never
            # mistaken for a complete one on the next run.
            pd.DataFrame.from_records(fresh).to_csv(part, index=False)
            records.extend(fresh)
            log.info("  %d/%d requests, %d rows", done, total, len(records))
            time.sleep(_PAUSE_SECONDS)

    if not records:
        raise IngestError("ERA5 returned no rows")

    frame = (
        pd.DataFrame.from_records(records)
        .drop_duplicates(subset=["date", "row", "col"], keep="last")
        .sort_values(["date", "row", "col"])
    )
    # Drop trailing months the archive has not finished: a partial month would read as a drought.
    complete = frame.groupby("date")["rain"].apply(lambda s: s.notna().all())
    frame = frame[frame["date"].isin(complete[complete].index)]

    out = sources_dir(paths)
    out.mkdir(parents=True, exist_ok=True)
    frame.to_csv(out / "era5_cells.csv", index=False)
    for part in parts_dir.glob("*.csv"):
        part.unlink()
    parts_dir.rmdir()

    months = sorted(frame["date"].unique())
    variables = tuple(name for name, _ in DAILY.values())
    gaps = int(frame[list(variables)].isna().sum().sum())
    manifest = Manifest.now(
        key=KEY,
        provider=PROVIDER,
        source_url=URL,
        citation=CITATION,
        records=len(frame),
        coverage=coverage_of(months),
        variables=variables,
        notes=(
            f"{cfg.rows}x{cfg.cols} cells over the catchment bounding box, {len(months)} months. "
            f"Daily values aggregated here: rainfall and evapotranspiration summed, temperature "
            f"and soil moisture averaged." + (f" {gaps} missing cell-month values." if gaps else "")
        ),
    )
    write_manifest(paths, manifest)
    return manifest


def load(paths: DataPaths, cfg: PipelineConfig = DEFAULT_CONFIG) -> tuple[list[str], dict[str, np.ndarray]]:
    """Return the month list and each variable as a ``(T, rows, cols)`` array."""
    path = sources_dir(paths) / "era5_cells.csv"
    if not path.exists():
        raise IngestError(f"{path} is missing; run `ai-drews ingest era5` first")
    frame = pd.read_csv(path)
    months = sorted(frame["date"].unique())
    index = {month: i for i, month in enumerate(months)}

    grids: dict[str, np.ndarray] = {}
    for name, _ in DAILY.values():
        if name not in frame:
            continue
        cube = np.full((len(months), cfg.rows, cfg.cols), np.nan, dtype=np.float32)
        cube[
            frame["date"].map(index).to_numpy(),
            frame["row"].to_numpy(),
            frame["col"].to_numpy(),
        ] = frame[name].to_numpy(dtype=np.float32)
        grids[name] = cube
    return list(months), grids
