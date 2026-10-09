"""MODIS vegetation greenness for every grid cell, which VCI is computed from.

NASA's MOD13Q1 is a 16-day, 250 m composite. The ORNL DAAC serves it over an open REST API with
no login, but caps a request at ten composites, so the record is fetched in chunks and the cells
are fetched in parallel — one cell at a time would take hours.

Each cell is sampled as a 4 x 4 km box rather than a single pixel. One 250 m pixel standing for a
~19 km cell would make the series a story about one hillside; averaging 289 of them gives
something the cell's VCI can reasonably be based on.
"""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import pandas as pd

from ai_drews.config import DEFAULT_CONFIG, DataPaths, PipelineConfig
from ai_drews.geo.watershed import cell_centres
from ai_drews.ingest.base import IngestError, Manifest, coverage_of, fetch_json, sources_dir, write_manifest

log = logging.getLogger(__name__)

KEY = "ndvi"
PRODUCT = "MOD13Q1"
BAND = "250m_16_days_NDVI"
PROVIDER = "NASA MODIS/Terra (MOD13Q1), served by the ORNL DAAC"
CITATION = (
    "Didan, K. (2021), MOD13Q1 MODIS/Terra Vegetation Indices 16-Day L3 Global 250m, NASA EOSDIS "
    "LP DAAC. Retrieved through https://modis.ornl.gov/data/modis_webservice.html"
)
BASE = "https://modis.ornl.gov/rst/api/v1"

_SCALE = 1e-4
_FILL_BELOW = -3000  # MOD13Q1 marks unusable pixels with -3000
_MAX_COMPOSITES = 10  # the service's own per-request limit
_BOX_KM = 2  # half-width, so a 4 x 4 km sample
_WORKERS = 6


def available_dates(latitude: float, longitude: float) -> list[tuple[str, str]]:
    payload = fetch_json(f"{BASE}/{PRODUCT}/dates", params={"latitude": latitude, "longitude": longitude})
    dates = payload.get("dates", []) if isinstance(payload, dict) else []
    if not dates:
        raise IngestError("the MODIS service listed no composite dates")
    return [(d["modis_date"], d["calendar_date"]) for d in dates]


def _cell_series(latitude: float, longitude: float, chunks: list[list[tuple[str, str]]]) -> pd.Series:
    dates: list[pd.Timestamp] = []
    values: list[float] = []
    for chunk in chunks:
        payload = fetch_json(
            f"{BASE}/{PRODUCT}/subset",
            params={
                "latitude": latitude,
                "longitude": longitude,
                "band": BAND,
                "startDate": chunk[0][0],
                "endDate": chunk[-1][0],
                "kmAboveBelow": _BOX_KM,
                "kmLeftRight": _BOX_KM,
            },
        )
        for record in payload.get("subset", []):
            pixels = np.array([v for v in record.get("data", []) if v is not None], dtype=np.float32)
            usable = pixels[pixels > _FILL_BELOW]
            if usable.size == 0:
                continue
            dates.append(pd.Timestamp(record["calendar_date"]))
            values.append(float(usable.mean()) * _SCALE)
    return pd.Series(values, index=pd.DatetimeIndex(dates)).sort_index()


def fetch(paths: DataPaths, cfg: PipelineConfig = DEFAULT_CONFIG, start: str | None = None) -> Manifest:
    """Download NDVI for every cell and write ``raw/sources/ndvi_cells.csv``."""
    centres = cell_centres(cfg.rows, cfg.cols, cfg.bbox)
    flat = [(r, c, lat, lon) for r, row in enumerate(centres) for c, (lat, lon) in enumerate(row)]

    begin = pd.Timestamp(start or cfg.start)
    end = pd.Timestamp(cfg.end)
    centre_lat, centre_lon = centres[cfg.rows // 2][cfg.cols // 2]
    calendar = [d for d in available_dates(centre_lat, centre_lon) if begin <= pd.Timestamp(d[1]) <= end]
    if not calendar:
        raise IngestError(f"MODIS has no composites between {begin.date()} and {end.date()}")
    chunks = [calendar[i : i + _MAX_COMPOSITES] for i in range(0, len(calendar), _MAX_COMPOSITES)]
    log.info(
        "NDVI: %d cells x %d composites (%s..%s) in %d requests each",
        len(flat),
        len(calendar),
        calendar[0][1],
        calendar[-1][1],
        len(chunks),
    )

    def work(cell: tuple[int, int, float, float]) -> tuple[int, int, pd.Series]:
        row, col, lat, lon = cell
        series = _cell_series(lat, lon, chunks)
        log.info("  cell (%d,%d): %d composites", row, col, len(series))
        return row, col, series

    records: list[dict] = []
    with ThreadPoolExecutor(max_workers=_WORKERS) as pool:
        for row, col, series in pool.map(work, flat):
            if series.empty:
                raise IngestError(f"MODIS returned nothing for cell ({row},{col})")
            # 16-day composites -> monthly: the mean greenness the month was observed at.
            for stamp, value in series.resample("MS").mean().dropna().items():
                records.append(
                    {"date": stamp.strftime("%Y-%m-%d"), "row": row, "col": col, "ndvi": round(value, 5)}
                )

    frame = pd.DataFrame.from_records(records).sort_values(["date", "row", "col"])
    # Keep only months every cell reported, so the grid is never part-observed.
    counts = frame.groupby("date").size()
    frame = frame[frame["date"].isin(counts[counts == len(flat)].index)]
    if frame.empty:
        raise IngestError("no month was observed across the whole grid")

    out = sources_dir(paths)
    out.mkdir(parents=True, exist_ok=True)
    frame.to_csv(out / "ndvi_cells.csv", index=False)

    months = sorted(frame["date"].unique())
    manifest = Manifest.now(
        key=KEY,
        provider=PROVIDER,
        source_url=f"{BASE}/{PRODUCT}/subset",
        citation=CITATION,
        records=len(frame),
        coverage=coverage_of(months),
        variables=("ndvi",),
        notes=(
            f"{cfg.rows}x{cfg.cols} cells, {len(months)} months. Each cell is the mean of a "
            f"{2 * _BOX_KM} x {2 * _BOX_KM} km box of 250 m pixels, fill values excluded, "
            "16-day composites averaged to months."
        ),
    )
    write_manifest(paths, manifest)
    return manifest


def load(paths: DataPaths, cfg: PipelineConfig = DEFAULT_CONFIG) -> tuple[list[str], np.ndarray]:
    path = sources_dir(paths) / "ndvi_cells.csv"
    if not path.exists():
        raise IngestError(f"{path} is missing; run `ai-drews ingest ndvi` first")
    frame = pd.read_csv(path)
    months = sorted(frame["date"].unique())
    index = {month: i for i, month in enumerate(months)}
    cube = np.full((len(months), cfg.rows, cfg.cols), np.nan, dtype=np.float32)
    cube[frame["date"].map(index).to_numpy(), frame["row"].to_numpy(), frame["col"].to_numpy()] = frame[
        "ndvi"
    ].to_numpy(dtype=np.float32)
    return list(months), cube
