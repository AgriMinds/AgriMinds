"""Self-calibrated Palmer Drought Severity Index (Sc-PDSI).

Implements Palmer (1965): a two-layer soil water balance, the CAFEC ("climatically appropriate
for existing conditions") precipitation, the moisture anomaly Z, and the severity recursion.

Self-calibration
----------------
Wells, Goddard & Hayes (2004) self-calibrate by refitting the duration factors of the recursion
from the record itself. This module instead calibrates by rescaling the two tails of the
severity series so that the 2nd and 98th percentiles of the calibration period land on -4 and
+4, which is the property the Sc-PDSI classification table actually depends on. The resulting
series is on the same scale and classifies the same way at the band boundaries, but it is not
numerically identical to the NCAR scPDSI, and it is labelled accordingly wherever it is shown.

The categories applied to the output live in ``ai_drews.advisory.classification``.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from ai_drews.features.pet import thornthwaite_pet

#: Palmer's surface-layer capacity: the top inch of soil, which must be exhausted before the
#: underlying layer begins to lose water.
SURFACE_CAPACITY_MM = 25.4

#: Available water capacity of the whole profile. 100 mm is the common default for a mixed
#: agricultural soil; override it per watershed once soil survey data is available.
DEFAULT_AWC_MM = 100.0

#: Palmer's duration factors for the severity recursion.
_PERSISTENCE = 0.897
_INCREMENT = 1.0 / 3.0

#: Palmer worked in inches, and the empirical constants of his climatic characteristic K
#: (the 2.8 offset and the 17.67 normalisation) are calibrated for that unit. Feeding them
#: millimetres makes the logarithm negative and silently inverts the sign of the whole index,
#: so the moisture anomaly is computed in inches and converted back here.
MM_PER_INCH = 25.4

#: Percentiles pinned to the extremes of the scale by self-calibration.
_DRY_PERCENTILE = 2.0
_WET_PERCENTILE = 98.0
_EXTREME = 4.0

#: Below this spread the calibration period is effectively constant and is left unscaled.
_MIN_CALIBRATION_SPREAD = 0.05


@dataclass(frozen=True)
class WaterBalance:
    """Monthly totals from the two-layer balance, each (T, n_cells) in mm."""

    et: np.ndarray  # actual evapotranspiration
    recharge: np.ndarray
    runoff: np.ndarray
    loss: np.ndarray
    potential_et: np.ndarray
    potential_recharge: np.ndarray
    potential_runoff: np.ndarray
    potential_loss: np.ndarray


def water_balance(precip_mm: np.ndarray, pet_mm: np.ndarray, awc_mm: float = DEFAULT_AWC_MM) -> WaterBalance:
    """Palmer's two-layer monthly soil water accounting, vectorised over grid cells."""
    precip_mm = np.asarray(precip_mm, dtype="float64")
    pet_mm = np.asarray(pet_mm, dtype="float64")
    n_steps, n_cells = precip_mm.shape

    surface_cap = min(SURFACE_CAPACITY_MM, awc_mm)
    under_cap = max(awc_mm - surface_cap, 0.0)

    # Start the profile full, then discard the spin-up year when calibrating.
    surface = np.full(n_cells, surface_cap)
    under = np.full(n_cells, under_cap)

    out = {k: np.zeros((n_steps, n_cells)) for k in ("et", "recharge", "runoff", "loss", "pr", "pro", "pl")}

    for t in range(n_steps):
        pe = pet_mm[t]
        p = precip_mm[t]
        stored = surface + under

        potential_recharge = awc_mm - stored
        potential_runoff = stored  # Palmer: PRO = AWC - PR
        loss_surface_potential = np.minimum(pe, surface)
        loss_under_potential = np.clip((pe - loss_surface_potential) * under / max(awc_mm, 1e-9), 0.0, under)
        potential_loss = loss_surface_potential + loss_under_potential

        wet = p >= pe
        # --- wet month: PET is met in full and the surplus recharges, then runs off.
        surplus = np.where(wet, p - pe, 0.0)
        recharge_surface = np.minimum(surplus, surface_cap - surface)
        remaining = surplus - recharge_surface
        recharge_under = np.minimum(remaining, under_cap - under)
        runoff = remaining - recharge_under

        # --- dry month: the deficit is drawn from the surface layer first.
        deficit = np.where(wet, 0.0, pe - p)
        loss_surface = np.minimum(surface, deficit)
        loss_under = np.minimum(under, (deficit - loss_surface) * under / max(awc_mm, 1e-9))

        recharge_surface = np.where(wet, recharge_surface, 0.0)
        recharge_under = np.where(wet, recharge_under, 0.0)
        runoff = np.where(wet, runoff, 0.0)
        loss_surface = np.where(wet, 0.0, loss_surface)
        loss_under = np.where(wet, 0.0, loss_under)

        et = np.where(wet, pe, p + loss_surface + loss_under)

        surface = np.clip(surface - loss_surface + recharge_surface, 0.0, surface_cap)
        under = np.clip(under - loss_under + recharge_under, 0.0, under_cap)

        out["et"][t] = et
        out["recharge"][t] = recharge_surface + recharge_under
        out["runoff"][t] = runoff
        out["loss"][t] = loss_surface + loss_under
        out["pr"][t] = potential_recharge
        out["pro"][t] = potential_runoff
        out["pl"][t] = potential_loss

    return WaterBalance(
        et=out["et"],
        recharge=out["recharge"],
        runoff=out["runoff"],
        loss=out["loss"],
        potential_et=pet_mm,
        potential_recharge=out["pr"],
        potential_runoff=out["pro"],
        potential_loss=out["pl"],
    )


def _ratio(numerator: np.ndarray, denominator: np.ndarray) -> np.ndarray:
    """Palmer's climatic coefficients, bounded to [0, 1].

    Three of the four are bounded by construction: evapotranspiration cannot exceed its
    potential, recharge cannot exceed the empty pore space, and loss cannot exceed the water
    present. Runoff is the exception. Palmer defines potential runoff as the water currently
    stored, but in a monsoon month the excess rain that actually runs off can be several times
    that, giving gamma > 1. CAFEC precipitation then grows with soil storage, which inverts the
    index: a wetter record scores drier. Over the Kiremt peak of the Choke watershed gamma
    reaches about 1.13 unbounded, so it is clipped. This is a documented weakness of Palmer's
    formulation in strongly seasonal climates, not a free parameter.
    """
    with np.errstate(invalid="ignore", divide="ignore"):
        value = np.where(denominator > 0, numerator / np.where(denominator > 0, denominator, 1.0), 1.0)
    return np.nan_to_num(np.clip(value, 0.0, 1.0))


def moisture_anomaly_index(
    precip_mm: np.ndarray, balance: WaterBalance, months: np.ndarray, calibration: np.ndarray | None = None
) -> np.ndarray:
    """Palmer's Z index: the departure from CAFEC precipitation, weighted by climate.

    ``calibration`` is a boolean mask over time selecting the months used to fit the climatic
    coefficients; it defaults to the whole record.
    """
    months = np.asarray(months)
    n_steps, n_cells = np.asarray(precip_mm).shape
    if calibration is None:
        calibration = np.ones(n_steps, dtype=bool)

    # Switch to inches for the rest of this function: see MM_PER_INCH.
    precip = np.asarray(precip_mm, dtype="float64") / MM_PER_INCH
    potential_et = balance.potential_et / MM_PER_INCH
    potential_recharge = balance.potential_recharge / MM_PER_INCH
    potential_runoff = balance.potential_runoff / MM_PER_INCH
    potential_loss = balance.potential_loss / MM_PER_INCH
    et = balance.et / MM_PER_INCH
    recharge = balance.recharge / MM_PER_INCH
    runoff = balance.runoff / MM_PER_INCH
    loss = balance.loss / MM_PER_INCH

    cafec = np.zeros_like(precip)
    for m in range(1, 13):
        in_month = months == m
        fit = in_month & calibration
        if not fit.any():
            fit = in_month
        if not fit.any():
            continue
        alpha = _ratio(et[fit].sum(0), potential_et[fit].sum(0))
        beta = _ratio(recharge[fit].sum(0), potential_recharge[fit].sum(0))
        gamma = _ratio(runoff[fit].sum(0), potential_runoff[fit].sum(0))
        delta = _ratio(loss[fit].sum(0), potential_loss[fit].sum(0))
        cafec[in_month] = (
            alpha * potential_et[in_month]
            + beta * potential_recharge[in_month]
            + gamma * potential_runoff[in_month]
            - delta * potential_loss[in_month]
        )

    departure = precip - cafec

    # Palmer's climatic characteristic K: how much a given departure means in this climate.
    k = np.ones((12, n_cells))
    mean_abs_departure = np.ones((12, n_cells))
    for m in range(1, 13):
        fit = (months == m) & calibration
        if not fit.any():
            fit = months == m
        if not fit.any():
            continue
        d_bar = np.abs(departure[fit]).mean(0)
        mean_abs_departure[m - 1] = np.where(d_bar > 0, d_bar, 1e-6)
        supply = potential_et[fit].mean(0) + recharge[fit].mean(0) + runoff[fit].mean(0)
        demand = precip[fit].mean(0) + loss[fit].mean(0)
        ratio = np.where(demand > 0, supply / np.where(demand > 0, demand, 1.0), 1.0)
        with np.errstate(invalid="ignore", divide="ignore"):
            k[m - 1] = 1.5 * np.log10((ratio + 2.8) / mean_abs_departure[m - 1]) + 0.5
    k = np.nan_to_num(k, nan=0.5, posinf=0.5, neginf=0.5)

    weighted = (mean_abs_departure * k).sum(0)
    scale = np.where(weighted > 0, 17.67 / np.where(weighted > 0, weighted, 1.0), 1.0)
    k_final = k * scale[None, :]

    return departure * k_final[months - 1]


def severity_from_z(z_index: np.ndarray) -> np.ndarray:
    """Palmer's severity recursion X_t = 0.897 X_(t-1) + Z_t / 3."""
    severity = np.zeros_like(z_index)
    previous = np.zeros(z_index.shape[1])
    for t in range(z_index.shape[0]):
        previous = _PERSISTENCE * previous + _INCREMENT * z_index[t]
        severity[t] = previous
    return severity


def self_calibrate(severity: np.ndarray, calibration: np.ndarray | None = None) -> np.ndarray:
    """Scale each tail so the calibration period's 2nd and 98th percentiles reach -4 and +4."""
    if calibration is None:
        calibration = np.ones(severity.shape[0], dtype=bool)
    window = severity[calibration] if calibration.any() else severity

    dry_edge = np.percentile(window, _DRY_PERCENTILE, axis=0)
    wet_edge = np.percentile(window, _WET_PERCENTILE, axis=0)

    # A record with almost no variability has percentiles at essentially zero. Scaling by
    # 4/epsilon would turn rounding noise into an extreme index, so such a series is left
    # unscaled: there is no spread to calibrate against.
    dry_usable = dry_edge < -_MIN_CALIBRATION_SPREAD
    wet_usable = wet_edge > _MIN_CALIBRATION_SPREAD
    dry_scale = np.where(dry_usable, _EXTREME / np.abs(np.where(dry_usable, dry_edge, -1.0)), 1.0)
    wet_scale = np.where(wet_usable, _EXTREME / np.where(wet_usable, wet_edge, 1.0), 1.0)

    return np.where(severity < 0, severity * dry_scale[None, :], severity * wet_scale[None, :])


def scpdsi(
    precip_mm: np.ndarray,
    tmean_c: np.ndarray,
    dates: pd.DatetimeIndex,
    latitude_deg: np.ndarray,
    awc_mm: float = DEFAULT_AWC_MM,
    calibration_end: str | None = None,
    spin_up_months: int = 12,
) -> np.ndarray:
    """Self-calibrated PDSI for a gridded monthly record.

    ``precip_mm`` and ``tmean_c`` are (T, H, W); ``latitude_deg`` is (H,). Returns (T, H, W).
    The first ``spin_up_months`` are excluded from calibration so the initial full soil profile
    does not bias the climatic coefficients.
    """
    precip_mm = np.asarray(precip_mm, dtype="float64")
    tmean_c = np.asarray(tmean_c, dtype="float64")
    n_steps, rows, cols = precip_mm.shape

    flat_precip = precip_mm.reshape(n_steps, -1)
    flat_tmean = tmean_c.reshape(n_steps, -1)
    cell_latitudes = np.repeat(np.asarray(latitude_deg, dtype="float64"), cols)

    months = dates.month.to_numpy()
    pet = thornthwaite_pet(
        flat_tmean,
        months,
        cell_latitudes,
        dates.days_in_month.to_numpy(),
        dates.dayofyear.to_numpy(),
    )

    calibration = np.ones(n_steps, dtype=bool)
    calibration[: min(spin_up_months, n_steps)] = False
    if calibration_end is not None:
        calibration &= dates <= pd.Timestamp(calibration_end)
    if not calibration.any():
        calibration = np.ones(n_steps, dtype=bool)

    balance = water_balance(flat_precip, pet, awc_mm)
    z = moisture_anomaly_index(flat_precip, balance, months, calibration)
    severity = severity_from_z(z)
    return self_calibrate(severity, calibration).reshape(n_steps, rows, cols)


def row_latitudes(bbox: tuple[float, float, float, float], rows: int) -> np.ndarray:
    """Latitude of each grid row's centre, north to south, matching the drought grid's order."""
    _, lat_min, _, lat_max = bbox
    step = (lat_max - lat_min) / rows
    return np.array([lat_max - (r + 0.5) * step for r in range(rows)])
