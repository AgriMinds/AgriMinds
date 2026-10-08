"""Reading CMIP6 monthly climate projections.

What these files are, and are not
---------------------------------
A ScenarioMIP file such as CanESM5-CanOE ssp585 is a *simulation of a possible future* under an
emissions pathway. It is not a record of observed weather. Two consequences are enforced here
rather than left to the caller:

* It must never become training data for the short-range drought model. That model learns from
  history in order to forecast one to three months ahead; fitting it to a scenario would produce
  an operational-looking forecast with no observational basis. ``load_projection`` writes nothing
  into ``data/raw/`` and every result it returns is stamped ``is_projection=True``.
* Its grid is coarse. CanESM5 runs at roughly 2.8 degrees, about 310 km per cell, while the Choke
  watershed is about 88 km across. The watershed is a fraction of one cell, so nothing in these
  files resolves it. Results are reported at the regional scale that the grid can actually
  support, and ``RegionFootprint`` records how far the data really extends.

What they are good for is the long-horizon question the study's Fig. 5 asks with its trend lines:
is drought intensity drifting over decades under a given pathway?
"""

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

log = logging.getLogger(__name__)

#: 1 kg of water per square metre is 1 mm depth, so a flux in kg m-2 s-1 is mm/s.
SECONDS_PER_DAY = 86400.0

#: Choke sits at 2800-4070 m. In a standard atmosphere 700 hPa is about 3000 m, so that level is
#: the closest the pressure-level fields come to highland near-surface air. The 1000 hPa level is
#: a sea-level value and runs roughly 20 C too warm for this terrain.
HIGHLAND_PRESSURE_PA = 70000.0


@dataclass(frozen=True)
class RegionFootprint:
    """Which grid cells were used, and how well they match what was asked for."""

    requested_bbox: tuple[float, float, float, float]  # lon_min, lat_min, lon_max, lat_max
    cell_count: int
    cell_size_deg: tuple[float, float]
    covered_bbox: tuple[float, float, float, float]
    centres_inside_request: int
    nearest_centre_offset_deg: float

    @property
    def resolves_request(self) -> bool:
        """True only when at least one cell centre actually falls inside the requested box."""
        return self.centres_inside_request > 0

    def warning(self) -> str | None:
        if self.resolves_request:
            return None
        return (
            f"No grid cell centre falls inside {self.requested_bbox}: the nearest is "
            f"{self.nearest_centre_offset_deg:.2f} deg away and one cell spans "
            f"{self.cell_size_deg[0]:.2f} x {self.cell_size_deg[1]:.2f} deg. "
            "Results describe the surrounding region, not the requested area."
        )


@dataclass(frozen=True)
class Projection:
    """A regional monthly series extracted from a scenario run."""

    dates: pd.DatetimeIndex
    precip_mm: np.ndarray  # (T,) monthly total, mm
    tmean_c: np.ndarray  # (T,) monthly mean air temperature at the chosen level, deg C
    source_id: str
    experiment_id: str
    variant_label: str
    pressure_level_pa: float
    footprint: RegionFootprint
    extras: dict[str, np.ndarray] = field(default_factory=dict)
    is_projection: bool = True

    @property
    def label(self) -> str:
        return f"{self.source_id} {self.experiment_id} ({self.variant_label})"

    def to_frame(self) -> pd.DataFrame:
        return pd.DataFrame(
            {"date": self.dates, "precip_mm": self.precip_mm, "tmean_c": self.tmean_c}
        ).assign(**{k: v for k, v in self.extras.items()})

    def provenance(self) -> dict:
        return {
            "source_id": self.source_id,
            "experiment_id": self.experiment_id,
            "variant_label": self.variant_label,
            "pressure_level_pa": self.pressure_level_pa,
            "is_projection": self.is_projection,
            "months": len(self.dates),
            "period": f"{self.dates[0]:%Y-%m} to {self.dates[-1]:%Y-%m}",
            "footprint": asdict(self.footprint),
        }


def _overlap(lo_a: np.ndarray, hi_a: np.ndarray, lo_b: float, hi_b: float) -> np.ndarray:
    """Length of the overlap between each [lo_a, hi_a] interval and [lo_b, hi_b]."""
    return np.clip(np.minimum(hi_a, hi_b) - np.maximum(lo_a, lo_b), 0.0, None)


def _bounds(ds, axis: str) -> tuple[np.ndarray, np.ndarray]:
    """Cell edges, taken from the file's *_bnds when present and inferred otherwise."""
    name = f"{axis}_bnds"
    if name in ds:
        b = np.asarray(ds[name].values, dtype="float64")
        return b[:, 0], b[:, 1]
    centres = np.asarray(ds[axis].values, dtype="float64")
    step = np.diff(centres).mean() if centres.size > 1 else 1.0
    return centres - step / 2, centres + step / 2


def _to_datetime_index(values) -> pd.DatetimeIndex:
    """CMIP6 files often use a NoLeap calendar; snap each stamp to the first of its month."""
    return pd.DatetimeIndex([pd.Timestamp(year=t.year, month=t.month, day=1) for t in values])


def load_projection(
    path: str | Path,
    bbox: tuple[float, float, float, float],
    pressure_level_pa: float = HIGHLAND_PRESSURE_PA,
    precip_var: str = "pr",
    temp_var: str = "ta",
) -> Projection:
    """Area-weighted regional mean of a CMIP6 monthly file over ``bbox``.

    Cells are weighted by how much of their area overlaps the requested box, times cos(latitude)
    so that a degree of longitude counts for less near the poles. Nothing is interpolated: a
    coarse grid stays coarse, and ``footprint`` says so.
    """
    try:
        import xarray as xr
    except ModuleNotFoundError as exc:  # pragma: no cover - depends on the install
        raise ModuleNotFoundError(
            "Reading NetCDF projections needs the optional extra: pip install -e 'ml[scenarios]'"
        ) from exc

    # CMIP6 files use non-standard calendars (this one is NoLeap), so keep cftime objects
    # rather than letting pandas reject them.
    ds = xr.open_dataset(path, decode_times=xr.coders.CFDatetimeCoder(use_cftime=True))
    try:
        lon_lo, lon_hi = _bounds(ds, "lon")
        lat_lo, lat_hi = _bounds(ds, "lat")
        lon_min, lat_min, lon_max, lat_max = bbox

        w_lon = _overlap(lon_lo, lon_hi, lon_min, lon_max)
        w_lat = _overlap(lat_lo, lat_hi, lat_min, lat_max)
        if not w_lon.any() or not w_lat.any():
            raise ValueError(f"{Path(path).name} does not cover {bbox}")

        # cos(lat) area weighting on the latitude axis only; longitude cells are equal width.
        centres_lat = np.asarray(ds["lat"].values, dtype="float64")
        weights = np.outer(w_lat * np.cos(np.radians(centres_lat)), w_lon)
        weights /= weights.sum()

        centres_lon = np.asarray(ds["lon"].values, dtype="float64")
        inside = int(
            ((centres_lon >= lon_min) & (centres_lon <= lon_max)).sum()
            * ((centres_lat >= lat_min) & (centres_lat <= lat_max)).sum()
        )
        target = ((lon_min + lon_max) / 2, (lat_min + lat_max) / 2)
        offset = float(np.hypot(np.abs(centres_lon - target[0]).min(), np.abs(centres_lat - target[1]).min()))
        used = weights > 0
        footprint = RegionFootprint(
            requested_bbox=bbox,
            cell_count=int(used.sum()),
            cell_size_deg=(
                float(np.diff(centres_lon).mean()) if centres_lon.size > 1 else 0.0,
                float(np.diff(centres_lat).mean()) if centres_lat.size > 1 else 0.0,
            ),
            covered_bbox=(
                float(lon_lo[w_lon > 0].min()),
                float(lat_lo[w_lat > 0].min()),
                float(lon_hi[w_lon > 0].max()),
                float(lat_hi[w_lat > 0].max()),
            ),
            centres_inside_request=inside,
            nearest_centre_offset_deg=offset,
        )
        if (warning := footprint.warning()) is not None:
            log.warning("%s", warning)

        dates = _to_datetime_index(ds["time"].values)

        def regional_mean(field: np.ndarray) -> np.ndarray:
            return np.nansum(field * weights[None, :, :], axis=(1, 2))

        flux = np.asarray(ds[precip_var].values, dtype="float64")  # kg m-2 s-1
        days = np.array([d.days_in_month for d in dates], dtype="float64")
        precip_mm = regional_mean(flux) * SECONDS_PER_DAY * days

        temperature = ds[temp_var]
        if "plev" in temperature.dims:
            level = int(np.abs(np.asarray(ds["plev"].values) - pressure_level_pa).argmin())
            actual_level = float(ds["plev"].values[level])
            temperature = temperature.isel(plev=level)
        else:
            actual_level = float("nan")
        tmean_c = regional_mean(np.asarray(temperature.values, dtype="float64")) - 273.15

        extras = {}
        for name, scale in (("evspsbl", SECONDS_PER_DAY), ("mrro", SECONDS_PER_DAY), ("clt", 1.0)):
            if name in ds and "plev" not in ds[name].dims:
                extras[name] = (
                    regional_mean(np.asarray(ds[name].values, dtype="float64"))
                    * scale
                    * (days if scale != 1.0 else 1.0)
                )

        return Projection(
            dates=dates,
            precip_mm=precip_mm,
            tmean_c=tmean_c,
            source_id=str(ds.attrs.get("source_id", "unknown")),
            experiment_id=str(ds.attrs.get("experiment_id", "unknown")),
            variant_label=str(ds.attrs.get("variant_label", "unknown")),
            pressure_level_pa=actual_level,
            footprint=footprint,
            extras=extras,
        )
    finally:
        ds.close()
