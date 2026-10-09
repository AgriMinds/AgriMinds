"""10 m wind from ERA5, as the u and v components the study asks for.

Wind matters here for two reasons. It is a term in the Penman-Monteith evapotranspiration the
water balance runs on, so it shapes how fast a wet month dries out; and a standing crop in
saturated soil lodges in wind, which is the failure the flood advisory warns about.

**Why this is fetched hourly and not daily.** The archive serves daily wind as a *scalar mean
speed* and a *dominant direction*. Converting those two to u and v does not give ERA5's u and v:
the scalar mean ignores direction, so a day of reversing winds reports a high speed where the
true vector mean is near zero. Over the Ethiopian highlands that is not a corner case — the
Kiremt and Bega circulations blow from opposite quarters, and the months either side of the
switch are exactly where the difference is largest. So each hour is converted to components
first, and the month is the mean of those: the vector mean, which is what `10m_u_component_of_wind`
and `10m_v_component_of_wind` mean in the Climate Data Store.

The cost is real — hourly for the whole grid is many hours of a rate-limited archive — so the
download is resumable and keeps every completed request.
"""

from __future__ import annotations

import logging
import time
from datetime import date

import numpy as np
import pandas as pd

from ai_drews.config import DEFAULT_CONFIG, DataPaths, PipelineConfig
from ai_drews.geo.watershed import cell_centres
from ai_drews.ingest.base import IngestError, Manifest, coverage_of, fetch_json, sources_dir, write_manifest, _WIND_TIMEOUT

log = logging.getLogger(__name__)

KEY = "wind"
PROVIDER = "ERA5 reanalysis (ECMWF), served by the Open-Meteo archive"
CITATION = (
    "Hersbach et al. (2020), ERA5 hourly data on single levels: 10m u-component and "
    "10m v-component of wind. Retrieved through https://open-meteo.com/en/docs/historical-weather-api"
)
URL = "https://archive-api.open-meteo.com/v1/archive"

#: What is requested per hour. Components are derived from these; the archive does not serve
#: u and v directly.
HOURLY = ("wind_speed_10m", "wind_direction_10m")

#: What ends up in the grid, in SI units to match the Climate Data Store.
VARIABLES = ("u10", "v10", "wind_speed", "wind_constancy")

_KMH_TO_MS = 1 / 3.6
_LAG_DAYS = 7
#: One cell-half-decade per request. Hourly is bulky: a whole decade for one point is about 2 MB,
#: which is near the useful limit for a single response. Five years keeps each response under 1 MB
#: and reduces timeout risk on slow archive days.
_CHUNK_YEARS = 5
#: Wind fires one request per cell per window — no cell batching, because each hourly block is
#: already ~1 MB. At 256 requests that is roughly one every four seconds, which keeps the burst
#: rate well below Open-Meteo's free-tier throttle. The ERA5 connector batches four cells and
#: only needs 1.5 s; wind cannot batch, so it must go slower.
_PAUSE_SECONDS = 4.0
_PARTS = "wind_parts"


def components(speed_kmh: np.ndarray, direction_deg: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Meteorological speed and direction to u (eastward) and v (northward), in m/s.

    Direction is the compass bearing the wind blows *from*, which is why both components are
    negated: a 90 degree wind comes from the east and therefore blows towards the west, giving a
    negative u.
    """
    speed = np.asarray(speed_kmh, dtype="float64") * _KMH_TO_MS
    radians = np.deg2rad(np.asarray(direction_deg, dtype="float64"))
    return -speed * np.sin(radians), -speed * np.cos(radians)


def monthly_components(frame: pd.DataFrame) -> pd.DataFrame:
    """Aggregate an hourly speed/direction frame to monthly wind statistics.

    ``wind_constancy`` is the ratio of the vector mean to the scalar mean: 1 where the wind holds
    one quarter all month, near 0 where it reverses. It is kept because it is the one number that
    says whether the vector mean is hiding a reversal.
    """
    hourly = frame.dropna(subset=["wind_speed_10m", "wind_direction_10m"])
    if hourly.empty:
        raise IngestError("no usable hourly wind rows")

    u, v = components(hourly["wind_speed_10m"].to_numpy(), hourly["wind_direction_10m"].to_numpy())
    working = hourly.assign(
        u10=u, v10=v, speed_ms=hourly["wind_speed_10m"].to_numpy() * _KMH_TO_MS
    ).set_index("time")

    monthly = working.resample("MS").agg(
        u10=("u10", "mean"), v10=("v10", "mean"), wind_speed=("speed_ms", "mean")
    )
    vector_mean = np.hypot(monthly["u10"], monthly["v10"])
    monthly["wind_constancy"] = (vector_mean / monthly["wind_speed"].replace(0.0, np.nan)).clip(0.0, 1.0)
    return monthly.round(4)


def fetch(paths: DataPaths, cfg: PipelineConfig = DEFAULT_CONFIG, start: str | None = None) -> Manifest:
    """Download hourly wind for every cell and write ``raw/sources/wind_cells.csv``."""
    from ai_drews.ingest.era5 import decade_windows

    centres = cell_centres(cfg.rows, cfg.cols, cfg.bbox)
    flat = [(r, c, lat, lon) for r, row in enumerate(centres) for c, (lat, lon) in enumerate(row)]

    begin = start or cfg.start
    finish = min(pd.Timestamp(cfg.end), pd.Timestamp(date.today()) - pd.Timedelta(days=_LAG_DAYS))
    windows = decade_windows(begin, finish.strftime("%Y-%m-%d"))
    total = len(flat) * len(windows)
    log.info(
        "wind: %d cells x %d windows = %d hourly requests (%s..%s)",
        len(flat),
        len(windows),
        total,
        begin,
        finish.date(),
    )

    parts_dir = sources_dir(paths) / _PARTS
    parts_dir.mkdir(parents=True, exist_ok=True)

    records: list[dict] = []
    done = 0
    for row, col, lat, lon in flat:
        for window_start, window_end in windows:
            part = parts_dir / f"r{row}c{col}_{window_start}_{window_end}.csv"
            done += 1
            if part.exists():
                records.extend(pd.read_csv(part).to_dict("records"))
                continue

            payload = fetch_json(
                URL,
                params={
                    "latitude": f"{lat:.5f}",
                    "longitude": f"{lon:.5f}",
                    "start_date": window_start,
                    "end_date": window_end,
                    "hourly": ",".join(HOURLY),
                    "timezone": "UTC",
                    "models": "era5",
                    "wind_speed_unit": "kmh",
                },
                timeout=_WIND_TIMEOUT,
            )
            block = payload[0] if isinstance(payload, list) else payload
            hourly = (block or {}).get("hourly") or {}
            if not hourly.get("time"):
                raise IngestError(f"no hourly wind returned for cell ({row},{col}) {window_start}")

            frame = pd.DataFrame(hourly).assign(time=lambda d: pd.to_datetime(d["time"]))
            monthly = monthly_components(frame)
            fresh = [
                {
                    "date": stamp.strftime("%Y-%m-%d"),
                    "row": row,
                    "col": col,
                    **{k: (None if pd.isna(val) else float(val)) for k, val in values.items()},
                }
                for stamp, values in monthly.iterrows()
            ]
            pd.DataFrame.from_records(fresh).to_csv(part, index=False)
            records.extend(fresh)
            log.info("  %d/%d cell (%d,%d) %s: %d months", done, total, row, col, window_start, len(fresh))
            time.sleep(_PAUSE_SECONDS)

    if not records:
        raise IngestError("the wind archive returned no rows")

    table = (
        pd.DataFrame.from_records(records)
        .drop_duplicates(subset=["date", "row", "col"], keep="last")
        .sort_values(["date", "row", "col"])
    )
    # Only months every cell reported; a part-observed grid would reach the model as a hole.
    counts = table.groupby("date").size()
    table = table[table["date"].isin(counts[counts == len(flat)].index)]

    out = sources_dir(paths)
    out.mkdir(parents=True, exist_ok=True)
    table.to_csv(out / "wind_cells.csv", index=False)
    for leftover in parts_dir.glob("*.csv"):
        leftover.unlink()
    parts_dir.rmdir()

    months = sorted(table["date"].unique())
    manifest = Manifest.now(
        key=KEY,
        provider=PROVIDER,
        source_url=URL,
        citation=CITATION,
        records=len(table),
        coverage=coverage_of(months),
        variables=VARIABLES,
        notes=(
            f"{cfg.rows}x{cfg.cols} cells, {len(months)} months. Hourly 10 m speed and direction "
            "converted to components per hour, then averaged — the vector mean the Climate Data "
            "Store's u/v fields carry, not a scalar mean with a dominant direction."
        ),
    )
    write_manifest(paths, manifest)
    return manifest


def load(paths: DataPaths, cfg: PipelineConfig = DEFAULT_CONFIG) -> tuple[list[str], dict[str, np.ndarray]]:
    """Return the month list and each wind variable as a ``(T, rows, cols)`` array."""
    path = sources_dir(paths) / "wind_cells.csv"
    if not path.exists():
        raise IngestError(f"{path} is missing; run `ai-drews ingest wind` first")
    frame = pd.read_csv(path)
    months = sorted(frame["date"].unique())
    index = {month: i for i, month in enumerate(months)}

    grids: dict[str, np.ndarray] = {}
    for name in VARIABLES:
        if name not in frame:
            continue
        cube = np.full((len(months), cfg.rows, cfg.cols), np.nan, dtype=np.float32)
        cube[frame["date"].map(index).to_numpy(), frame["row"].to_numpy(), frame["col"].to_numpy()] = frame[
            name
        ].to_numpy(dtype=np.float32)
        grids[name] = cube
    return list(months), grids
