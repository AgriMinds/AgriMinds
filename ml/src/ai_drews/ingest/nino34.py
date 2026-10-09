"""Niño 3.4 and the companion ENSO indices, from NOAA.

NOAA PSL publishes each index as a fixed-width table: a header giving the first and last year,
one row per year with twelve monthly values, then a line carrying the missing-value marker and a
short provenance block. The marker matters — the current year is padded with it, and reading
those as real anomalies would put a -99 °C spike at the end of the record.
"""

from __future__ import annotations

import contextlib
import logging
import math

import pandas as pd

from ai_drews.config import DataPaths
from ai_drews.ingest.base import IngestError, Manifest, coverage_of, fetch_text, sources_dir, write_manifest

log = logging.getLogger(__name__)

KEY = "nino34"
PROVIDER = "NOAA Physical Sciences Laboratory"
CITATION = (
    "NOAA PSL climate indices derived from ERSST v5/v6, anomalies against the 1981-2010 base "
    "period. https://psl.noaa.gov/data/climateindices/"
)
BASE_URL = "https://psl.noaa.gov/data/correlation"

#: column -> the NOAA series that supplies it.
SERIES = {
    "nino34": "nina34.anom.data",
    "nino12": "nina1.anom.data",
    "nino4": "nina4.anom.data",
    "soi": "soi.data",
}


def parse_psl_table(text: str) -> pd.Series:
    """Parse one NOAA PSL index table into a month-indexed series."""
    lines = [line for line in text.splitlines() if line.strip()]
    if not lines:
        raise IngestError("empty index table")

    header = lines[0].split()
    try:
        first_year, last_year = int(header[0]), int(header[1])
    except (IndexError, ValueError) as exc:
        raise IngestError(f"unexpected header line: {lines[0]!r}") from exc

    # The line after the final year row carries the missing-value marker, e.g. "-99.99".
    missing = None
    dates: list[pd.Timestamp] = []
    values: list[float] = []
    for line in lines[1:]:
        parts = line.split()
        if len(parts) == 1:
            with contextlib.suppress(ValueError):
                missing = float(parts[0])
            break
        if len(parts) != 13:
            break
        try:
            year = int(parts[0])
            monthly = [float(p) for p in parts[1:]]
        except ValueError:
            break
        if not first_year <= year <= last_year:
            continue
        for month, value in enumerate(monthly, start=1):
            dates.append(pd.Timestamp(year=year, month=month, day=1))
            values.append(value)

    if not dates:
        raise IngestError("no monthly rows found in the index table")

    series = pd.Series(values, index=pd.DatetimeIndex(dates)).sort_index()
    if missing is not None:
        series = series.mask(series.sub(missing).abs() < 1e-6)
    # PSL also pads with large sentinels on occasion; a real anomaly never leaves this range.
    series = series.mask(series.abs() > 50.0)
    return series.dropna()


def fetch(paths: DataPaths) -> Manifest:
    """Download every ENSO index and write ``raw/sources/nino34.csv``."""
    frame = pd.DataFrame()
    for column, filename in SERIES.items():
        url = f"{BASE_URL}/{filename}"
        log.info("fetching %s", url)
        series = parse_psl_table(fetch_text(url))
        frame[column] = series
        log.info(
            "  %s: %d months, %s..%s",
            column,
            len(series),
            series.index.min().date(),
            series.index.max().date(),
        )

    # Keep months where the headline index exists; the companions start and end on their own days.
    frame = frame.dropna(subset=["nino34"]).sort_index()
    frame.index.name = "date"
    if frame.empty:
        raise IngestError("no overlapping months across the NOAA index series")

    out = sources_dir(paths)
    out.mkdir(parents=True, exist_ok=True)
    frame.round(4).to_csv(out / "nino34.csv")

    dates = [d.strftime("%Y-%m-%d") for d in frame.index]
    gaps = {c: int(frame[c].isna().sum()) for c in frame.columns if frame[c].isna().any()}
    manifest = Manifest.now(
        key=KEY,
        provider=PROVIDER,
        source_url=f"{BASE_URL}/{SERIES['nino34']}",
        citation=CITATION,
        records=len(frame),
        coverage=coverage_of(dates),
        variables=tuple(frame.columns),
        notes=(
            f"Observed monthly anomalies for {', '.join(frame.columns)}."
            + (f" Months missing a companion index: {gaps}." if gaps else "")
        ),
    )
    write_manifest(paths, manifest)
    return manifest


def load(paths: DataPaths) -> pd.DataFrame:
    path = sources_dir(paths) / "nino34.csv"
    if not path.exists():
        raise IngestError(f"{path} is missing; run `ai-drews ingest nino34` first")
    frame = pd.read_csv(path, parse_dates=["date"]).set_index("date").sort_index()
    if frame.empty or not math.isfinite(float(frame["nino34"].iloc[-1])):
        raise IngestError(f"{path} holds no usable Niño 3.4 values")
    return frame
