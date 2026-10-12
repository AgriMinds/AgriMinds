"""Crop-yield regressor: quintals/hectare for tef, wheat and maize by agro-ecological zone.

This is a *second*, independent model, and nothing in the drought pipeline depends on it. It is
fitted on a 1990-2023 crop/climate spreadsheet (one row per year: watershed mean temperature,
monthly rainfall, Niño 3.4, and yield for each crop in each altitude belt) rather than on the
8x8 grid, so it carries its own artifact pair -- ``crop_yield_model.joblib`` and
``crop_yield_meta.json`` -- written by ``ml/research/crop_yield/run_training.py``.

Two properties of the fitted model decide how it may honestly be presented, and both are carried
in the metadata so every client can repeat them:

* The dominant feature is last year's yield (``yield_lag1``, over half the gradient-boosted gain).
  Hold the lags fixed and vary the climate and the answer barely moves. It is a *persistence*
  estimate nudged by climate, and it is not evidence of an ENSO response.
* The holdout is the last seven years of a 34-year record, 63 observations. Test RMSE is about
  7 q/ha against a mean yield near 24, so a single cell's number is a planning-grade estimate.

There is no fallback: when the artifact is absent, or the libraries needed to unpickle it are
not installed, loading raises and the caller reports the model unavailable.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Literal

from ai_drews.config import DataPaths

#: Crop vocabulary of the rest of the platform (``ai_drews.advisory.rules.Crop``).
Crop = Literal["tef", "wheat", "maize"]
#: Altitude belts the model was trained on. The local names are the Amharic ones in common use.
AgroZone = Literal["Lowland", "Midland", "Highland"]

#: Platform crop name -> the label the training panel uses.
CROP_LABELS: dict[Crop, str] = {"tef": "Teff", "wheat": "Wheat", "maize": "Maize"}
#: Training label -> platform crop name.
CROP_NAMES: dict[str, Crop] = {v: k for k, v in CROP_LABELS.items()}

ZONE_LOCAL_NAMES: dict[AgroZone, str] = {
    "Lowland": "Kolla",
    "Midland": "Woina Dega",
    "Highland": "Dega",
}

CROPS: tuple[Crop, ...] = ("tef", "wheat", "maize")
ZONES: tuple[AgroZone, ...] = ("Lowland", "Midland", "Highland")

#: Niño 3.4 cut-offs used when the training panel was labelled. Kept here rather than reusing
#: ``advisory.classification.ENSO_BANDS`` because the phase is a *fitted feature* of this model:
#: changing the bands would silently relabel inputs the regressor was never trained on.
EL_NINO_FROM = 0.5
LA_NINA_FROM = -0.5


class CropYieldUnavailableError(RuntimeError):
    """The crop-yield artifact cannot be served: missing files or missing libraries."""


def enso_phase(enso_index: float) -> str:
    """Three-way phase exactly as ``preprocess.py`` labelled the training rows."""
    if enso_index >= EL_NINO_FROM:
        return "El Nino"
    if enso_index <= LA_NINA_FROM:
        return "La Nina"
    return "Neutral"


@dataclass(frozen=True)
class ZoneProfile:
    zone: AgroZone
    local_name: str
    altitude_approx_m: int
    altitude_min_m: int
    altitude_max_m: int


@dataclass(frozen=True)
class CropYieldInputs:
    """Every value the regressor sees, so a response can show what a number was based on."""

    crop: Crop
    zone: AgroZone
    year: int
    temperature_c: float
    precipitation_mm: float
    enso_index: float
    enso_phase: str
    yield_lag1: float
    yield_rolling3_mean: float

    @property
    def pt_ratio(self) -> float:
        return self.precipitation_mm / (self.temperature_c + 1e-5)


@dataclass(frozen=True)
class EnsoImpact:
    """What El Niño years did to one crop in one belt, over the whole record."""

    crop: Crop
    zone: AgroZone
    effect_pct: float  # percentage points away from the trend, El Niño years vs the rest
    p_value: float
    n_el_nino: int
    n_other: int

    @property
    def significant(self) -> bool:
        return self.p_value < 0.05


#: How the effect is measured, carried into every response that reports it.
ENSO_IMPACT_METHOD = (
    "Yields rise steeply across the record, so a plain El Niño-vs-rest average would mostly "
    "measure which decades happened to be El Niño years. Each crop-zone series is therefore "
    "detrended first (least-squares line on year) and each year expressed as a percentage "
    "deviation from its trend value; the effect is the mean deviation of El Niño years minus "
    "that of all other years, and p comes from Welch's t-test between the two groups."
)


def enso_impact_table(panel: Any) -> list[EnsoImpact]:
    """Measure the El Niño effect per crop and belt from the training panel.

    Takes the long panel (`crop`, `zone`, `year`, `yield`, `enso_phase`) and returns one entry
    per crop-zone series. Computed once at publish time and carried in the metadata, so serving
    it needs neither the panel nor scipy.
    """
    import numpy as np
    from scipy import stats

    out: list[EnsoImpact] = []
    for (crop_label, zone), g in panel.groupby(["crop", "zone"], sort=True):
        g = g.sort_values("year")
        trend = np.polyval(np.polyfit(g["year"], g["yield"], 1), g["year"])
        deviation = (g["yield"] - trend) / trend * 100
        el_nino = deviation[g["enso_phase"] == "El Nino"]
        rest = deviation[g["enso_phase"] != "El Nino"]
        _, p = stats.ttest_ind(el_nino, rest, equal_var=False)
        out.append(
            EnsoImpact(
                crop=CROP_NAMES[str(crop_label)],
                zone=str(zone),  # type: ignore[arg-type]
                effect_pct=round(float(el_nino.mean() - rest.mean()), 2),
                p_value=round(float(p), 4),
                n_el_nino=int(len(el_nino)),
                n_other=int(len(rest)),
            )
        )
    return out


@dataclass(frozen=True)
class CropYieldModel:
    """A fitted scikit-learn pipeline plus the metadata written beside it."""

    pipeline: Any
    meta: dict[str, Any]

    # ---- provenance ----------------------------------------------------------------------
    @property
    def model_name(self) -> str:
        return str(self.meta.get("model_name", "unknown"))

    @property
    def model_version(self) -> str:
        return str(self.meta.get("model_version", "unversioned"))

    @property
    def trained_at(self) -> str:
        return str(self.meta.get("trained_at", "unknown"))

    @property
    def metrics(self) -> dict[str, dict[str, float]]:
        return dict(self.meta.get("metrics", {}))

    @property
    def selected_metrics(self) -> dict[str, float]:
        return dict(self.meta.get("selected_metrics", {}))

    @property
    def feature_importance(self) -> list[tuple[str, float]]:
        return [(str(k), float(v)) for k, v in self.meta.get("feature_importance", [])]

    @property
    def enso_impact(self) -> list[EnsoImpact]:
        """The measured El Niño effect per crop-zone, as recorded at publish time."""
        return [
            EnsoImpact(
                crop=e["crop"],
                zone=e["zone"],
                effect_pct=float(e["effect_pct"]),
                p_value=float(e["p_value"]),
                n_el_nino=int(e["n_el_nino"]),
                n_other=int(e["n_other"]),
            )
            for e in self.meta.get("enso_impact", {}).get("cells", [])
        ]

    @property
    def enso_impact_method(self) -> str:
        return str(self.meta.get("enso_impact", {}).get("method", ENSO_IMPACT_METHOD))

    @property
    def caveats(self) -> list[str]:
        return [str(c) for c in self.meta.get("caveats", [])]

    @property
    def dataset(self) -> dict[str, Any]:
        return dict(self.meta.get("dataset", {}))

    @property
    def zones(self) -> list[ZoneProfile]:
        return [
            ZoneProfile(
                zone=z["zone"],
                local_name=z.get("local_name", ZONE_LOCAL_NAMES.get(z["zone"], z["zone"])),
                altitude_approx_m=int(z["altitude_approx_m"]),
                altitude_min_m=int(z["altitude_min_m"]),
                altitude_max_m=int(z["altitude_max_m"]),
            )
            for z in self.meta.get("zones", [])
        ]

    def zone_profile(self, zone: AgroZone) -> ZoneProfile:
        for z in self.zones:
            if z.zone == zone:
                return z
        raise KeyError(f"unknown agro-ecological zone: {zone}")

    # ---- the last observed season --------------------------------------------------------
    @property
    def baseline_year(self) -> int:
        """Last year of the training record: where the lag features come from."""
        return int(self.meta["baseline"]["year"])

    @property
    def baseline_climate(self) -> tuple[float, float, float]:
        """(temperature_c, precipitation_mm, enso_index) observed in ``baseline_year``."""
        b = self.meta["baseline"]
        return float(b["temperature_c"]), float(b["precipitation_mm"]), float(b["enso_index"])

    def observed_lags(self, crop: Crop, zone: AgroZone) -> tuple[float, float]:
        """(yield_lag1, yield_rolling3_mean) for a crop-zone series at the end of the record."""
        series = self.meta["baseline"]["series"][f"{CROP_LABELS[crop]}|{zone}"]
        return float(series["yield_lag1"]), float(series["yield_rolling3_mean"])

    def last_observed_yield(self, crop: Crop, zone: AgroZone) -> float:
        series = self.meta["baseline"]["series"][f"{CROP_LABELS[crop]}|{zone}"]
        return float(series["last_observed_yield"])

    def last_three_yields(self, crop: Crop, zone: AgroZone) -> list[float]:
        """The three closing yields of a crop-zone series, oldest first.

        A projection that steps several seasons forward has to roll the 3-year window itself, so
        one precomputed mean is not enough. Artifacts published before this was recorded fall back
        to repeating the stored mean, which starts the recursion in the same place.
        """
        series = self.meta["baseline"]["series"][f"{CROP_LABELS[crop]}|{zone}"]
        last3 = series.get("last3")
        if last3:
            return [float(v) for v in last3]
        return [float(series["yield_rolling3_mean"])] * 2 + [float(series["last_observed_yield"])]

    # ---- the observed record, as published beside the artifact ---------------------------
    @property
    def history(self) -> dict[str, Any]:
        """Belt-average yields and the panel's ENSO value, year by year."""
        return dict(self.meta.get("history", {}))

    @property
    def enso_annual_reference(self) -> dict[str, Any]:
        """Niño 3.4 annual means from the seasonal source, which reaches past the crop record."""
        return dict(self.meta.get("enso_annual_reference", {}))

    # ---- projection ----------------------------------------------------------------------
    def project(
        self,
        *,
        through_year: int,
        enso_by_year: dict[int, float],
        temperature_c: float | None = None,
        precipitation_mm: float | None = None,
    ) -> dict[int, dict[Crop, float]]:
        """Belt-average yield for every season after the record, out to ``through_year``.

        Each season is predicted from the one before it, because ``yield_lag1`` and
        ``yield_rolling3_mean`` are features: there is no other way to reach a year the record
        does not contain. That also means the error compounds, and since the lag features carry
        most of the model's gain the series converges on a level within a few steps. Treat the
        shape as a persistence estimate conditioned on ENSO, not as a forecast.

        ``enso_by_year`` supplies Niño 3.4 for each projected season. Climate defaults to the last
        observed season, which is what every other entry point here does.
        """
        obs_t, obs_p, _ = self.baseline_climate
        temp = obs_t if temperature_c is None else float(temperature_c)
        precip = obs_p if precipitation_mm is None else float(precipitation_mm)
        start = self.baseline_year + 1
        if through_year < start:
            return {}

        zones: list[AgroZone] = [z.zone for z in self.zones]
        histories = {
            (crop, zone): self.last_three_yields(crop, zone)
            for crop in CROP_LABELS
            for zone in zones
        }
        out: dict[int, dict[Crop, float]] = {}
        for year in range(start, through_year + 1):
            index = float(enso_by_year.get(year, 0.0))
            per_crop: dict[Crop, list[float]] = {}
            for (crop, zone), history in histories.items():
                hat = self.predict(
                    CropYieldInputs(
                        crop=crop,
                        zone=zone,
                        year=year,
                        temperature_c=temp,
                        precipitation_mm=precip,
                        enso_index=index,
                        enso_phase=enso_phase(index),
                        yield_lag1=history[-1],
                        yield_rolling3_mean=sum(history[-3:]) / len(history[-3:]),
                    )
                )
                history.append(hat)
                per_crop.setdefault(crop, []).append(hat)
            out[year] = {crop: sum(v) / len(v) for crop, v in per_crop.items()}
        return out

    # ---- inference -----------------------------------------------------------------------
    def inputs_for(
        self,
        crop: Crop,
        zone: AgroZone,
        *,
        year: int | None = None,
        temperature_c: float | None = None,
        precipitation_mm: float | None = None,
        enso_index: float | None = None,
    ) -> CropYieldInputs:
        """Fill in whatever the caller did not supply from the last observed season."""
        obs_t, obs_p, obs_e = self.baseline_climate
        lag1, roll3 = self.observed_lags(crop, zone)
        index = obs_e if enso_index is None else float(enso_index)
        return CropYieldInputs(
            crop=crop,
            zone=zone,
            year=self.baseline_year + 1 if year is None else int(year),
            temperature_c=obs_t if temperature_c is None else float(temperature_c),
            precipitation_mm=obs_p if precipitation_mm is None else float(precipitation_mm),
            enso_index=index,
            enso_phase=enso_phase(index),
            yield_lag1=lag1,
            yield_rolling3_mean=roll3,
        )

    def predict(self, inputs: CropYieldInputs) -> float:
        """Predicted yield in quintals per hectare (1 quintal = 100 kg)."""
        import pandas as pd

        row = pd.DataFrame(
            [
                {
                    "crop": CROP_LABELS[inputs.crop],
                    "zone": inputs.zone,
                    "altitude_approx_m": self.zone_profile(inputs.zone).altitude_approx_m,
                    "temperature_c": inputs.temperature_c,
                    "precipitation_mm": inputs.precipitation_mm,
                    "pt_ratio": inputs.pt_ratio,
                    "enso_index": inputs.enso_index,
                    "enso_phase": inputs.enso_phase,
                    "year": inputs.year,
                    "yield_lag1": inputs.yield_lag1,
                    "yield_rolling3_mean": inputs.yield_rolling3_mean,
                }
            ]
        )
        return float(self.pipeline.predict(row)[0])


def load_crop_yield_model(paths: DataPaths) -> CropYieldModel:
    """Load the published artifact pair, or raise ``CropYieldUnavailableError``.

    ``joblib.load`` reconstructs the fitted estimator, so the library it was trained with has to
    be importable here. That is why xgboost is an extra rather than a core dependency: an API
    deployment without it reports this model unavailable and serves everything else.
    """
    model_file = paths.crop_yield_model_joblib
    meta_file = paths.crop_yield_meta_json
    missing = [str(p) for p in (model_file, meta_file) if not p.exists()]
    if missing:
        raise CropYieldUnavailableError(
            f"crop-yield artifact missing: {missing}. Run ml/research/crop_yield/run_training.py"
        )
    try:
        import joblib
    except ImportError as exc:  # pragma: no cover - joblib ships with scikit-learn
        raise CropYieldUnavailableError(f"joblib is not installed: {exc}") from exc
    try:
        artifact = joblib.load(model_file)
    except (ImportError, ModuleNotFoundError) as exc:
        raise CropYieldUnavailableError(
            f'cannot unpickle the crop-yield model ({exc}). Install it with: pip install -e "ml[crop-yield]"'
        ) from exc
    meta = json.loads(meta_file.read_text())
    pipeline = artifact["pipeline"] if isinstance(artifact, dict) else artifact
    return CropYieldModel(pipeline=pipeline, meta=meta)
