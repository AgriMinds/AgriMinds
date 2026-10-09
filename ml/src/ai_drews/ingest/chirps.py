"""CHIRPS rainfall over the catchment, used to check ERA5 rather than to drive the forecast.

The study gives CHIRPS and the Ethiopian Meteorological Institute one job: validating the
reanalysis against satellite and station records. So this connector pulls a catchment-average
series, not a grid — the comparison is basin-wide, and asking the service for 64 separate
polygons would be sixty-four times the load for a figure nobody reads per cell.

SERVIR's ClimateSERV does the zonal statistics server-side, which is why no raster library is
needed here. Requests are asynchronous: submit, poll, collect.
"""

from __future__ import annotations

import json
import logging
import time

import pandas as pd

from ai_drews.config import DEFAULT_CONFIG, DataPaths, PipelineConfig
from ai_drews.geo.watershed import load_boundary, simplify_ring
from ai_drews.ingest.base import IngestError, Manifest, coverage_of, fetch_json, sources_dir, write_manifest

log = logging.getLogger(__name__)

KEY = "chirps"
PROVIDER = "CHIRPS v2.0 (UC Santa Barbara Climate Hazards Center), via SERVIR ClimateSERV"
CITATION = (
    "Funk et al. (2015), The climate hazards infrared precipitation with stations. "
    "Zonal means retrieved through https://climateserv.servirglobal.net/"
)
BASE = "https://climateserv.servirglobal.net/api"
_DATATYPE_CHIRPS = 0
_OPERATION_AVERAGE = 5
_INTERVAL_DAILY = 0
#: ClimateSERV rejects very long spans, so the record is requested a few years at a time.
_CHUNK_YEARS = 5
_POLL_SECONDS = 4
_POLL_LIMIT = 60
#: The polygon is sent in a URL, so the surveyed outline is thinned first. At this tolerance the
#: boundary still follows the catchment far more closely than the 0.05 deg CHIRPS pixel.
_SIMPLIFY_DEG = 0.01


def catchment_polygon(paths: DataPaths) -> dict:
    boundary = load_boundary(paths.watershed_geojson)
    ring = simplify_ring(boundary.rings[0], _SIMPLIFY_DEG)
    if ring[0] != ring[-1]:
        ring = [*ring, ring[0]]
    log.info("catchment outline thinned to %d points for the request", len(ring))
    return {"type": "Polygon", "coordinates": [[[round(x, 5), round(y, 5)] for x, y in ring]]}


def _request_window(polygon: dict, begin: pd.Timestamp, end: pd.Timestamp) -> pd.Series:
    job = fetch_json(
        f"{BASE}/submitDataRequest/",
        params={
            "datatype": _DATATYPE_CHIRPS,
            "begintime": begin.strftime("%m/%d/%Y"),
            "endtime": end.strftime("%m/%d/%Y"),
            "intervaltype": _INTERVAL_DAILY,
            "operationtype": _OPERATION_AVERAGE,
            "geometry": json.dumps(polygon),
        },
    )
    job_id = job[0] if isinstance(job, list) and job else None
    if not job_id:
        raise IngestError(f"ClimateSERV did not return a job id: {job!r}")

    for _ in range(_POLL_LIMIT):
        progress = fetch_json(f"{BASE}/getDataRequestProgress/", params={"id": job_id})
        if isinstance(progress, list) and progress and float(progress[0]) >= 100.0:
            break
        time.sleep(_POLL_SECONDS)
    else:
        raise IngestError(f"ClimateSERV job {job_id} did not finish in time")

    payload = fetch_json(f"{BASE}/getDataFromRequest/", params={"id": job_id})
    if isinstance(payload, dict) and payload.get("errMsg"):
        raise IngestError(f"ClimateSERV job {job_id} failed: {payload['errMsg']}")
    rows = payload.get("data", []) if isinstance(payload, dict) else []

    dates, values = [], []
    for row in rows:
        value = row.get("value", {})
        amount = value.get("avg") if isinstance(value, dict) else row.get("raw_value")
        if amount is None:
            continue
        # The service marks gaps with a large negative sentinel rather than a null.
        if float(amount) < -1.0:
            continue
        dates.append(pd.Timestamp(row["isodate"]))
        values.append(float(amount))
    return pd.Series(values, index=pd.DatetimeIndex(dates)).sort_index()


def fetch(paths: DataPaths, cfg: PipelineConfig = DEFAULT_CONFIG, start: str | None = None) -> Manifest:
    """Download daily catchment rainfall and write monthly totals to ``raw/sources/chirps.csv``."""
    polygon = catchment_polygon(paths)
    begin = pd.Timestamp(start or cfg.start)
    # CHIRPS begins in 1981; asking earlier wastes a request.
    begin = max(begin, pd.Timestamp("1981-01-01"))
    end = min(pd.Timestamp(cfg.end), pd.Timestamp.today().normalize())

    daily = pd.Series(dtype=float)
    cursor = begin
    while cursor < end:
        stop = min(cursor + pd.DateOffset(years=_CHUNK_YEARS) - pd.Timedelta(days=1), end)
        log.info("CHIRPS %s..%s", cursor.date(), stop.date())
        daily = pd.concat([daily, _request_window(polygon, cursor, stop)])
        cursor = stop + pd.Timedelta(days=1)

    daily = daily[~daily.index.duplicated(keep="last")].sort_index()
    if daily.empty:
        raise IngestError("ClimateSERV returned no CHIRPS values")

    monthly = daily.resample("MS").sum(min_count=20)  # a month missing days is not a monthly total
    monthly = monthly.dropna()
    frame = monthly.rename("rain_mm").to_frame()
    frame.index.name = "date"

    out = sources_dir(paths)
    out.mkdir(parents=True, exist_ok=True)
    frame.round(3).to_csv(out / "chirps.csv")

    months = [d.strftime("%Y-%m-%d") for d in frame.index]
    manifest = Manifest.now(
        key=KEY,
        provider=PROVIDER,
        source_url=f"{BASE}/submitDataRequest/",
        citation=CITATION,
        records=len(frame),
        coverage=coverage_of(months),
        variables=("rain_mm",),
        notes=(
            f"Catchment-average daily rainfall summed to {len(frame)} monthly totals, over the "
            f"surveyed outline thinned to {len(polygon['coordinates'][0])} points. Months with "
            "fewer than 20 reporting days are dropped."
        ),
    )
    write_manifest(paths, manifest)
    return manifest


def load(paths: DataPaths) -> pd.Series:
    path = sources_dir(paths) / "chirps.csv"
    if not path.exists():
        raise IngestError(f"{path} is missing; run `ai-drews ingest chirps` first")
    frame = pd.read_csv(path, parse_dates=["date"]).set_index("date").sort_index()
    return frame["rain_mm"]
