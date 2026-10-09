"""Crop statistics for tef, wheat and maize.

The study specifies the Central Statistical Agency. CSA publishes the Agricultural Sample Survey
as annual PDF reports with no machine-readable feed, so the figures are taken from FAOSTAT, which
compiles Ethiopia's official national statistics and does publish an open bulk download.

One wrinkle is worth stating plainly rather than hiding in a mapping table: FAO has no `tef`
item. Ethiopian tef is reported inside `Cereals n.e.c.`, and for Ethiopia that aggregate is
overwhelmingly tef — the area and yield track the CSA tef series closely — but it is an
aggregate, so the row is labelled as such and the advisory rules should not treat it as a pure
tef measurement.
"""

from __future__ import annotations

import csv
import io
import logging
import zipfile

import pandas as pd

from ai_drews.config import DataPaths
from ai_drews.ingest.base import IngestError, Manifest, coverage_of, fetch_bytes, sources_dir, write_manifest

log = logging.getLogger(__name__)

KEY = "crops"
PROVIDER = "FAOSTAT, compiling Ethiopia's official agricultural statistics"
CITATION = (
    "FAO (2026), FAOSTAT Crops and livestock products, Ethiopia. https://www.fao.org/faostat/en/#data/QCL"
)
URL = "https://bulks-faostat.fao.org/production/Production_Crops_Livestock_E_Africa.zip"
AREA = "Ethiopia"

#: pipeline crop -> (FAOSTAT item, whether the item is exactly that crop)
ITEMS = {
    "tef": ("Cereals n.e.c.", False),
    "wheat": ("Wheat", True),
    "maize": ("Maize (corn)", True),
}
ELEMENTS = {"Area harvested": "area_ha", "Yield": "yield_kg_ha", "Production": "production_t"}


def fetch(paths: DataPaths) -> Manifest:
    """Download the FAOSTAT bulk file and write ``raw/sources/crops.csv``."""
    log.info("fetching %s", URL)
    archive = zipfile.ZipFile(io.BytesIO(fetch_bytes(URL)))
    names = [n for n in archive.namelist() if n.endswith("NOFLAG.csv")]
    if not names:
        raise IngestError("the FAOSTAT bulk archive has no NOFLAG csv")

    wanted = {item: crop for crop, (item, _) in ITEMS.items()}
    records: list[dict] = []
    with archive.open(names[0]) as handle:
        reader = csv.DictReader(io.TextIOWrapper(handle, encoding="utf-8-sig", errors="replace"))
        year_columns = [c for c in (reader.fieldnames or []) if c.startswith("Y") and c[1:].isdigit()]
        for row in reader:
            if row.get("Area") != AREA or row.get("Item") not in wanted:
                continue
            field = ELEMENTS.get(row.get("Element", ""))
            if field is None:
                continue
            crop = wanted[row["Item"]]
            for column in year_columns:
                raw = (row.get(column) or "").strip()
                if not raw:
                    continue
                try:
                    value = float(raw)
                except ValueError:
                    continue
                records.append({"year": int(column[1:]), "crop": crop, "item": row["Item"], field: value})

    if not records:
        raise IngestError(f"no {AREA} rows found for {sorted(wanted)}")

    frame = (
        pd.DataFrame.from_records(records)
        .groupby(["year", "crop", "item"], as_index=False)
        .first()
        .sort_values(["crop", "year"])
    )
    for field in ELEMENTS.values():
        if field not in frame:
            frame[field] = pd.NA
    frame["is_exact_item"] = frame["crop"].map(lambda c: ITEMS[c][1])
    frame = frame[["year", "crop", "item", "is_exact_item", *ELEMENTS.values()]]

    out = sources_dir(paths)
    out.mkdir(parents=True, exist_ok=True)
    frame.to_csv(out / "crops.csv", index=False)

    years = [str(y) for y in frame["year"]]
    aggregated = sorted(c for c, (_, exact) in ITEMS.items() if not exact)
    manifest = Manifest.now(
        key=KEY,
        provider=PROVIDER,
        source_url=URL,
        citation=CITATION,
        records=len(frame),
        coverage=coverage_of(years),
        variables=tuple(ELEMENTS.values()),
        notes=(
            f"{AREA}: {', '.join(sorted(ITEMS))}."
            + (
                f" FAO publishes no separate {' or '.join(aggregated)} item, so those figures come "
                "from 'Cereals n.e.c.', an aggregate that is predominantly tef in Ethiopia."
                if aggregated
                else ""
            )
        ),
    )
    write_manifest(paths, manifest)
    return manifest


def load(paths: DataPaths) -> pd.DataFrame:
    path = sources_dir(paths) / "crops.csv"
    if not path.exists():
        raise IngestError(f"{path} is missing; run `ai-drews ingest crops` first")
    return pd.read_csv(path)
