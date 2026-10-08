"""Potential evapotranspiration.

Thornthwaite (1948) is used because it needs only monthly mean temperature and latitude, which
is what a smallholder-scale reanalysis for the Choke watershed can be relied on to provide.
It is less accurate than Penman-Monteith; the Palmer index it feeds is a relative, calibrated
measure, so a consistent PET matters more here than an absolute one.
"""

from __future__ import annotations

import numpy as np

# Willmott et al. (1985) extension of Thornthwaite above the temperature his curve was fitted to.
_HIGH_TEMPERATURE_C = 26.5


def daylight_hours(latitude_deg: np.ndarray, day_of_year: np.ndarray) -> np.ndarray:
    """Mean daylight hours. Returns shape (len(day_of_year), len(latitude_deg))."""
    phi = np.radians(np.asarray(latitude_deg, dtype="float64"))[None, :]
    j = np.asarray(day_of_year, dtype="float64")[:, None]
    declination = 0.4093 * np.sin(2 * np.pi * j / 365.0 - 1.405)
    # Clipped so polar day/night does not produce a domain error; the watershed is tropical.
    cos_omega = np.clip(-np.tan(phi) * np.tan(declination), -1.0, 1.0)
    return 24.0 / np.pi * np.arccos(cos_omega)


def heat_index(monthly_normals: np.ndarray) -> np.ndarray:
    """Thornthwaite annual heat index I from the 12 monthly temperature normals of each cell.

    ``monthly_normals`` is (12, n_cells); returns (n_cells,).
    """
    warm = np.clip(monthly_normals, 0.0, None)
    return np.sum((warm / 5.0) ** 1.514, axis=0)


def thornthwaite_pet(
    tmean_c: np.ndarray,
    months: np.ndarray,
    latitude_deg: np.ndarray,
    days_in_month: np.ndarray,
    day_of_year: np.ndarray,
) -> np.ndarray:
    """Monthly potential evapotranspiration in mm.

    ``tmean_c`` is (T, n_cells) monthly mean temperature; ``latitude_deg`` is (n_cells,).
    Returns (T, n_cells).
    """
    tmean_c = np.asarray(tmean_c, dtype="float64")
    months = np.asarray(months)
    n_cells = tmean_c.shape[1]

    normals = np.stack(
        [
            tmean_c[months == m].mean(axis=0) if np.any(months == m) else np.zeros(n_cells)
            for m in range(1, 13)
        ]
    )
    index = heat_index(normals)
    # Where a cell never rises above freezing the exponent is undefined; PET is zero there anyway.
    safe_index = np.where(index > 0, index, 1.0)
    a = 6.75e-7 * safe_index**3 - 7.71e-5 * safe_index**2 + 1.792e-2 * safe_index + 0.49239

    t = tmean_c
    with np.errstate(invalid="ignore", divide="ignore"):
        moderate = 16.0 * (10.0 * np.clip(t, 0.0, None) / safe_index[None, :]) ** a[None, :]
    hot = -415.85 + 32.24 * t - 0.43 * t**2
    unadjusted = np.where(t <= 0.0, 0.0, np.where(t < _HIGH_TEMPERATURE_C, moderate, hot))
    unadjusted = np.nan_to_num(np.clip(unadjusted, 0.0, None))

    correction = (daylight_hours(latitude_deg, day_of_year) / 12.0) * (
        np.asarray(days_in_month, dtype="float64")[:, None] / 30.0
    )
    return unadjusted * correction
